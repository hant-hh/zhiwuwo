# 置物窝（zhiwuwo）功能待办清单

> 用法：完成一项功能后，将 `- [ ]` 改为 `- [x]` 并记录完成日期。
> 关联规划文档：`docs/PLAN.md`
> 状态图例：⬜ 未开始 · 🔧 进行中 · ✅ 已完成

---

## 阶段零 · M0 基础设施（约 1 周）

- [x] monorepo 初始化（apps/web、apps/mobile、apps/api、packages/api-schema、packages/shared、deploy）
  - 验收：仓库可克隆，三个 app 目录与共享包目录就绪（完成 2026-11-05）
- [x] Docker（docker run 手动 + 启动脚本）开发环境（后端 + PostgreSQL + Redis + MinIO + Web/nginx）
  - 验收：`./deploy/start.sh` 后 HTTP 18080、HTTPS 18443、API `/health` 全部可达（完成 2026-11-05）
- [ ] CI 流水线（lint → 测试 → 构建镜像）
  - 验收：推送后 CI 自动跑通
- [x] `.env.example` 环境参数模板
  - 验收：含数据库/对象存储/AI/推送/跨域/域名/证书邮箱变量（完成 2026-11-05）
- [x] 后端语言选型最终确认（Java vs Python，见 PLAN §5）
  - 验收：定档 Python + FastAPI，理由见 PLAN §5.2（完成 2026-11-04）
- [x] 移动端跨端框架选型确认（RN vs Flutter，见 PLAN §9.2）
  - 验收：定档 React Native + Expo SDK 56 / Expo Router 6 / EAS Build，理由见 `docs/mobile-plan.md`（完成 2026-11-05）

---

## 阶段一 · M1 MVP（约 2–3 周）

- [x] 后端骨架（路由、JWT 鉴权、数据库迁移）
  - 验收：注册/登录/基础 CRUD 接口可用，OpenAPI 文档自动生成（完成 2026-11-04）
- [x] 数据模型落地（User / Family / Item / ItemRecord / MediaAsset / Conversation / Message / SyncLog）
  - 验收：迁移脚本可执行，外键与索引合理（完成 2026-11-04）
- [x] Web 端对话式界面（参考 DeepSeek 风格）
  - 验收：可输入文字、展示对话气泡（完成 2026-11-04，React+Vite+TS）
- [x] 文字录入 + RuleParser 解析（物品/位置/日期）
  - 验收："把护照放书房抽屉" → 解析出 item=护照、location=书房（嵌套位置树细化见 M2）
- [x] 查询接口 + Web 端查询展示（位置卡片）
  - 验收："护照在哪" → 返回位置卡片，含物品/位置/日期/置信度
- [x] 对话式助手：统一 `/chat` 接口 + 中文口语理解 + 自动意图识别 + 自然语言回答
  - 验收："我的电脑在哪里" 直接命中；无需手动切换录入/查询（完成 2026-11-04，见 `docs/chat-assistant.md`）
- [x] 后端单元测试（RuleParser / Agnes / 对话 / API 集成测试，pytest）
  - 验收：全量测试全绿（完成 2026-11-04）

---

## 阶段二 · M2 多模态（约 2–3 周）

- [ ] 语音录入 + ASR 转文字（预留 `ASR_API_KEY` 接口）
  - 验收：录音上传 → 转文字 → 进入解析管道
- [ ] 照片录入 + 视觉抽取（预留 Vision 接口）
  - 验收：上传照片 → 抽取物品/位置/拍摄时间
- [ ] 视频录入（抽帧 + 语音轨道 ASR）
  - 验收：上传短视频 → 解析出物品/位置/日期
- [ ] 低置信度确认机制
  - 验收：confidence < 阈值 → 弹确认卡，用户确认/修正后入库
- [ ] 规则解析完善（日期相对/绝对、位置树实体匹配、别名/同义词）
  - 验收：覆盖常见表达，准确率达标

---

## 阶段三 · M3 家庭共享（约 2 周）

- [ ] 账号体系完善（用户信息、头像）
  - 验收：资料可编辑
- [ ] 家庭组（创建/加入/邀请码）
  - 验收：成员凭邀请码加入家庭
- [ ] 成员角色与权限（owner/member）
  - 验收：成员仅可见本家庭记录，创建者可管理成员
- [ ] 成员记录共享展示
  - 验收：A 记录后 B 在 Web/App 可见

---

## 阶段四 · M4 移动端 App（约 3–4 周，首版约 1 周）

> 决策：只做内测（TestFlight + 内测 APK），不上架；首版范围 **仅 M4.0 + M4.1**；最低系统 iOS 16.4+ / Android 10+。详见 `docs/mobile-plan.md`。

### M4.0 域名 / HTTPS / 契约（App 连服务器的前提）

- [x] `DOMAIN=zhiwuwo.com` 写入 `.env` / `.env.example`，`CORS_ORIGINS` 加入带 `:18443` 的来源
- [x] 对外端口改为 `18080` / `18443`（不使用 80 / 443 / 8080），容器内 nginx 同步改监听
  - 验收：HTTP 18080=200、HTTPS 18443=200、平时 80 不开放、`nginx -t` 通过（完成 2026-11-06）
- [x] ACME challenge 目录 + 自签占位证书 + 签发/检查脚本
  - 验收：`/.well-known/acme-challenge/` 经 18080 可达；`issue-cert.sh` 签发/续期时临时开放公网 80 并自动回收
- [x] `/health`、`/openapi.json` 也可经域名反代（App 登录页「测试连接」用）
- [x] 证书私钥与 ACME 工作目录加入 `.gitignore`
- [x] 导出 OpenAPI 契约（7 个端点）到 `packages/api-schema`
- [ ] **待外部条件**：域名 A 记录生效 + 签发期公网 80 可达后执行 `./deploy/issue-cert.sh` 换成受信任证书
  - 验收：`curl https://zhiwuwo.com:18443/health` 无 `-k` 也返回 200
  - 操作手册：`docs/https-setup.md`

### M4.1 Expo 登录 + 文字对话内测版

- [x] Expo SDK 56 工程：`app.config.ts` / `eas.json` / `tsconfig.json` / `metro.config.js` / `babel.config.js`
  - 验收：iOS 16.4+ / Android 10+（API 29）、targetSdk 36、CNG 不提交原生目录（完成 2026-11-05）
- [x] `packages/shared` 纯 TS 共享层：类型、API client、错误归一、格式化、文案
- [x] 登录/注册 + `expo-secure-store` 存 JWT + 401 自动登出
- [x] 对话页：智能/录入/查询、自然语言回答、位置卡片、低置信度确认
- [x] 记录列表（下拉刷新）与设置页（服务状态、登出）
- [x] 录音/拍照权限声明与 UI 占位（不请求权限、不采集、不上传）
  - 验收：iOS 权限文案 + Android 权限声明齐备；点击占位按钮提示「即将上线」
- [x] `npm install` / `tsc --noEmit` / `npx expo export` 双端打包 / `expo config` 均通过（完成 2026-11-05）
- [ ] iOS / Android 真机回归：注册 → 录入 → 查询 → 确认 → 登出
- [ ] EAS `preview` 出包：Android 内测 APK + iOS TestFlight 安装验证

### M4.2 / M4.3 / M4.4（后续，不在首版）

- [ ] 原生能力：麦克风录音 + ASR、相机/相册/录像 + Vision（M4.2）
  - 验收：录音/拍照可采集并上传，进入解析管道
- [ ] 原生能力：推送通知 APNs / FCM（M4.3）
  - 验收：成员记录后其他端收到推送
- [ ] App 发布准备（签名、上架物料、版本更新策略，仅文档层面，M4.4）
  - 验收：发布清单与回滚方案就绪；**内测阶段不启动正式上架**

---

## 阶段五 · M5 同步与 AI（约 2–3 周）

- [ ] 多端增量同步（SyncLog 游标、离线暂存、last-write-wins）
  - 验收：断网录入，联网后增量同步且冲突按时间戳解决
- [ ] 实时推送（WebSocket 升级 REST）
  - 验收：A 端记录，B 端实时可见
- [x] LLM/Vision 解析接入（实现 ParserInterface，替换 RuleParser 配置）
  - 验收：切换配置即可启用 AI 解析，业务层无改动（完成 2026-11-04，提前到 M1：接入 Agnes 2.5 Flash 文字解析 + 调度器 + 失败回退；Vision 待 M2，见 `docs/ai-parser-setup.md`）
- [ ] 隐私合规：媒体上传授权开关 + 隐私声明
  - 验收：未授权不调用第三方 AI

---

## 收尾与质量

- [ ] 非功能需求落地（安全隔离、备份、兼容性）
  - 验收：家庭数据隔离测试通过，DB 备份可恢复
- [ ] 测试覆盖（后端单测 + 集成测试，前端组件测试，真机回归清单）
  - 验收：核心路径有自动化测试
- [ ] 部署上线（dev/staging/prod 环境划分）
  - 验收：生产环境可用且监控就绪

---

_最后更新：2026-11-05 — 同步 M0 选型结论、M4.0 域名/HTTPS/契约落地与 M4.1 移动端内测版代码；正式证书与真机回归仍待外部条件。_
