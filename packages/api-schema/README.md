# packages/api-schema

跨端共享的 API 契约。

- 存放 OpenAPI 规范（如 `openapi.yaml`）
- 由各端据此生成类型/客户端（Web、移动端共用，保证契约一致）
- 修改后需同步更新各端生成代码
