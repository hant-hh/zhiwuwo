# apps/mobile · 置物窝移动端

React Native + **Expo SDK 56**（Expo Router 6 / React 19.2 / RN 0.85），iOS 与 Android 同一套代码。当前为 **M4.0 + M4.1 内测版**：登录/注册 + 文字对话 + 位置卡片 + 记录列表；录音与拍照只预留权限声明和 UI 占位，不做上传闭环。

> 决策背景与里程碑见 [`docs/mobile-plan.md`](../../docs/mobile-plan.md)，接口契约见 [`packages/api-schema/openapi.json`](../../packages/api-schema/openapi.json)。

## 1. 环境要求

| 项 | 要求 |
|---|---|
| Node.js | 22 LTS（Expo SDK 56 建议） |
| iOS 真机 | iOS 16.4+；构建机 Xcode 26.4+ / iOS 26 SDK |
| Android 真机 | Android 10+（API 29）；`targetSdkVersion=36` |
| 服务端 | `https://zhiwuwo.com:18443` 已配好**受信任证书**；对外仅开放 18080 / 18443（见 [`docs/https-setup.md`](../../docs/https-setup.md)） |
| EAS CLI | `npm i -g eas-cli`；`eas login` |

自签占位证书只能让 nginx 启动，**真机不能信任**，iOS ATS 会直接拒绝连接。内测前务必先签发 Let's Encrypt 证书。

## 2. 快速开始

```bash
cd apps/mobile
cp .env.example .env.local       # 默认 https://zhiwuwo.com:18443
npm install
npx expo start                   # 用 Expo Go 或 development build 扫码
```

真机调试时把 `EXPO_PUBLIC_API_BASE_URL` 指向服务端 HTTPS 地址，**非标准端口 `:18443` 必须显式写出**；不要用 `http://局域网IP:8000`（iOS ATS 默认禁止明文），也不要漏写端口写成 `https://zhiwuwo.com`。

类型检查：

```bash
npm run typecheck                # tsc --noEmit
cd ../../packages/shared && npx tsc --noEmit
```

## 3. 目录说明

```
apps/mobile/
├── app/                         # Expo Router 文件路由
│   ├── _layout.tsx              # SafeAreaProvider + AuthProvider + StatusBar
│   ├── +not-found.tsx
│   ├── (auth)/                  # 未登录分组（已登录自动跳到 "/"）
│   │   ├── _layout.tsx
│   │   └── login.tsx            # 登录 / 注册 / 服务器连通性自检
│   └── (app)/                   # 已登录分组（未登录自动跳到 "/login"）
│       ├── _layout.tsx          # Tabs + 鉴权守卫
│       ├── index.tsx            # 对话页（智能/录入/查询）
│       ├── records.tsx          # 记录列表 + 下拉刷新 + 确认
│       └── settings.tsx         # 账号/服务状态/后续能力占位/登出
├── src/
│   ├── config.ts                # API 地址与版本常量
│   ├── theme.ts                 # 配色/间距
│   ├── api/client.ts            # createApiClient + 401 回调注册
│   ├── auth/token.ts            # expo-secure-store 存 JWT（进程内缓存供同步读取）
│   ├── auth/AuthContext.tsx     # 会话恢复、登录/注册/登出、401 自动登出
│   └── components/              # ChatBubble / RecordCard / Composer / FeaturePlaceholder / BootScreen
├── app.config.ts                # bundleId、权限文案、最低系统、build properties
├── eas.json                     # preview（内测）/ production 构建 profile
├── metro.config.js              # monorepo：把仓库根加入 watchFolders
└── tsconfig.json                # @/* 与 @zhiwuwo/shared 别名
```

采用 **Expo CNG（Continuous Native Generation）**：`ios/` 与 `android/` 由 `npx expo prebuild` 生成，**不提交进 Git**。原生配置全部写在 `app.config.ts` 的 `plugins` / `expo-build-properties` 中。

## 4. 跨端复用

Web 与 App 共享 `packages/shared`（纯 TS：类型、API client、格式化工具、文案），通过 `tsconfig.paths` + `metro.config.js` 直接引用源码，无需 npm link 或构建步骤。

**不复用** DOM/JSX 组件：`apps/web/src/components/*` 是 React DOM，App 使用 `src/components/*` 的 React Native 版本。两端只共享逻辑，不共享视图。

App 只调用这些接口（与 OpenAPI 一致）：

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/v1/auth/register` `/auth/login` | 注册/登录，拿到 JWT |
| POST | `/api/v1/chat` | 智能对话（自动判断录入/查询） |
| GET | `/api/v1/records?q=` | 记录列表 |
| POST | `/api/v1/records/{id}/confirm` | 低置信度确认 |
| GET | `/api/v1/parser/status` | 设置页展示解析后端 |
| GET | `/health` | 登录页「测试连接」 |

JWT 存在 `expo-secure-store`（iOS Keychain / Android Keystore），每次请求自动带 `Authorization: Bearer`；401 会清会话并跳回登录页。

## 5. 内测构建与分发

```bash
npm i -g eas-cli
eas login
eas build:configure

# Android 内测 APK
eas build --platform android --profile preview
# 产物为 .apk，直接发给内测用户安装

# iOS TestFlight 内测
eas build --platform ios --profile preview
eas submit --platform ios --latest     # 或手动在 App Store Connect 上传
```

- `preview`：`distribution: internal`，Android 出 APK，iOS 出真机包，并把 `EXPO_PUBLIC_API_BASE_URL` 固定为 HTTPS 域名。
- `production`：Android AAB，供未来正式上架使用；**本阶段不执行**。
- 首次 iOS 构建需 Apple Developer 账号与 bundleId `com.zhiwuwo.app`。
- 本地调试原生代码：`npx expo prebuild` 后用 Xcode / Android Studio 打开生成目录。

## 6. 权限占位（M4.2 才启用）

`app.config.ts` 已声明但**代码不请求、不采集、不上传**：

| 平台 | 声明 |
|---|---|
| iOS | `NSMicrophoneUsageDescription` / `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` |
| Android | `RECORD_AUDIO` / `CAMERA` / `READ_MEDIA_IMAGES` |

对话页底部「语音」「拍照」按钮点击后仅提示「即将上线」；设置页有对应的能力占位卡片。M4.2 接入时无需再改原生配置。

## 7. 常见问题

- **登录页「测试连接」失败**：先执行 `./deploy/check-domain.sh`；确认 `curl -sk https://zhiwuwo.com:18443/health` 返回 JSON（nginx 已配置 `/health` 反代，端口不能漏）。
- **iOS 报 `ATS` / 无法连接**：说明用了 `http://` 或自签证书，换成受信任证书的 HTTPS 域名。
- **Android 报 `cleartext` 拒绝**：同上。
- **Metro 找不到 `@zhiwuwo/shared`**：确认从 `apps/mobile` 启动，且 `metro.config.js` 存在；改过配置后 `npx expo start -c` 清缓存。
