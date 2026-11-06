# 对话式助手（自然语言录入与查找）

> 关联：`docs/PLAN.md` §3.2、`docs/ai-parser-setup.md`
> 完成：2026-11-04（M1 增强）

## 解决的问题

旧版 Web 界面有两个「傻」点：

1. 查询时把用户整句话原样当物品名做 `LIKE '%...%'`，所以「我的电脑在哪里」搜不到，必须手动改成「电脑」；
2. 要手动切「录入 / 查询」标签，且回答只有卡片或一句「没有找到相关物品记录 🤔」。

现在统一走 `POST /api/v1/chat`：后端自动判断意图、理解中文口语、增强检索、用人话回答，**前端无需切换模式**。

## 接口

```text
POST /api/v1/chat
Authorization: Bearer <JWT>
Content-Type: application/json

{ "message": "我的电脑在哪里", "mode": "auto" }
```

`mode`：`auto`（默认，自动识别）/ `record` / `query`（后两者强制覆盖，用于偶尔判错时手动纠正）。

响应：

```json
{
  "type": "query",
  "intent": "query",
  "answer": "你的电脑放在「卧室」，2026-11-04 记的。",
  "record": null,
  "records": [ { "id": 1, "item": "电脑", "location": "卧室", "...": "..." } ]
}
```

`type` 为 `record` 时 `record` 带新建记录；`unknown` 时返回引导语。旧接口 `POST/GET /api/v1/records` 与 `/confirm` 全部保留，且 `GET ?q=` 也做了同样的口语清洗。

## 它怎么「听懂」中文

| 用户说的 | 意图 | 处理 |
|---|---|---|
| 我的电脑在哪里 | 查询 | 剥离「我的」「在哪里」→ 按物品名「电脑」检索 |
| 护照放哪了 | 查询 | 疑问词优先于存放动词 → 按「护照」检索 |
| 帮我找一下钥匙 | 查询 | 剥离「帮我找一下」→ 按「钥匙」检索 |
| 书房里有什么 | 查询（位置反查） | 按 `location_path` 找该位置所有记录 |
| 玄关柜 | 查询 | 物品名匹配不到时自动回退按位置匹配 |
| 我把护照放在书房抽屉 | 录入 | 命中存放动词且无疑问词 → 走解析入库 |
| 帮我把雨伞放阳台 | 录入 | 同上，无需切换标签 |

实现见 `apps/api/app/services/chat_service.py`：`extract_keyword()` 反复剥离前后缀、`classify()` 判意图、`search_records()` 做两级检索、`_query_answer()` / `_record_answer()` 生成回答。

**不填 API Key 也全部可用**（纯本地规则，零延迟）。

填了 Key 且 `PARSER_BACKEND=llm` 时，用 Agnes 2.5 Flash 做一次语义理解，可覆盖规则外的说法（如「上次出差带回来那个充电器搁哪儿了」）。模型只负责理解意图和抽字段，回答由模板生成，省掉第二次调用；调用失败自动回退规则，日志留 warning。

## 验证

```bash
./deploy/stop.sh && ./deploy/start.sh
TOKEN=$(curl -s -X POST http://localhost:18080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"webtest","password":"pw123456"}' \
  | sed -E 's/.*"access_token":"([^"]+)".*/\1/')

curl -s -X POST http://localhost:18080/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"我的电脑在哪里"}'

curl -s -X POST http://localhost:18080/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"书房里有什么"}'

docker exec api pytest    # 含 test_chat.py
```

## 前端

`apps/web` 默认「智能」模式，输入框不再区分录入/查询；顶部保留「智能 / 录入 / 查询」三个按钮，后两个仅作强制覆盖。首屏提供三个可点击示例，机器人回复先展示自然语言文本、再展示位置卡片；低置信度卡片带「确认」按钮。
