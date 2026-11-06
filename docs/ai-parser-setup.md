# AI 解析接入说明（Agnes 2.5 Flash）

> 关联：`docs/PLAN.md` §6.2 混合解析架构、`docs/chat-assistant.md`（对话理解）、`TODO.md` M5
> 状态：文字解析已接入（提前到 M1），Vision 待 M2

## 1. 它解决什么问题

`RuleParser` 只能识别预置词表与固定句式，例如「把护照放在书房第二个抽屉」只会得到 `location=书房`，丢掉「第二个抽屉」。接入 LLM 后由模型做语义抽取，位置层级、别名、口语表达都能覆盖。

架构上遵循 PLAN §6.2 的 **Parser Interface**：所有解析器实现同一个 `parse(content) -> ParseResult` 契约，`records.py` 只依赖调度器，切换实现只改配置、业务层零改动。

```
POST /api/v1/records
  -> dispatcher.parse()
  -> PARSER_BACKEND=llm + Key 存在 + 用户授权 -> AgnesParser (agnes-2.5-flash)
  -> 否则 / 调用失败 / 输出非法 JSON          -> RuleParser（兜底）
  -> ParseResult { item, location, placed_at, note, confidence }
```

响应结构未变，Web 前端无需改动。

## 2. 配置项

在 `.env` 中填写（`.env` 已被 `.gitignore` 忽略，**API Key 不要提交进仓库**）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LLM_API_KEY` | 空 | **必填**，你自己的 Agnes API Key。留空即等于关闭 AI 解析 |
| `LLM_BASE_URL` | `https://api.agnes-ai.cn/v1` | OpenAI 兼容 Base URL |
| `LLM_MODEL` | `agnes-2.5-flash` | 模型名；`agnes-2.0-flash` 已废弃，不做兼容回退 |
| `LLM_TIMEOUT` | `8` | 单次调用超时（秒），超时自动回退规则解析 |
| `PARSER_BACKEND` | `rule`（代码默认）/ `llm`（`.env` 预设） | 解析后端开关 |
| `LLM_CONSENT` | `true` | 隐私开关，设为 `false` 时不把录入文本发给第三方 AI |

## 3. 启用步骤

1. 把 Key 填进 `.env` 的 `LLM_API_KEY=`。
2. 确认出网（服务器在国内，部分公网域名可能受限）。api 镜像是 `python:3.12-slim`，**没有 curl**，用 `httpx` 探测：
   ```bash
   docker exec api python -c "import httpx; r=httpx.post('https://api.agnes-ai.cn/v1/chat/completions', headers={'Authorization':'Bearer probe'}, json={'model':'agnes-2.5-flash','messages':[{'role':'user','content':'hi'}]}, timeout=8); print(r.status_code, r.text[:180])"
   ```
   返回 `401 {"error":...无效的令牌...}` 即表示网络通、端点正确（用假 Key 被拒是预期结果）。
3. **重建容器**（`--env-file .env` 只在容器创建时注入，改 `.env` 后必须重建，`docker restart` 不会读到新变量）：
   ```bash
   cd /export/ant/zhiwuwo
   ./deploy/stop.sh
   ./deploy/start.sh
   ```
4. 自检：
   ```bash
   curl -s http://localhost:18080/api/v1/parser/status
   ```
   期望 `"active_backend": "agnes-2.5-flash"`、`"api_key_configured": true`。

## 4. 验证解析效果

```bash
TOKEN=$(curl -s -X POST http://localhost:18080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"webtest","password":"pw123456"}' \
  | sed -E 's/.*"access_token":"([^"]+)".*/\1/')

curl -s -X POST http://localhost:18080/api/v1/records \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"上周把医保卡塞进玄关柜最上面那层了"}'
```

对比规则解析器：`location` 应保留「玄关柜最上面那层」这类完整层级。

## 5. 容错设计

`AgnesParser` 任何异常（超时、限流、401、非 JSON、字段类型异常、缺 Key）都会被 `dispatcher` 捕获并回退 `RuleParser`，**录入接口永远可用**。日志里会有 `AI 解析失败，回退规则解析：...` 的 warning。

输出清洗做了三层：剥离 ` ```json ` 围栏 → 截取首尾花括号 → `json.loads` → 字段白名单与日期 `date.fromisoformat` 校验。

置信度做了刻度映射（1.0 完整 / 0.5 缺一半 / 0.0 全缺），与 `RuleParser` 保持一致；因为 `records.py` 以 `confidence < 1.0` 判定是否弹确认卡，直接使用模型自评（常见 0.9x）会导致每条记录都要求确认。

## 6. 隐私与成本

- 开启后，用户**录入的文本会发送给 Agnes AI**（不含账号、token 等其它数据）。若不接受，把 `LLM_CONSENT=false` 或清空 `LLM_API_KEY` 即可完全关闭。
- 体验期价格为 ¥0 / 百万 Token；请求体只有一段文本，`max_tokens=256`，成本可忽略。价格与限流以你的账户权限为准。
- 路由是同步 `def`（FastAPI 线程池），`httpx` 同步调用不会阻塞事件循环；录入会多几百毫秒到数秒延迟，前端已有发送中状态。
- 免费额度若结束或触发限流，回退逻辑保证功能不中断。

## 7. 常见问题

| 现象 | 排查 |
|---|---|
| `active_backend` 一直是 `rule` | Key 为空 / `PARSER_BACKEND` 不是 `llm` / `LLM_CONSENT=false` / 改 `.env` 后没重建容器 |
| 日志反复出现回退 warning | 先用第 3 步的 `httpx` 命令测出网，再看 `docker logs api` 里的具体异常（401=Key 错，超时=网络/限流） |
| 解析结果每天都弹确认卡 | 检查模型输出的 `confidence` 是否 < 0.6，或 `item`/`location` 是否缺失 |
| 想临时切回规则解析 | `.env` 改 `PARSER_BACKEND=rule` 后重建容器 |
