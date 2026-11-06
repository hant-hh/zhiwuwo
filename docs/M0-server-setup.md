# M0 基础设施 · 服务器操作文档

> 适用阶段：阶段零 M0（约 1 周）
> 目标：在 1 台 2核4G 云服务器上搭建开发/演示环境，包含 monorepo 结构、Docker（docker run 手动 + 启动脚本：后端 + PostgreSQL + Redis + MinIO）、CI 雏形、`.env` 配置。
> 关联文档：`docs/PLAN.md` §10 硬件基础、§11 环境参数

---

## 1. 服务器规格与系统

| 项 | 建议值 |
|---|---|
| 配置 | 2 核 4G 云服务器 |
| 系统 | Ubuntu 22.04 LTS（推荐） |
| 磁盘 | 系统盘 40G + 数据盘 60G（挂载到 `/data`） |
| 带宽 | 按量/固定 3–5 Mbps（演示足够） |

---

## 2. 基础环境安装

### 2.1 更新系统与创建数据目录

```bash
sudo apt update && sudo apt -y upgrade
sudo mkdir -p /data/{postgres,redis,minio,app,backup}
sudo chown -R $USER:$USER /data
```

### 2.2 安装 Docker（无需 Compose）

```bash
# 安装 Docker 引擎（不含 Compose）
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 重新登录使 docker 组生效，或执行：
newgrp docker
docker --version
```

### 2.3 安装 Git 与基础工具

```bash
sudo apt -y install git curl wget vim htop
```

---

## 3. 获取代码与目录结构

### 3.1 初始化 Monorepo（若从零开始）

```bash
git clone <your-repo-url> zhiwuwo
cd zhiwuwo
mkdir -p apps/web apps/mobile apps/api packages/api-schema deploy
```

期望结构（详见 `docs/PLAN.md` §4）：

```
zhiwuwo/
├── apps/{web,mobile,api}
├── packages/api-schema
├── deploy/            # 启动脚本（start.sh / stop.sh）
├── .env.example
└── README.md
```

### 3.2 配置环境变量

复制模板并填写（字段含义见 `docs/PLAN.md` §11）：

```bash
cp .env.example .env
vim .env   # 填写 SECRET_KEY、OSS_*、数据库密码等
```

`.env` 在各启动脚本中通过 `.` 读取（`sh` 兼容写法），因此 **`.env` 不要提交进 Git**（加入 `.gitignore`）。

---

## 4. Docker（docker run 手动）开发环境

> 不使用 Compose。所有容器接入同一自定义网络 `zhiwuwo-net`，容器间用名称互访（如 `api` 用 `postgres:5432` 访问数据库）。

### 4.1 创建网络

```bash
docker network create zhiwuwo-net
```

### 4.2 启动脚本 `deploy/start.sh`

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
. .env

docker network create zhiwuwo-net 2>/dev/null || true

# PostgreSQL
docker run -d --name postgres --network zhiwuwo-net \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -e POSTGRES_DB="$PG_DB" \
  -v /data/postgres:/var/lib/postgresql/data \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:16-alpine

# Redis
docker run -d --name redis --network zhiwuwo-net \
  -v /data/redis:/data \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine

# MinIO（兼容 S3，开发期替代云 OSS）
docker run -d --name minio --network zhiwuwo-net \
  -e MINIO_ROOT_USER="$OSS_ACCESS_KEY" \
  -e MINIO_ROOT_PASSWORD="$OSS_SECRET_KEY" \
  -v /data/minio:/data \
  -p 9000:9000 -p 9001:9001 \
  --restart unless-stopped \
  minio/minio:latest server /data --console-address ":9001"

# API（先构建镜像再运行）
docker build -t zhiwuwo-api ./apps/api
docker run -d --name api --network zhiwuwo-net \
  --env-file .env \
  -v "$(pwd)/apps/api":/app \
  -p "${APP_PORT}:${APP_PORT}" \
  --restart unless-stopped \
  zhiwuwo-api

echo "所有服务已启动，执行 docker ps 查看状态"
```

#### 4.2.1 构建失败排错：`Temporary failure in name resolution`

`docker build` 阶段 `pip install` / `npm install` 报 `[Errno -3] Temporary failure in name resolution`、重试 5 次后 `Could not find a version that satisfies the requirement fastapi (from versions: none)` —— **这是构建容器的 DNS 解析失败，不是镜像源里没有包，也不是依赖写错**。

原因是宿主机 `/etc/resolv.conf` 常为 systemd-resolved 的 `127.0.0.53`；Docker 生成容器 DNS 时会过滤 loopback 地址并回退 `8.8.8.8 / 8.8.4.4`，国内云环境这两个地址通常不可达。

诊断（本机实测结果）：

```bash
# 默认 bridge：失败（build 用的就是这个网络）
docker run --rm python:3.12-slim python -c "import socket;print(socket.gethostbyname('pypi.tuna.tsinghua.edu.cn'))"
# -> socket.gaierror: [Errno -3] Temporary failure in name resolution

# host 网络：成功
docker run --rm --network=host python:3.12-slim python -c "import socket;print(socket.gethostbyname('pypi.tuna.tsinghua.edu.cn'))"
# -> 101.6.15.130

# zhiwuwo-net 自定义网络：成功（运行期容器都在这个网络，不受影响）
docker run --rm --network zhiwuwo-net python:3.12-slim python -c "import socket;print(socket.gethostbyname('api.agnes-ai.cn'))"
```

自定义网络使用 Docker 嵌入式 DNS（`127.0.0.11`）转发到宿主机上游，因此**运行期容器访问 `api.agnes-ai.cn` 等外部域名是正常的**；故障只发生在 `docker build` 使用的默认 bridge 网络。

`start.sh` 已默认用 `docker build --network=host`（复用宿主机 DNS 与代理），并支持通过 `.env` 配置：

| 变量 | 默认 | 用途 |
|---|---|---|
| `BUILD_NETWORK` | `host` | 构建网络；BuildKit 禁用 host 时设 `bridge` 并配 daemon `dns` |
| `PIP_INDEX_URL` | 清华 PyPI | 可换 `https://mirrors.aliyun.com/pypi/simple/` 等 |
| `NPM_REGISTRY` | npmmirror | 可换 `https://registry.npmjs.org` |
| `REBUILD` | `0` | 镜像已存在时跳过构建；改过依赖/Dockerfile 设 `1` |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | 空 | 作为 build-arg 透传，不写入最终镜像 |

仅当 BuildKit 禁用 `host`、必须退回默认 `bridge` 构建时，才需要给 Docker daemon 配全局 DNS（`/etc/docker/daemon.json`）：

```json
{
  "dns": ["223.5.5.5", "114.114.114.114", "8.8.8.8"]
}
```

然后 `sudo systemctl restart docker`（`--restart unless-stopped` 会自动拉起容器；若容器间互访异常，`docker network rm zhiwuwo-net` 后重跑 `start.sh`）。

> `start.sh` 现在可重复执行：已运行的容器用 `run_if_absent` 复用，不会因 `--name` 冲突中断。强制重建镜像：`REBUILD=1 ./deploy/start.sh`。

### 4.3 停止脚本 `deploy/stop.sh`

```bash
#!/usr/bin/env bash
set -e
for c in api minio redis postgres; do
  docker rm -f "$c" 2>/dev/null || true
done
echo "已停止并移除容器（数据卷 /data 仍保留）"
```

> 对象存储开发期用 MinIO 兼容 S3 协议，生产替换为云厂商 OSS/COS（仅改 `.env` 的 `OSS_*` 即可，无需改动启动脚本结构）。

### 4.4 启动与校验

```bash
chmod +x deploy/start.sh deploy/stop.sh
./deploy/start.sh

# 查看状态
docker ps -a

# 查看日志
docker logs -f api
```

容器均标记 `--restart unless-stopped`，异常退出会自动拉起。可用以下命令做健康检查：

```bash
docker exec postgres pg_isready -U "$PG_USER"
docker exec redis redis-cli ping
curl -f http://localhost:${APP_PORT}/health   # 需后端提供 /health 端点
```

### 4.5 数据库迁移（后端就绪后执行）

```bash
# 进入 api 容器执行迁移（命令随后端语言/框架而定）
docker exec -it api <migrate-command>
```

---

## 5. 域名、nginx 与 HTTPS（移动端内测前置，已落地）

移动端真机必须走 HTTPS + 受信任证书，因此本项从「可选」提升为 M4.0 的必做项。完整操作手册见 **[`docs/https-setup.md`](./https-setup.md)**，这里只列要点。

### 5.1 当前实现

- Web 由 nginx 容器托管，`start.sh` 用 `docker run` 挂载证书、ACME 目录、`apps/web/nginx.conf` 与 `apps/web/https.conf`，只映射 `<WEB_PORT>:18080`、`<WEB_HTTPS_PORT>:18443`（配置改完 `nginx -s reload` 即可，无需重建镜像）。**不使用 80 / 443 / 8080**。
- `apps/web/nginx.conf`：容器内监听 `18080`，含 SPA 回退、`/api/`、`/health`、`/openapi.json` 反代与 `/.well-known/acme-challenge/` 验证目录。
- `apps/web/https.conf`：容器内监听 `18443`，`server_name zhiwuwo.com www.zhiwuwo.com`，证书路径 `/etc/letsencrypt/live/zhiwuwo.com/`。
- `DOMAIN=zhiwuwo.com`、`ACME_EMAIL`、`WEB_PORT=18080`、`WEB_HTTPS_PORT=18443` 写入 `.env` / `.env.example`；`CORS_ORIGINS` 的来源必须带 `:18443`。
- 公网 `80` 平时不开放；`deploy/issue-cert.sh` 在签发/续期期间临时起容器占用 80 完成 ACME HTTP-01 验证，结束自动回收（详见 `docs/https-setup.md` §1）。

### 5.2 首次启动与正式证书

```bash
./deploy/start.sh                # 自动调 init-certs.sh 生成自签「占位证书」
./deploy/check-domain.sh         # 确认 A 记录、18080 / 18443 连通性
sudo apt -y install certbot      # 宿主机安装 certbot
./deploy/issue-cert.sh           # 临时开 80 → 签发正式证书 → 关 80 → reload nginx
./deploy/issue-cert.sh --renew   # 续期（同样临时开 80）
```

> 自签证书只保证 nginx 的 18443 能启动，浏览器会提示不受信任，**不能用于内测真机**。

### 5.3 验证

```bash
curl -s  -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/            # 200
curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1:18443/           # 200
curl -sk https://127.0.0.1:18443/health                                     # {"status":"ok"}
curl -sk https://127.0.0.1:18443/api/v1/parser/status
docker exec web nginx -t
curl -s -o /dev/null -w '%{http_code}\n' -m 3 http://127.0.0.1/ || true       # 平时 80 应为 000
```

> 注意：健康检查路径是 `/health`，不是 `/api/health`；非标准 HTTPS 端口必须显式写出。防火墙平时只放行 18080 / 18443（运维需要时再开 8000），签发证书时临时放行 80；数据库、Redis、MinIO 端口不对公网开放。

---

## 6. CI 雏形（GitHub Actions 示例）

`.github/workflows/ci.yml`：

```yaml
name: CI
on: [push, pull_request]
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: |
          cd apps/api
          pip install -r requirements.txt
          pytest
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: |
          cd apps/web
          npm ci
          npm run build
```

流程：push → lint → 测试 → 构建镜像。`docs/PLAN.md` §13 有完整策略。

---

## 7. 日常运维命令速查

```bash
# 启停（通过脚本）
./deploy/start.sh
./deploy/stop.sh

# 单容器启停
docker start postgres
docker stop api

# 查看资源占用
docker stats
htop

# 数据库备份
docker exec -t postgres pg_dump -U "$PG_USER" "$PG_DB" > /data/backup/$(date +%F).sql

# 更新代码后重建 api 镜像
git pull
docker build -t zhiwuwo-api ../apps/api
docker rm -f api && ./deploy/start.sh

# 清理无用镜像
docker image prune -f
```

---

## 8. M0 完成验收清单

- [ ] 服务器就绪，Docker 引擎（非 Compose）已安装
- [ ] monorepo 目录结构创建完成（apps / packages / deploy）
- [ ] `./deploy/start.sh` 后 postgres / redis / minio / api 全部运行且健康检查通过
- [ ] `.env` 已配置且未提交进 Git（在 `.gitignore`）
- [ ] 数据库迁移可成功执行
- [ ] CI 流水线（lint→测试→构建）跑通
- [x] 后端语言选型确认（Python + FastAPI，见 PLAN §5）
- [x] 移动端跨端框架选型确认（React Native + Expo SDK 56，见 `docs/mobile-plan.md`）
- [x] 域名与 nginx（对外仅 18080 / 18443）、ACME 目录、自签占位证书（见 `docs/https-setup.md`）
- [ ] 正式 Let's Encrypt 证书签发（待域名解析与公网 80 可达，执行 `./deploy/issue-cert.sh`）

---

## 附录 A：常见问题与最小 API 骨架

### A.1 `sh start.sh` 报 `source: not found`
Ubuntu 的 `sh` 是 dash，不支持 `source`。两种解法：
- 用脚本自带 shebang 运行：`./deploy/start.sh` 或 `bash deploy/start.sh`；
- 或把脚本里的 `source .env` 改成 POSIX 写法 `. .env`（当前已采用此写法）。

### A.2 `docker run minio` 报 `error from registry: denied`
公共镜像加速器（如 daocloud）**只代理 Docker Hub 官方镜像**（`library/*`）。`postgres`/`redis` 是官方镜像可拉取，`minio/minio` 属非官方仓库被拒。
解决：改用“全量代理”镜像源，编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.1panel.live",
    "https://docker.1ms.run",
    "https://dockerpull.org"
  ]
}
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
docker pull minio/minio:latest   # 验证可拉取
```

### A.3 `docker build` 报 `no such file or directory`（找不到 Dockerfile）
`start.sh` 会 `docker build -t zhiwuwo-api ./apps/api`，需 `apps/api/Dockerfile` 存在。
已在仓库内置最小骨架，无需再建：

`apps/api/Dockerfile`
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple fastapi uvicorn
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`apps/api/main.py`
```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"service": "zhiwuwo-api"}
```

> 说明：`start.sh` 已把宿主机 `apps/api` 挂载进容器 `/app`，修改 `main.py` 后 `docker restart api` 即可生效，无需重新 build。

### A.4 重跑前清理残留容器
若上次启动中途失败，已创建的容器会残留导致重名冲突，先清理再启动：
```bash
./deploy/stop.sh
./deploy/start.sh
```

---

_最后更新：2026-11-05 — 补充域名 / nginx / HTTPS 落地说明（§5）与验收项；完整证书操作见 `docs/https-setup.md`。_
