# 移动端规划与实施说明（M4）

> 最后更新：2026-11-05
> 适用范围：`apps/mobile`（iOS / Android）
> 关联：[`docs/PLAN.md`](./PLAN.md) §9、[`docs/https-setup.md`](./https-setup.md)、[`TODO.md`](../TODO.md)、[`apps/mobile/README.md`](../apps/mobile/README.md)

---

## 1. 已锁定的决策

| 决策项 | 结论 | 理由 |
|---|---|---|
| 跨端框架 | **React Native + Expo SDK 56** | Web 已是 React + TS，可共享类型/请求逻辑/文案；Expo CNG 免去维护原生工程 |
| 路由 | Expo Router 6（文件路由） | 与 Expo 工具链一致，鉴权分组 `(auth)` / `(app)` 清晰 |
| 构建 | EAS Build | iOS 无需本地 Mac 即可出 TestFlight 包；Android 直接出内测 APK |
| 发布目标 | **只做内测**：iOS TestFlight + Android 内测 APK | 不启动 App Store / 应用商店正式上架、软著、备案流程 |
| HTTPS | **纳入第一阶段（M4.0）** | iOS ATS、Android 默认禁止明文；真机连服务器的前提 |
| 最低系统 | **iOS 16.4+ / Android 10+（API 29）** | 与 Expo SDK 56 默认下限一致，覆盖内测设备最广 |
| 首版范围 | **仅 M4.0 + M4.1** | 一周出真机对话版；录音/拍照只做权限声明与 UI 占位 |

### 1.1 关于「iOS 20+」的更正

用户初稿写的是 `iOS 20+ / Android 10+`。Apple **从未发布 iOS 19–25**：2024 年发布 iOS 18 后，2025 年起改用年份命名，直接跳到 **iOS 26**。因此 `iOS 20+` 不是有效的最低版本。三者要区分清楚：

| 概念 | 本项目取值 | 说明 |
|---|---|---|
| Deployment Target（最低可安装系统） | **iOS 16.4** | 用户设备要求；Expo SDK 56 默认下限 |
| Build SDK（打包用的 SDK） | iOS 26 SDK / Xcode 26.4+ | 构建机要求，由 EAS 提供，与用户设备版本无关 |
| Expo SDK 版本 | 56 | 框架版本，不是手机系统版本 |

Android 同理：`minSdkVersion=29`（Android 10+），`targetSdkVersion=36` / `compileSdkVersion=36`（对应 2026-08-31 起 Google Play 的 API 36 要求）。

---

## 2. 里程碑拆分

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M4.0** | 域名 `zhiwuwo.com` + nginx 18080/18443（非常用端口）+ 自签占位证书 + Let's Encrypt 签发脚本；OpenAPI 契约导出（7 个端点） | ✅ 已完成（自签证书已就绪，正式证书待 DNS/签发期临时开放公网 80） |
| **M4.1** | Expo SDK 56 工程、`packages/shared` 共享逻辑、登录/注册、JWT 安全存储、文字对话、位置卡片与确认、记录列表、设置页、权限与 UI 占位 | ✅ 代码完成，待真机回归 |
| **M4.2** | 语音录入（ASR）、拍照/相册录入（Vision）与上传闭环 | ⬜ 仅预留权限声明与占位 |
| **M4.3** | APNs / FCM 推送 | ⬜ 规划中 |
| **M4.4** | 正式上架物料与签名策略 | ⬜ 本阶段不启动 |

M4.0 的 HTTPS 明细见 [`docs/https-setup.md`](./https-setup.md)。

---

## 3. 架构与复用边界

```
[Web apps/web]                 [App apps/mobile]
   React DOM 组件                 React Native 组件
        └──────── 共用 packages/shared ────────┘
                 类型 / API client / 格式化 / 文案
                          │
                     HTTPS（同源 /api）
                          │
              nginx 443 → apps/api（FastAPI）
```

**可以复用**：OpenAPI 类型、请求封装、错误归一化、日期/置信度格式化、示例问句、模式文案（`packages/shared/src`）。

**不能复用**：JSX 视图组件。Web 用 `div/css`，App 用 `View/Text/StyleSheet`，两套组件分别维护，但保持同样的交互与文案。

**共享方式**：仓库未引入 pnpm/yarn workspace，`apps/mobile/tsconfig.json` 用 `paths` 把 `@zhiwuwo/shared` 指到 `packages/shared/src/index.ts`，`apps/mobile/metro.config.js` 把仓库根加入 `watchFolders`。没有构建步骤，也不会误提交生成代码。

---

## 4. 首版功能清单（M4.1）

- 登录 / 注册（复用 `/auth/login`、`/auth/register`），JWT 存 `expo-secure-store`。
- 对话页：默认「智能」模式，直接说「我的护照在哪里」或「把雨伞放阳台」，由 `/api/v1/chat` 自动判断意图；可手动切「录入 / 查询」。
- 回答用自然语言 + 位置卡片（物品 / 位置 / 日期 / 备注 / 置信度）；低置信度可点「确认这条记录」调 `/records/{id}/confirm`。
- 记录列表：下拉刷新、确认。
- 设置页：账号、服务器地址、解析后端状态、最低系统版本、登出。
- 健壮性：断网 / 401 / 5xx 分别给出可读文案；401 自动清会话回到登录页。
- 权限占位：`app.config.ts` 声明麦克风/相机/相册用途说明；对话页「语音」「拍照」按钮只弹「即将上线」提示，设置页展示能力占位卡片。**不请求权限、不采集、不上传**。

---

## 5. 原生配置要点（`app.config.ts`）

| 配置 | 值 |
|---|---|
| `ios.bundleIdentifier` / `android.package` | `com.zhiwuwo.app` |
| 新架构 | 默认启用 | Expo SDK 56 / RN 0.85 已默认开启，`newArchEnabled` 不再是有效配置项 |
| `ios.deploymentTarget`（`expo-build-properties`） | `16.4` |
| `android.minSdkVersion` / `compileSdkVersion` / `targetSdkVersion` | `29` / `36` / `36` |
| `EXPO_PUBLIC_API_BASE_URL` | 默认 `https://zhiwuwo.com:18443`（非标准端口必须显式写），`.env.local` 可覆盖 |
| iOS 权限文案 | 麦克风 / 相机 / 相册，均注明「M4.2 启用」 |
| Android 权限 | `RECORD_AUDIO` / `CAMERA` / `READ_MEDIA_IMAGES` |

采用 **CNG**：不提交 `ios/`、`android/`，原生工程由 `npx expo prebuild` 生成，配置改动只改 `app.config.ts`。

---

## 6. 构建与内测分发

`eas.json` 只保留两个 profile：

- `preview`（`distribution: internal`）：Android `apk`、iOS 真机包，固定 `EXPO_PUBLIC_API_BASE_URL=https://zhiwuwo.com:18443`。内测用这个。
- `production`：Android AAB / 正式提交配置，**本阶段不执行**。

```bash
cd apps/mobile
npm i -g eas-cli && eas login
eas build --platform android --profile preview   # 内测 APK
eas build --platform ios --profile preview       # TestFlight 包
```

iOS 需 Apple Developer 账号；Android 内测 APK 可直接分发安装。命令细节见 `apps/mobile/README.md`。

---

## 7. 前置依赖与验收

### 7.1 服务端（M4.0）

- [x] `DOMAIN=zhiwuwo.com` 写入 `.env` / `.env.example`
- [x] nginx 对外只提供 `18080` / `18443`（不使用 80 / 443 / 8080），容器内监听同端口
- [x] ACME challenge 目录 `/.well-known/acme-challenge/` 可经 18080 访问
- [x] `/api/`、`/health`、`/openapi.json` 均可反代到 `api:8000`
- [x] 自签占位证书 + `init-certs.sh` / `issue-cert.sh` / `check-domain.sh`
- [x] `issue-cert.sh` 在签发/续期时临时开放公网 80 并自动回收
- [x] `deploy/certs/`、`deploy/certbot/` 加入 `.gitignore`
- [ ] **待用户侧**：域名 A 记录指向服务器、签发期公网 80 可达 → 执行 `./deploy/issue-cert.sh` 换成受信任证书

> 自签证书只能保证 nginx 启动；真机不信任，iOS ATS 会拒绝，不能用于内测。

### 7.2 客户端（M4.1）

- [x] Expo SDK 56 / Router 6 / EAS 配置 / monorepo Metro 配置
- [x] `packages/shared` 类型、API client、格式化
- [x] 登录、对话、记录、设置四个页面与 RN 组件
- [x] 权限声明与 UI 占位
- [x] `npm install && npm run typecheck` 全绿；`packages/shared` 独立 `tsc --noEmit` 全绿（Node 22）
- [x] `npx expo export --platform android / ios` 双端 Metro 打包通过（各 975 模块，验证路由与 `@zhiwuwo/shared` 别名解析）
- [x] `npx expo config --type public` 可正常解析权限、最低系统与插件配置
- [ ] iOS 真机 + Android 真机跑通「注册 → 录入 → 查询 → 确认 → 登出」
- [ ] EAS `preview` 出包并安装测试

---

## 8. 风险与应对

| 风险 | 应对 |
|---|---|
| 域名解析 / 80 端口未放行，正式证书签不下来 | `check-domain.sh` 先诊断；内测前必须换成受信任证书，否则 iOS 连不上 |
| EAS 构建机 iOS 26 SDK / Xcode 26 版本不匹配 | 用 EAS 托管构建，不依赖本地 Xcode；锁定 `image` 后在 eas.json 固定 |
| `ios/`、`android/` 被误提交导致 CNG 冲突 | `.gitignore` 已忽略，改配置只改 `app.config.ts` |
| 权限提前声明被内测用户误解为已在采集 | 文案注明「M4.2 启用」，UI 点击明确提示未上线 |
| App 与 Web 接口漂移 | 以 `packages/api-schema/openapi.json` 为唯一事实源，变更后同步 `packages/shared/src/types.ts` |
