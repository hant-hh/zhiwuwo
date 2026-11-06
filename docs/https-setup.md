# 域名 / HTTPS / nginx 配置说明（M4.0）

> 最后更新：2026-11-06
> 域名：`zhiwuwo.com`（含 `www.zhiwuwo.com`）
> 对外端口：HTTP `18080` / HTTPS `18443`（**不使用 80 / 443 / 8080**）
> 关联：[`docs/mobile-plan.md`](./mobile-plan.md) §7.1、[`docs/M0-server-setup.md`](./M0-server-setup.md) §5、[`apps/mobile/README.md`](../apps/mobile/README.md)

移动端真机访问服务端必须走 **HTTPS + 受信任证书**：iOS ATS 默认禁止明文 HTTP，Android 新版本同样默认禁止 cleartext。本项目 HTTPS 使用**非标准端口 18443**，因此所有 URL 都必须显式写出端口，例如 `https://zhiwuwo.com:18443`。

---

## 1. 落地清单

| 文件 | 作用 |
|---|---|
| `apps/web/nginx.conf` | HTTP 站点，容器内监听 `18080`：SPA 回退、`/api/` 反代、ACME challenge 目录、`/health`、`/openapi.json` |
| `apps/web/https.conf` | HTTPS 站点，容器内监听 `18443`：证书路径、同源 `/api/` 反代、`client_max_body_size 32m` |
| `deploy/init-certs.sh` | 生成**自签占位证书**，保证正式证书签发前 nginx 的 18443 也能启动 |
| `deploy/issue-cert.sh` | Let's Encrypt HTTP-01 签发 / 续期；**临时开放公网 80**，结束后自动回收并 reload nginx |
| `deploy/check-domain.sh` | 检查 DNS 解析、18080 / 18443 连通性与当前证书 |
| `deploy/start.sh` | 挂载证书 / ACME 目录 / 两份 nginx 配置，只映射 `18080`、`18443` |
| `.env` / `.env.example` | `DOMAIN`、`ACME_EMAIL`、`WEB_PORT=18080`、`WEB_HTTPS_PORT=18443`、带端口的 `CORS_ORIGINS` |
| `.gitignore` | 忽略 `deploy/certs/`、`deploy/certbot/`（含私钥） |

### 端口规划

| 端口 | 用途 |
|---|---|
| 18080 | 对外 HTTP 明文入口（`WEB_PORT` → 容器 18080） |
| 18443 | 对外 HTTPS 入口（`WEB_HTTPS_PORT` → 容器 18443），App 与 Web 的正式入口 |
| 80 | **平时不开放**。仅 `issue-cert.sh` 签发/续期期间临时映射，供 Let's Encrypt HTTP-01 验证 |
| 8000 | API 容器直接暴露（运维 / 契约导出用），不对外提供 Web |

`start.sh` 只做一对一映射：`-p ${WEB_PORT:-18080}:18080 -p ${WEB_HTTPS_PORT:-18443}:18443`。容器内 nginx 只 `listen 18080` 与 `listen 18443 ssl`，**不再监听 80 / 443 / 8080**。对外端口可由 `.env` 调整，容器内端口固定。

> **为什么 80 无法彻底去掉**：Let's Encrypt 的 HTTP-01 验证固定从公网 `http://<域名>/.well-known/acme-challenge/<token>`（即 80 端口）拉取文件，改端口无法绕过。因此采用「平时零监听、签发期临时开放」：`issue-cert.sh` 会起一个 `nginx:alpine` 临时容器，接入 `zhiwuwo-net` 并映射 `80:80`，只读挂载同一个 `deploy/certbot/www`，轮询等待就绪后交给 certbot，`trap` 保证成功或失败都自动删除。用自定义网络是因为本机默认 bridge 的端口映射/DNS 异常（见 `docs/M0-server-setup.md` §4.2.1），实测默认 bridge 下 80 映射不通、`zhiwuwo-net` 下正常。若连临时 80 都不允许，只能改用 DNS-01（需 DNS 服务商 API），当前脚本未实现。

---

## 2. 请求链路

```
App / Web ──HTTPS:18443──> nginx:18443 (https.conf)
                             ├─ /                 → /usr/share/nginx/html（SPA）
                             ├─ /api/v1/*         → http://api:8000
                             ├─ /health           → http://api:8000/health
                             └─ /openapi.json     → http://api:8000/openapi.json

Web ──HTTP:18080──> nginx:18080 (nginx.conf)
                             ├─ SPA
                             └─ /.well-known/acme-challenge/ → /var/www/certbot（挂载）

ACME 验证（仅签发期）──公网 80──> 临时容器 zhiwuwo-acme-http
                                  只读挂载同一个 deploy/certbot/www
```

移动端 `EXPO_PUBLIC_API_BASE_URL=https://zhiwuwo.com:18443`，与 Web 同源访问 `/api`，**原生请求不受 CORS 限制**。后端 `CORS_ORIGINS` 必须包含带端口的来源（如 `https://zhiwuwo.com:18443`），否则浏览器跨域会被拒；Web 前端本身用同源 `/api`，不受影响。

---

## 3. 操作步骤

### 3.1 首次启动（自签占位证书）

```bash
cd /export/ant/zhiwuwo
cp .env.example .env      # 填好 SECRET_KEY / 数据库密码 / DOMAIN / ACME_EMAIL
./deploy/start.sh
```

`start.sh` 会自动调用 `init-certs.sh`，在 `deploy/certs/live/zhiwuwo.com/` 生成：

- `fullchain.pem`（自签证书，含 `subjectAltName=DNS:zhiwuwo.com,DNS:www.zhiwuwo.com`）
- `privkey.pem`（权限 600）

访问 `https://zhiwuwo.com:18443` 会提示「证书不受信任」——**这是预期的**，仅用于让 nginx 的 18443 能启动。

### 3.2 签发正式证书

前置条件：

1. `zhiwuwo.com` 与 `www.zhiwuwo.com` 的 A 记录指向服务器公网 IP；
2. 安全组 / 防火墙放行 `18080`、`18443`，并在**签发期间**临时放行公网 `80`；
3. 宿主机已安装 `certbot`：`apt install -y certbot`。

```bash
./deploy/check-domain.sh    # 解析 + 18080/18443 连通性 + 当前证书
./deploy/issue-cert.sh      # 临时开放 80 → 签发 → 关闭 80 → reload nginx
```

`issue-cert.sh` 内部流程：备份自签目录为 `*.selfsigned.bak`（避免与 certbot 的 `live` 符号链接冲突）→ 在 `zhiwuwo-net` 起临时 80 容器并轮询就绪 → `certbot certonly --webroot` → 删除临时容器 → `nginx -t && nginx -s reload`。

续期（同样需要临时 80）：

```bash
./deploy/issue-cert.sh --renew
```

---

## 4. 验证命令

```bash
# 两个对外入口
curl -s  -o /dev/null -w 'HTTP 18080  = %{http_code}\n' http://127.0.0.1:18080/
curl -sk -o /dev/null -w 'HTTPS 18443 = %{http_code}\n' https://127.0.0.1:18443/

# 反代链路（正确路径是 /health、/api/v1/...，不是 /api/health）
curl -sk https://127.0.0.1:18443/health
curl -sk https://127.0.0.1:18443/api/v1/parser/status
docker exec web nginx -t

# 平时 80 应为 000 / 连接失败（签发期才会临时开放）
curl -s -o /dev/null -w 'HTTP 80 = %{http_code}\n' -m 3 http://127.0.0.1/ || true

# ACME 目录探针（经 18080；必须放在 challenge 子目录）
mkdir -p deploy/certbot/www/.well-known/acme-challenge
echo -n probe-ok > deploy/certbot/www/.well-known/acme-challenge/probe.txt
curl -s http://127.0.0.1:18080/.well-known/acme-challenge/probe.txt   # -> probe-ok
```

本次回归（2026-11-06）实测：`HTTP 18080=200`、`HTTPS 18443=200`、`/health` 返回 `{"status":"ok"}`、`/api/v1/parser/status` 正常、`nginx -t` 通过，`nginx -T` 中只有 `listen 18080` 与 `listen 18443 ssl`；`8080`、`80`、`443` 均返回 `000`。ACME 临时 80 容器经 `zhiwuwo-net` 返回 `probe-ok`，清理后 80 恢复关闭。

证书换成正式证书后，去掉 `-k` 再验证一次，必须返回 200 且无证书告警。

---

## 5. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 18080 / 18443 返回 `000` | 端口映射或容器网络残留；`./deploy/stop.sh` 后必要时 `docker network rm zhiwuwo-net`，再 `REBUILD=1 ./deploy/start.sh` |
| `https://zhiwuwo.com/health` 打不开 | 非标准端口必须显式写出：改 `https://zhiwuwo.com:18443/health` |
| `curl https://127.0.0.1:18443/api/health` 返回 `{"detail":"Not Found"}` | 后端健康检查真实路径是 `/health`，不是 `/api/health` |
| 浏览器跨域被拒 | `CORS_ORIGINS` 的来源必须带 `:18443`（或 `:18080`），改完重启 api 容器 |
| ACME 探针 404 | 文件要放 `deploy/certbot/www/.well-known/acme-challenge/`，不是 `deploy/certbot/www/` 根目录 |
| `certbot` 签发失败 `Connection refused` / `Timeout` | 域名未解析到本机、公网 80 未放行或 80 被其他进程占用；先跑 `check-domain.sh`，再看临时容器 `zhiwuwo-acme-http` 的日志 |
| 签发后 80 仍被占用 | `issue-cert.sh` 有 `trap` 自动清理；异常退出可手动 `docker rm -f zhiwuwo-acme-http` |
| 真机 App 连不上 / iOS 报 ATS | 用了 `http://`、漏写 `:18443` 或自签证书；必须换成受信任证书的 `https://zhiwuwo.com:18443` |
| 浏览器提示不受信任 | 当前还是自签占位证书，执行 `./deploy/issue-cert.sh` |
| 重启 dockerd / 重建镜像后不通 | 按 `docs/M0-server-setup.md` §4.2.1 检查容器 DNS 与网络，再跑一遍 §4 验证命令 |

---

## 6. 安全约定

- 安全组平时只放行 `18080` / `18443`（运维需要再加 `8000`）；签发证书期间临时开 `80`，脚本结束后立即关闭。
- `deploy/certs/`、`deploy/certbot/` 含私钥与 ACME 状态，**已在 `.gitignore` 中忽略**，禁止提交。
- 私钥 `privkey.pem` 权限 600；容器内只读挂载 `:ro`。
- 数据库端口（5432）、Redis（6379）、MinIO（9000）不应对公网开放。
