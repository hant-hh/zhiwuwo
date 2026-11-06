#!/usr/bin/env bash
# 启动置物窝开发/演示环境（docker run 手动，不依赖 Compose）
set -e
cd "$(dirname "$0")/.."
source .env

# ===== 构建参数 =====
# 宿主机 DNS 多为 systemd-resolved(127.0.0.53)，Docker 默认回退 8.8.8.8 常不可达，
# 导致 build 内 pip/npm 报 "Temporary failure in name resolution"。
# host 网络可复用宿主机 DNS 与代理环境；若 BuildKit 禁用 host，改 BUILD_NETWORK=bridge
# 并在 /etc/docker/daemon.json 配 "dns": ["223.5.5.5","114.114.114.114"]。
BUILD_NETWORK="${BUILD_NETWORK:-host}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
# 依赖/Dockerfile 有改动时强制重建：REBUILD=1 ./deploy/start.sh
REBUILD="${REBUILD:-0}"

build_image() {
  local tag="$1" ctx="$2"; shift 2
  if [[ "$REBUILD" != "1" ]] && docker image inspect "$tag" >/dev/null 2>&1; then
    echo "镜像 $tag 已存在，跳过构建（改动依赖后请 REBUILD=1 ./deploy/start.sh）"
    return 0
  fi
  local -a args=(--network="$BUILD_NETWORK")
  if [[ -n "${HTTP_PROXY:-}" ]]; then
    args+=(--build-arg "HTTP_PROXY=$HTTP_PROXY")
  fi
  if [[ -n "${HTTPS_PROXY:-}" ]]; then
    args+=(--build-arg "HTTPS_PROXY=$HTTPS_PROXY")
  fi
  if [[ -n "${NO_PROXY:-}" ]]; then
    args+=(--build-arg "NO_PROXY=$NO_PROXY")
  fi
  args+=("$@")
  docker build "${args[@]}" -t "$tag" "$ctx"
}

# 容器已运行则复用，残留（已停止）则删除重建，保证 start.sh 可重复执行
run_if_absent() {
  local name="$1"; shift
  if docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null | grep -q '^true$'; then
    echo "容器 $name 已运行，跳过创建"
    return 0
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" "$@"
}

docker network create zhiwuwo-net 2>/dev/null || true

# PostgreSQL
run_if_absent postgres --network zhiwuwo-net \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -e POSTGRES_DB="$PG_DB" \
  -v /data/postgres:/var/lib/postgresql/data \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:16-alpine

# Redis
run_if_absent redis --network zhiwuwo-net \
  -v /data/redis:/data \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine

# MinIO（兼容 S3，开发期替代云 OSS）
run_if_absent minio --network zhiwuwo-net \
  -e MINIO_ROOT_USER="$OSS_ACCESS_KEY" \
  -e MINIO_ROOT_PASSWORD="$OSS_SECRET_KEY" \
  -v /data/minio:/data \
  -p 9000:9000 -p 9001:9001 \
  --restart unless-stopped \
  minio/minio:latest server /data --console-address ":9001"

# API（先构建镜像再运行）
# 等待数据库就绪，避免 api 启动时连接 postgres 过早
sleep 5
build_image zhiwuwo-api ./apps/api --build-arg "PIP_INDEX_URL=$PIP_INDEX_URL"
run_if_absent api --network zhiwuwo-net \
  --env-file .env \
  -v "$(pwd)/apps/api":/app \
  -p "${APP_PORT}:${APP_PORT}" \
  --restart unless-stopped \
  zhiwuwo-api

# Web 前端（npm 构建为静态产物，由 nginx 托管并反代 /api 到 api 容器）
# 对外只用非常用端口：HTTP WEB_PORT(18080) / HTTPS WEB_HTTPS_PORT(18443)
# 容器内 nginx 固定监听 18080 与 18443，不再监听 80/443/8080；
# 公网 80 仅在签发证书时由 issue-cert.sh 临时开放。
DOMAIN="${DOMAIN:-zhiwuwo.com}"
bash ./deploy/init-certs.sh
mkdir -p deploy/certbot/www
build_image zhiwuwo-web ./apps/web --build-arg "NPM_REGISTRY=$NPM_REGISTRY"
run_if_absent web --network zhiwuwo-net \
  -p "${WEB_PORT:-18080}:18080" \
  -p "${WEB_HTTPS_PORT:-18443}:18443" \
  -v "$(pwd)/deploy/certs:/etc/letsencrypt:ro" \
  -v "$(pwd)/deploy/certbot/www:/var/www/certbot:ro" \
  -v "$(pwd)/apps/web/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$(pwd)/apps/web/https.conf:/etc/nginx/conf.d/https.conf:ro" \
  --restart unless-stopped \
  zhiwuwo-web

echo "所有服务已启动，执行 docker ps 查看状态"
echo "Web(HTTP)：http://localhost:${WEB_PORT:-18080}   Web(HTTPS)：https://${DOMAIN}:${WEB_HTTPS_PORT:-18443}   API：${APP_PORT}"
echo "公网 80 默认不开放；签发正式证书时 ./deploy/issue-cert.sh 会临时开放用于 ACME 验证"
echo "自签占位证书仅供启动；域名解析生效后执行 ./deploy/issue-cert.sh 换正式证书"
