#!/usr/bin/env bash
# 用 Let's Encrypt 签发 / 续期正式证书（webroot / HTTP-01），并 reload nginx。
# 平时服务只用 18080 / 18443，公网 80 不开放。HTTP-01 硬性要求公网 80，
# 因此本脚本会临时起一个静态容器把 80 映射到 ACME challenge 目录，结束后自动删除。
# 用法：
#   ./deploy/issue-cert.sh           # 首次签发
#   ./deploy/issue-cert.sh --renew   # 续期
# 前置：DOMAIN 的 A 记录已指向本机，且防火墙/安全组在签发期间放行公网 80。
set -e
cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-zhiwuwo.com}"
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"
WEB_HTTPS_PORT="${WEB_HTTPS_PORT:-18443}"
CERT_DIR="deploy/certs"
WWW_DIR="deploy/certbot/www"
LIVE_DIR="${CERT_DIR}/live/${DOMAIN}"
ACME_HELPER="zhiwuwo-acme-http"
MODE="${1:-issue}"

if ! command -v certbot >/dev/null 2>&1; then
  echo "[cert] 缺少 certbot，请先执行：apt install -y certbot" >&2
  exit 1
fi

mkdir -p "$WWW_DIR/.well-known/acme-challenge" deploy/certbot/work deploy/certbot/logs

cleanup_acme() {
  docker rm -f "$ACME_HELPER" >/dev/null 2>&1 || true
}
# 无论成功失败都回收临时容器，避免 80 端口被长期占用
trap cleanup_acme EXIT

# 借用项目自定义网络：本机默认 bridge 的端口映射/DNS 异常（实测 80 映射不通），
# zhiwuwo-net 已验证可用；网络不存在时先创建，便于单独执行本脚本。
docker network create zhiwuwo-net 2>/dev/null || true

echo "[cert] 临时开放公网 80 提供 ACME 验证（结束后自动关闭）"
cleanup_acme
if ! docker run -d --name "$ACME_HELPER" \
      --network zhiwuwo-net \
      -p 80:80 \
      -v "$(pwd)/${WWW_DIR}:/usr/share/nginx/html:ro" \
      nginx:alpine >/dev/null; then
  echo "[cert] 无法占用公网 80：请检查是否有其他进程监听，以及安全组是否放行" >&2
  exit 1
fi

# 轮询等待临时 nginx 就绪，避免 certbot 抢跑导致验证失败
echo -n acme-ready > "${WWW_DIR}/.well-known/acme-challenge/.probe"
ready=0
for _ in {1..15}; do
  if [ "$(curl -s -m 2 http://127.0.0.1/.well-known/acme-challenge/.probe 2>/dev/null)" = "acme-ready" ]; then
    ready=1
    break
  fi
  sleep 1
done
rm -f "${WWW_DIR}/.well-known/acme-challenge/.probe"
if [ "$ready" != "1" ]; then
  echo "[cert] 临时 80 服务未就绪，请检查 80 是否被占用或防火墙拦截" >&2
  exit 1
fi

if [ "$MODE" = "--renew" ]; then
  echo "[cert] 续期 ${DOMAIN}"
  certbot renew --config-dir "$CERT_DIR" \
    --webroot -w "$WWW_DIR" \
    --work-dir deploy/certbot/work \
    --logs-dir deploy/certbot/logs \
    --non-interactive
else
  # 先把自签占位证书挪走，避免 certbot 创建 live 符号链接时冲突
  if [ -f "${LIVE_DIR}/fullchain.pem" ] && [ ! -L "${LIVE_DIR}/fullchain.pem" ]; then
    mv "$LIVE_DIR" "${LIVE_DIR}.selfsigned.bak"
    echo "[cert] 已备份自签证书到 ${LIVE_DIR}.selfsigned.bak"
  fi

  echo "[cert] 为 ${DOMAIN} 签发证书"
  certbot certonly --webroot -w "$WWW_DIR" \
    -d "$DOMAIN" -d "www.${DOMAIN}" \
    --config-dir "$CERT_DIR" \
    --work-dir deploy/certbot/work \
    --logs-dir deploy/certbot/logs \
    --agree-tos -m "$ACME_EMAIL" --non-interactive
fi

# 验证完成后立刻关闭 80
cleanup_acme

if docker ps --format '{{.Names}}' | grep -qx web; then
  docker exec web nginx -t
  docker exec web nginx -s reload
  echo "[cert] nginx 已 reload，访问 https://${DOMAIN}:${WEB_HTTPS_PORT} 验证"
else
  echo "[cert] web 容器未运行，请执行 ./deploy/start.sh"
fi

echo "[cert] 续期请执行：./deploy/issue-cert.sh --renew"
