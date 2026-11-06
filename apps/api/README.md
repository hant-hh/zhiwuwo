# apps/api

置物窝后端服务。语言经 PLAN §5 评估后确定（推荐 Python + FastAPI，或 Java + Spring Boot）。

职责：
- 提供统一 REST API（Web / iOS / Android 共用）
- 多模态解析调度（RuleParser 默认，预留 LLM/Vision 接口）
- 数据存储：PostgreSQL + Redis + 对象存储
- 容器化：基于 `deploy/start.sh` 构建 `zhiwuwo-api` 镜像运行

## 约定
- 构建上下文为 `apps/api`（见 `deploy/start.sh`）
- 环境变量来自仓库根目录 `.env`（`--env-file` 注入）
