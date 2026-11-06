# 置物窝（zhiwuwo）项目规划文档

> 版本：v0.2（规划 + 已落地状态同步）
> 最后更新：2026-11-05
> 状态：M1 Web/后端 MVP 已完成；M4.0 域名与 HTTPS 已落地；M4.1 移动端内测版代码已完成，待真机回归
> 移动端实施明细见 `docs/mobile-plan.md`，HTTPS 实操见 `docs/https-setup.md`

---

## 1. 项目概述

"置物窝"（zhiwuwo）是一款帮助用户记录和查找物品存放位置的网站及多端应用。前端界面参考 DeepSeek 的对话式页面风格，用户以"对话"的方式与系统交互：随时告诉系统物品放在哪里，忘记时向系统询问即可找回。

核心价值主张：

- **记录零负担**：支持语音、文字、照片、视频多种录入方式，系统自动解析出"什么物品 / 放在哪 / 什么时候放的"。
- **查找秒回**：忘记物品位置时，用自然语言提问，系统直接返回位置卡片（含时间、记录人、照片）。
- **家庭共享**：同一家庭成员共享物品存放记录，互相可见，省去电话询问。
- **多端一致**：Web、iOS、Android 共享同一后端与数据库，数据实时同步。

---

## 2. 产品定位与用户角色

### 2.1 目标用户

- 家庭成员（核心）：记性不好、经常找不到遥控器/钥匙/证件的人。
- 合租/宿舍群体：多人共用空间，共享物品存放信息。
- 轻度收藏/库存管理用户（延伸场景）。

### 2.2 用户角色

| 角色 | 说明 | 权限 |
|---|---|---|
| 家庭创建者（Owner） | 创建家庭组、邀请成员、管理成员 | 全部读写 + 成员管理 |
| 家庭成员（Member） | 被邀请加入，记录/查询物品 | 本家庭记录读写 |
| 系统/匿名 | 未登录用户仅可浏览落地页 | 无数据访问 |

### 2.3 典型用户流程

**记录流程**
```
用户：我把护照放在书房第二个抽屉里了（语音或文字）
  → 系统解析：物品=护照，位置=书房>抽屉2，时间=今天
  → 高置信度 → 直接入库，回复"已记录✅"
  → 低置信度 → 弹出确认卡："是放在【书房-第二个抽屉】吗？" → 用户确认/修正后入库
```

**查询流程**
```
用户：我护照放哪了？
  → 意图识别=查询物品
  → 检索匹配"护照"（含别名/同义词）
  → 返回位置卡片：护照 · 书房-第二个抽屉 · 由 张三 于 11-04 记录 · [照片]
```

**家庭共享流程**
```
成员A 记录"钥匙在玄关挂钩" → 成员B 打开 App 即可看到该记录
成员B 问"钥匙在哪" → 系统返回 A 的记录
```

---

## 3. 核心功能详述

### 3.1 多模态录入与解析

| 输入方式 | 处理方式 | 解析产出 |
|---|---|---|
| 文字 | 直接送入解析器 | 物品、位置、日期、备注 |
| 语音 | 先 ASR 转文字（预留 `ASR_API_KEY`），再走文字解析 | 同上 |
| 照片 | 视觉模型抽取（预留 Vision 接口）或从 EXIF/场景识别位置 | 物品、位置、拍摄时间 |
| 视频 | 抽帧 + 语音轨道 ASR + 视觉抽取 | 物品、位置、日期 |

解析产出结构（统一）：`{ item, location(层级), placed_at(日期), note, confidence }`。

### 3.2 物品查找问答

- 自然语言提问 → 意图识别（查询/记录/其他）。
- 检索匹配：物品名 + 别名 + 同义词词典；支持模糊匹配（"我那个黑色的遥控器"）。
- 返回位置卡片：物品、位置、记录人、时间、关联媒体。
- 未命中时：引导用户补充记录，而非报错。

### 3.3 家庭共享

- 家庭组（Family）+ 成员关系（FamilyMember，含角色）。
- 成员记录默认对本家庭可见；提供"私密物品"开关（仅自己可见）作为可选增强。
- 成员加入：邀请码 / 链接；创建者审批或开放加入（可配置）。

### 3.4 多端数据同步

- 所有端（Web / iOS / Android）访问同一 REST API 与数据库。
- 客户端本地缓存 + 离线暂存；联网后增量同步，冲突以服务端时间戳为准（last-write-wins）。
- 同步游标（SyncLog）记录每个端最后拉取位置，支持增量拉取。

---

## 4. 代码仓库组织

采用 **Monorepo（单仓库）** 方案（已与团队确认倾向）。

### 4.1 目录结构

```
zhiwuwo/
├── apps/
│   ├── web/             # React + Vite + TS，对话式 Web（nginx 托管静态资源并反代 /api）
│   ├── mobile/          # React Native + Expo SDK 56，Expo Router 文件路由（CNG，不提交 ios/ android/）
│   └── api/             # Python + FastAPI（第 5 章评估结论已定档）
├── packages/
│   ├── api-schema/      # OpenAPI 契约源（openapi.json / openapi.yaml）+ 导出脚本
│   └── shared/          # 纯 TS 共享代码：类型、API client、格式化、文案
├── docs/                # 规划与设计文档
├── deploy/              # 启动脚本（docker run 手动）/ 证书与 ACME 脚本
└── .env.example         # 环境参数模板
```

> `packages/shared` 通过 `apps/mobile/tsconfig.json` 的 `paths` 与 `metro.config.js` 直接引用源码，无 workspace/npm link、无构建步骤。

### 4.2 Monorepo vs 多仓库对比

| 维度 | Monorepo | 多仓库（polyrepo） |
|---|---|---|
| API 契约同步 | 强（同一仓库共享 schema） | 弱（需独立发布/版本对齐） |
| CI 复用 | 一次配置全端复用 | 每仓库重复配置 |
| 提交历史 | 统一、便于追溯 | 分散 |
| 适用条件 | 小团队、端耦合度高 | 各端独立团队、发版节奏差异大 |

**决策**：当前阶段（小团队、单产品）选 Monorepo。切换条件：当某一端团队独立运营、或发版节奏差异显著（如 App 按月、Web 按周）时，再拆分对应子仓。

---

## 5. 后端语言评估：Java vs Python

> 用户要求：不限制语言，评估哪个更适用。本文给出对比表、推荐与决策条件，最终由团队拍板（建议在第 M0 阶段定稿）。

### 5.1 评估维度对比

| 维度 | Java（Spring Boot 3） | Python（FastAPI） | 对本项目的权重 |
|---|---|---|---|
| AI/多模态生态（ASR、OCR、LLM SDK） | 有 SDK 但生态较弱，常需另起 Python 辅助服务 | 原生最成熟，主流 LLM/ASR/OCR 一等支持 | ⭐⭐⭐⭐ 高（核心功能是解析） |
| 开发效率（CRUD + 解析管道迭代） | 中，样板代码较多 | 高，类型注解 + 自动生成 OpenAPI 文档 | ⭐⭐⭐ 高（小团队快速迭代） |
| 运行性能（并发吞吐） | 高（JIT、成熟线程模型） | 中（异步 I/O 足够，CPU 密集需进程池） | ⭐⭐ 中（家庭级量级两者都够） |
| 类型安全与长期可维护性 | 强（静态类型、工业级规范） | 中（Pydantic + mypy 补强） | ⭐⭐⭐ 中 |
| 招聘与团队普适性 | 人才池大、规范成熟 | AI 方向人才多、上手快 | ⭐⭐ 中（看团队现状） |
| 部署资源占用 | JVM 内存高（起步 ≥512M–1G） | 轻量，适合小规格服务器 | ⭐⭐ 中（影响初期成本） |
| 后续扩展（微服务/大数据） | 优势明显 | 需引入额外组件 | ⭐ 低（当前不需要） |

### 5.2 推荐结论

本项目核心负载是 **"多模态解析管道 + CRUD + 对话式查询"**，AI 生态权重最高、初期团队小、服务器规格小 → **推荐 Python + FastAPI**。

若团队已具备成熟的 Java 工程体系、或计划长期演进为企业级多服务架构，则 **Java + Spring Boot** 同样可行，且长期可维护性更优。

### 5.3 决策条件清单（团队据此拍板）

1. 团队现有技能栈偏向哪一门？
2. 是否已有 Java 微服务基建（注册中心、网关、链路追踪）可复用？
3. 对类型安全 / 工业级规范的硬性要求程度？
4. 初期服务器预算（Java 需上调内存配置）？

无论选哪种，**Parser Interface 抽象保持不变**（见第 6 章），未来可按模块混合双语言（如 Java 主服务 + Python 解析微服务），不影响整体架构。

---

## 6. 技术架构

### 6.1 总体分层

```
[Web] [iOS] [Android]
        │
   REST / (未来) WebSocket
        │
┌─────────────── 后端服务 (api/) ───────────────┐
│  API 层 → 业务层 → 仓储层                       │
│  解析调度器 ParserDispatcher                     │
│    ├─ RuleParser（规则，默认启用）              │
│    └─ LLMParser / VisionParser（预留接口）     │
│  媒体服务（上传、转码、对象存储签名）           │
│  同步服务（SyncLog 增量同步）                   │
└───────────────┬───────────────┬──────────────┘
                │               │
         PostgreSQL + Redis    对象存储(OSS/COS)
```

### 6.2 混合解析架构（Parser Interface）

统一接口（伪代码）：

```python
class ParserInterface:
    def parse(self, input: ParseInput) -> ParseResult: ...
    # ParseInput: { modality, raw_text?, media_ref?, asr_text? }
    # ParseResult: { item, location, placed_at, note, confidence }
```

- **RuleParser（初期默认）**：关键词/正则抽取，零成本跑通流程。
  - 物品：名词词典 + 占位（"把 X 放在…"）。
  - 位置：预置位置树（房间>家具>位置）做实体匹配。
  - 日期：相对/绝对日期正则（"昨天""上周五""11月4日"）。
- **LLMParser / VisionParser（预留）**：实现同一接口，仅替换调度器配置即可启用，无需改动业务层。

### 6.3 置信度与确认机制

- 每条解析结果带 `confidence`（0–1）。
- `confidence ≥ 阈值` → 直接入库并回复"已记录✅"。
- `confidence < 阈值` → 返回确认卡，用户确认/修正后入库，修正结果回流用于规则优化。
- 查询侧同样给出置信度与"证据"（来源记录）。

### 6.4 技术栈汇总

| 层 | 选型 | 当前状态 |
|---|---|---|
| 前端 Web | React 19 + Vite + TypeScript，对话式 UI | 已落地（智能对话，见 `docs/chat-assistant.md`） |
| 移动端 | **React Native + Expo SDK 56 / Expo Router 6 / EAS Build**（见 §9.2 定档） | M4.1 代码完成，待真机回归 |
| 后端 | **Python + FastAPI**（第 5 章评估结论定档），统一 REST API + JWT | 已落地 |
| 解析 | RuleParser + Agnes 2.5 Flash（Dispatcher 按配置切换并自动回退），Vision 接口预留 | 文字解析已落地 |
| 数据存储 | PostgreSQL + Redis + MinIO（开发期，兼容 S3） | 已落地 |
| 契约 | OpenAPI（`packages/api-schema/openapi.json`），共享类型在 `packages/shared` | 7 个端点已导出 |
| 接入 | 域名 `zhiwuwo.com` + nginx 18080/18443（不用 80/443/8080）+ Let's Encrypt | 18443 已通，正式证书待 DNS/签发期临时开放公网 80 |

---

## 7. 数据模型

核心实体（逻辑模型，落地时按 ORM 映射）：

| 实体 | 关键字段 | 说明 |
|---|---|---|
| **User** | id, account, nickname, avatar | 用户账号 |
| **Family** | id, name, owner_id, invite_code | 家庭组 |
| **FamilyMember** | id, family_id, user_id, role | 成员关系，role ∈ {owner, member} |
| **Item** | id, family_id, name, aliases | 物品主档（含别名/同义词） |
| **ItemRecord** | id, item_id, placed_by, location_path, placed_at, note, confidence, visibility | 存放记录（location_path 如 "书房>抽屉2"） |
| **MediaAsset** | id, record_id, type, oss_key, duration, size | 媒体文件（语音/图片/视频） |
| **Conversation** | id, user_id, family_id | 对话会话 |
| **Message** | id, conversation_id, role, raw_input, parse_result, confidence, confirmed | 对话消息，含解析与确认状态 |
| **SyncLog** | id, user_id, entity, last_seq, updated_at | 同步游标，用于增量同步 |

关系要点：Family 1—N FamilyMember N—1 User；Family 1—N Item；Item 1—N ItemRecord；ItemRecord 1—N MediaAsset；User 1—N Conversation 1—N Message。

---

## 8. API 设计概要

统一 REST 风格，JWT 鉴权；约定前缀 `/api/v1`。关键端点（示意）：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` `/auth/login` | 注册/登录，返回 JWT |
| POST | `/families` `/families/join` | 创建/加入家庭 |
| POST | `/records` | 新增存放记录（多模态输入 + 解析） |
| GET | `/records?q=护照` | 查询物品位置 |
| POST | `/records/{id}/confirm` | 低置信度确认/修正 |
| POST | `/media/upload` | 媒体文件上传（返回 oss_key） |
| GET | `/sync?cursor=xxx` | 增量同步（SyncLog） |
| POST | `/chat` | 对话式查询/记录入口 |

媒体文件访问走临时签名 URL（见第 10 章），不在 API 中直接返回原始地址。

---

## 9. 多端规划

### 9.1 端清单

| 端 | 技术 | 原生能力 | 状态 |
|---|---|---|---|
| **Web 网站** | React 19 + Vite + TS，PC + 移动浏览器适配 | 麦克风录音、文件选择、推送（Web Push，预留） | 已落地 |
| **iOS App** | React Native + Expo SDK 56（CNG） | 语音录制、拍照/选图/录像、APNs 推送（后三项 M4.2/M4.3） | 权限已声明，文字对话版完成 |
| **Android App** | 同 iOS 跨端框架 | 录音、相机、FCM/厂商通道推送（同上） | 权限已声明，文字对话版完成 |
| **可扩展端** | 预留微信小程序、平板适配 | — | 规划中 |

### 9.2 跨端框架选型（已定档：React Native + Expo SDK 56）

| 维度 | React Native | Flutter |
|---|---|---|
| 与 Web 技术栈一致性 | 高（React 生态） | 中（Dart 独立） |
| 原生能力/插件成熟度 | 高 | 高 |
| 性能/一致性 | 良好（桥接） | 优秀（自绘） |
| 团队上手成本 | 偏低（Web 已用 React） | 需学 Dart |

**决策**：Web 已定为 React + TS，移动端选 **React Native + Expo SDK 56 + Expo Router 6 + EAS Build**。可复用 API 契约、纯 TS 请求层、类型与文案；视图组件各自实现（React DOM vs React Native）。配套决策：只做内测（TestFlight + 内测 APK）、HTTPS 纳入第一阶段、最低系统 iOS 16.4+ / Android 10+、首版仅 M4.0 + M4.1。

> Apple 未发布 iOS 19–25（iOS 18 之后直接按年份命名到 iOS 26）。`iOS 16.4` 指 **Deployment Target**（用户设备下限）；构建机使用 iOS 26 SDK / Xcode 26.4+，两者不是同一概念。详见 `docs/mobile-plan.md` §1.1。

### 9.3 多端架构与同步

- 所有端共用统一 REST API；后续可升级 WebSocket 实现实时推送（如 A 记录后 B 端即时可见）。
- 客户端本地缓存（如 SQLite / Realm / IndexedDB）+ 离线暂存；联网后按 SyncLog 增量同步，冲突 last-write-wins（服务端时间戳为准）。
- App 发布规划（文档层面）：App Store / 各大安卓商店上架、签名证书、版本灰度与强制更新策略。

---

## 10. 硬件基础

### 10.1 环境与资源配置

| 阶段 | 配置 | 说明 |
|---|---|---|
| **开发/演示** | 2核4G × 1 云服务器 | 后端 + PostgreSQL + MinIO + 前端静态资源同机 |
| **生产初期（≤500 家庭）** | 应用 2核4G×1、PostgreSQL 2核4G、Redis 1G、对象存储（<100GB） | 应用可横向扩容 |
| **增长期（~5000 用户）** | 应用 4核8G×2、独立 DB 实例、Redis 2G、对象存储按量 | 读写分离/连接池优化 |

> 若后端选 **Java**，应用服务器内存建议上调至 **4G 起**（JVM 开销）。

### 10.2 资源说明

- 记录以元数据为主、文本量小；存储压力主要来自照片/视频/语音，用对象存储按量付费。
- 媒体转码/视频解析为 CPU 密集型，建议异步队列（如 Celery/RQ 或 MQ）处理，按需加配算力。
- 数据库定期备份（每日全量 + 增量），对象存储开启冗余与生命周期管理。

---

## 11. 环境参数（`.env.example`）

### 11.1 变量清单

```
# 基础
ENV=dev|staging|prod
APP_PORT=8000
SECRET_KEY=                  # JWT 签名密钥
LOG_LEVEL=info

# 数据库 / 缓存
DATABASE_URL=postgresql://user:pass@host:5432/zhiwuwo
REDIS_URL=redis://host:6379/0

# 对象存储（照片/视频/语音）
OSS_ENDPOINT=
OSS_ACCESS_KEY=
OSS_SECRET_KEY=
OSS_BUCKET=

# AI 服务（预留）
LLM_API_KEY=
LLM_BASE_URL=
ASR_API_KEY=

# 推送
APNS_CERT_PATH=
FCM_SERVER_KEY=

# 域名与 HTTPS（移动端内测前置，对外不使用 80/443/8080）
DOMAIN=zhiwuwo.com
ACME_EMAIL=admin@zhiwuwo.com
WEB_PORT=18080
WEB_HTTPS_PORT=18443

# 跨域与前端注入（非标准端口必须显式写进来源）
CORS_ORIGINS=http://localhost:3000,http://localhost:18080,https://zhiwuwo.com:18443,https://www.zhiwuwo.com:18443
VITE_API_BASE_URL=http://localhost:8000
# App 侧为 EXPO_PUBLIC_API_BASE_URL=https://zhiwuwo.com:18443（apps/mobile/.env.local）
# 原生请求同源访问 /api，不受 CORS 限制；签发期临时开放公网 80，见 docs/https-setup.md
```

### 11.2 环境差异表

| 参数 | dev | staging | prod |
|---|---|---|---|
| DATABASE_URL | 本地/容器 PG | 预发 DB | 独立生产 DB（开启备份） |
| LOG_LEVEL | debug | info | warn |
| AI 接口（LLM/ASR） | 关闭/占位 | 开启(测试 key) | 开启(正式 key) |
| CORS_ORIGINS | localhost | 预发域名 | 正式域名（收紧） |
| 媒体存储 | MinIO 本地 | 云 OSS 测试桶 | 云 OSS 生产桶 |

---

## 12. 非功能需求

- **安全与隐私**：JWT 鉴权；家庭数据隔离（成员仅可见本家庭记录）；媒体文件访问鉴权（临时签名 URL，短期有效）；密码哈希存储。
- **性能**：查询响应目标 <1s（P95）；媒体上传分片/压缩；列表分页。
- **可靠性**：数据库每日备份 + 可恢复演练；对象存储冗余；关键服务健康检查。
- **兼容性**：浏览器 Chrome/Safari/Edge 最新两个大版本；移动端 **iOS 16.4+ / Android 10+（API 29）**，构建目标 `targetSdkVersion=36`、iOS 26 SDK；服务端必须提供受信任证书的 HTTPS。
- **隐私声明**：仅在用户明确授权后才上传媒体至第三方 AI 服务，文档与产品内注明。

---

## 13. 部署与测试策略

- **部署**：开发/演示期使用 Docker（docker run 手动 + start.sh/stop.sh 启动脚本，不依赖 Compose），生产可迁 Kubernetes；环境划分 dev/staging/prod；CI 流水线 lint → 测试 → 构建镜像。
- **测试**：后端单测 + API 集成测试；前端组件测试；跨端真机回归清单（录音、相机、推送、同步）。
- **监控**：结构化接口日志、错误上报（如 Sentry）、基础指标（QPS、延迟、错误率）。

---

## 14. 风险与应对

| 风险 | 应对 |
|---|---|
| 规则解析准确率不足 | 预留 LLM 接口，渐进替换；低置信度走确认机制 |
| AI 接口成本与隐私 | 仅授权后上传媒体；隐私声明；可开关 |
| 跨端框架选型风险 | 第 9 章给出 RN/Flutter 对比与推荐 |
| 后端语言选型风险 | 第 5 章评估表 + 决策条件；Parser 抽象保证可混语言 |
| 推送合规（iOS 上架、国内安卓厂商通道） | 列为里程碑前置项，预留证书/通道对接 |
| 单服务器单点 | 备份恢复演练 + 扩容路径（见第 10 章） |

---

## 15. 迭代路线图（里程碑）

| 里程碑 | 周期(估) | 范围 |
|---|---|---|
| **M0 基础设施** | ~1 周 | monorepo 脚手架、Docker（docker run 手动 + 启动脚本）、CI、`.env.example`、后端语言与跨端框架最终拍板 |
| **M1 MVP** | ~2–3 周 | 后端骨架 + Web 端文字录入 / 规则解析 / 查询 |
| **M2 多模态** | ~2–3 周 | 语音/照片/视频录入 + 解析完善 + 低置信度确认机制 |
| **M3 家庭共享** | ~2 周 | 账号体系、家庭组、权限、成员记录共享 |
| **M4 移动端** | ~3–4 周 | M4.0 域名/HTTPS/契约；M4.1 Expo 登录 + 文字对话内测版；M4.2 录音/拍照；M4.3 推送 |
| **M5 同步与 AI** | ~2–3 周 | 多端实时同步、推送、LLM/Vision 解析接入 |

> 总周期估算约 12–16 周（单人/小团队，不含并行缓冲）。
> M4 已按「先内测、不上架」拆细，首版只做 M4.0 + M4.1（约 1 周出真机对话版），详见 `docs/mobile-plan.md`。

---

## 16. 文档索引

- 功能待办清单：`../TODO.md`
- 项目简介：`../README.md`
- 规划文档：`docs/PLAN.md`（本文件）
- 移动端规划与实施：`docs/mobile-plan.md`
- 域名 / HTTPS / nginx：`docs/https-setup.md`
- 对话式助手：`docs/chat-assistant.md`
- AI 解析接入：`docs/ai-parser-setup.md`
- 服务器操作：`docs/M0-server-setup.md`
- 目录结构与忽略规范：`docs/project-structure.md`
- 移动端工程说明：`../apps/mobile/README.md`
- 共享包说明：`../packages/shared/README.md`
