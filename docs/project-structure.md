# 置物窝 · 目录结构与忽略规范

> 适用范围：Monorepo 全仓（Web / 移动端 / 后端 / 共享契约 / 部署）
> 关联文档：`docs/PLAN.md` §4（仓库组织）、`docs/M0-server-setup.md`（附录 A）

---

## 1. 目录结构（当前实际落地）

```
zhiwuwo/
├── apps/
│   ├── api/                      # 后端（Python + FastAPI）
│   │   ├── app/
│   │   │   ├── app_factory.py    # 创建 FastAPI 应用（CORS、路由、生命周期建表）
│   │   │   ├── core/             # 配置(config) 与 安全(security: JWT/密码)
│   │   │   ├── db/               # 连接(session) 与 ORM 模型(models)
│   │   │   ├── schemas/          # Pydantic 请求/响应模型
│   │   │   ├── services/         # 解析、调度、对话、记录服务
│   │   │   └── api/routers/      # auth / records / chat / parser
│   │   ├── main.py               # uvicorn 入口（main:app）
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── tests/                # pytest（35 项，含对话/AI 回退）
│   ├── web/                      # Web 前端（React + Vite + TS）
│   │   ├── src/                  # api.ts / types.ts / components（对话、卡片）
│   │   ├── nginx.conf            # 18080 站点、ACME 目录、/api 反代
│   │   ├── https.conf            # 18443 站点（由 start.sh 挂载）
│   │   └── Dockerfile
│   └── mobile/                   # 移动端（React Native + Expo SDK 56）
│       ├── app/                  # Expo Router 文件路由：(auth) / (app)
│       ├── src/                  # api / auth / components / theme / config
│       ├── app.config.ts         # 权限文案、最低系统、build properties
│       ├── eas.json              # preview（内测）/ production
│       ├── metro.config.js       # monorepo watchFolders
│       └── tsconfig.json         # @/* 与 @zhiwuwo/shared 别名
├── packages/
│   ├── api-schema/               # OpenAPI 契约源（openapi.json / openapi.yaml）+ export.sh
│   └── shared/                   # 纯 TS 共享代码（类型、API client、格式化、文案）
│       └── src/
├── deploy/
│   ├── start.sh / stop.sh        # 启动/停止脚本（docker run 手动）
│   ├── init-certs.sh             # 自签占位证书
│   ├── issue-cert.sh             # Let's Encrypt 正式证书
│   ├── check-domain.sh           # 签发前域名/80 端口检查
│   ├── certs/                    # 证书（含私钥，已忽略）
│   └── certbot/                  # ACME 工作目录（已忽略）
├── docs/                         # 规划/操作/规范文档
├── .env.example                  # 环境变量模板（提交）
├── .gitignore
├── LICENSE
├── README.md
└── TODO.md
```

### 各端约定
- **后端 api**：构建上下文为 `apps/api`；`start.sh` 将 `apps/api` 挂载进容器 `/app`，改代码 `docker restart api` 即可生效，无需重新 build（build 仅用于安装依赖）。
- **Web**：源码放 `apps/web/src`，构建产物 `dist/` 不提交；`nginx.conf` / `https.conf` 需提交，由 `start.sh` 挂载进容器。
- **移动端**：React Native + Expo SDK 56（CNG）。采用 `app/` 文件路由 + `src/` 逻辑与组件；`ios/`、`android/` 由 `npx expo prebuild` 生成，**不提交**。原生配置只改 `app.config.ts`。
- **共享代码**：`packages/api-schema/openapi.json` 是接口唯一事实源；`packages/shared` 是纯 TS 共享层，Web/App 通过别名直接引用源码，不生成代码、不发布 npm 包。
- **证书**：`deploy/certs/`、`deploy/certbot/` 含私钥，已在 `.gitignore` 中忽略，禁止提交。

---

## 2. 忽略规范（.gitignore 要点）

| 类别 | 忽略项 | 说明 |
|---|---|---|
| 环境变量 | `.env`、`.env.*` | 含密钥，禁止提交；`.env.example` 用 `!.env.example` 强制保留 |
| Python | `__pycache__/`、`.venv/`、`*.pyc`、`.pytest_cache/`、`.coverage`、`*.db` | 含本地 SQLite（如 `apps/api/dev.db`） |
| Node | `node_modules/`、`dist/`、`build/`、`.vite/`、`.npmrc`、`coverage/` | Web 端；`.npmrc` 可能含 registry token |
| 移动端 | `.expo/`、`ios/`、`android/`、`.gradle/`、`Pods/`、`*.jks`、`*.p8`、`*.p12`、`credentials.json`、`*.apk`、`*.aab`、`*.ipa`、`*.hbc` | CNG 生成目录、签名材料与安装包产物 |
| 共享包 | `packages/api-schema/generated/` | 生成代码不提交 |
| 密钥 / 证书 | `deploy/certs/`、`deploy/certbot/`、`*.pem`、`*.key`、`*.crt`、`*.pfx`、`id_rsa*` | 含私钥与 ACME 状态，禁止提交 |
| 产物 / 日志 | `*.log`、`logs/`、`.data/`、`*.sqlite3`、`*.bak`、`*.tmp` | 运行期产物与备份文件 |
| 系统 / IDE | `.DS_Store`、`.idea/`、`.vscode/*`、`.codebuddy/`、`.history/`、`.cursor/` | IDE / AI 工具本地数据；`!.vscode/settings.json` 例外放行供团队共享；**只忽略，不删除 `.codebuddy/`** |

### 必须提交 / 必须忽略 对照
- ✅ 提交：`requirements.txt`、`openapi.json` / `openapi.yaml`、`package-lock.json`、`packages/shared/src/`、各端源码与配置（`app.config.ts`、`eas.json`、nginx 配置）、`.env.example`、脚本
- ❌ 忽略：依赖目录、构建产物、原生生成目录、证书私钥、签名材料、密钥、本地数据库与日志、IDE 本地数据

---

## 3. 新增目录/文件时的检查清单
1. 新依赖写入对应 `requirements.txt` / `package.json`，勿手改提交 `node_modules/`。
2. 密钥一律走 `.env`，不要在代码或文档中硬编码。
3. 跨端共享的接口变更，先执行 `bash packages/api-schema/export.sh` 更新契约，再同步 `packages/shared/src/types.ts` 与 `client.ts`。
4. 移动端的原生配置改动只写 `app.config.ts`，不要提交 `ios/`、`android/`。
5. 生成物（如 API 客户端、构建产物）放入忽略目录，勿误提交。
