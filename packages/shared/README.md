# @zhiwuwo/shared

Web（`apps/web`）与移动端（`apps/mobile`）共用的**纯 TypeScript**代码，不含任何 React / DOM / React Native 依赖，只依赖全局 `fetch`。

| 文件 | 内容 |
|---|---|
| `src/types.ts` | 与 `packages/api-schema/openapi.json` 对应的请求/响应类型 |
| `src/client.ts` | `createApiClient()` 工厂、`ApiError`（区分断网 / 401 / 5xx） |
| `src/format.ts` | 日期、置信度、位置摘要、错误文案、示例问句、模式文案 |

## 为什么是纯 TS

React DOM 组件与 React Native 组件不能互相复用，但**接口契约、请求逻辑、数据格式化**可以。各端只负责注入自己的 `baseUrl` 与 token 读取方式：

```ts
import { createApiClient } from '@zhiwuwo/shared'

const api = createApiClient({
  baseUrl: 'https://zhiwuwo.com:18443',
  getToken: () => currentToken(),
  onUnauthorized: () => signOut(),
})
```

本仓库没有引入 pnpm/yarn workspace，移动端通过 `tsconfig.json` 的 `paths` 别名直接引用源码（见 `apps/mobile/tsconfig.json`），并用 `apps/mobile/metro.config.js` 把仓库根加入 `watchFolders`。因此**不需要 npm link，也不需要构建步骤**。

## 类型检查

```bash
cd packages/shared && npx tsc --noEmit
```

## 契约同步

后端接口变更后执行 `bash packages/api-schema/export.sh`，再按新的 `openapi.json` 更新 `src/types.ts` 与 `src/client.ts`。
