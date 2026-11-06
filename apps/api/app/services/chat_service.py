"""对话式助手：意图识别 + 中文口语理解 + 增强检索 + 人话回答。

设计原则：
- 不填 API Key 时纯靠本地规则，也要能听懂「我的电脑在哪里」这类口语；
- 填了 Key 且 PARSER_BACKEND=llm 时，用 Agnes 2.5 Flash 做一次语义理解，
  失败自动回退规则，功能永不中断；
- 只让模型理解意图与抽字段，回答用模板生成，省掉第二次模型调用与延迟。
"""

from __future__ import annotations

import logging
import re
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Item, ItemRecord, User
from app.schemas import RecordResponse
from app.services import dispatcher
from app.services.agnes_parser import _extract_json, call_agnes
from app.services.record_service import create_from_parsed, to_response

logger = logging.getLogger(__name__)

# ---------- 中文口语规则 ----------

# 强疑问信号优先于存放动词，保证「护照放在哪了」判为查询而不是录入
STRONG_QUERY_MARKERS = (
    "哪", "吗", "呢", "?", "？", "找", "查", "有没有", "记不记得",
    "告诉我", "什么", "哪些", "多少", "是不是",
)
RECORD_MARKERS = (
    "放在", "放到", "放进", "放进了", "收进", "收好", "存到", "存入",
    "塞进", "搁在", "搁到", "放好", "放去", "收纳", "放", "收", "存",
)
PREFIXES = (
    "我想知道", "我想问一下", "我想问", "你知道不知道", "你知道", "请问",
    "麻烦帮我", "帮我找一下", "帮我查一下", "帮我找", "帮我查", "帮我",
    "麻烦", "查一下", "找一下", "告诉我", "咱家的", "家里的", "我的",
    "那个", "这个", "把", "我",
)
# 长的放前面，避免「护照放哪了」被先剥成「护照放哪」
SUFFIXES = (
    "到底在哪儿呢", "到底在哪里呢", "到底在哪儿", "到底在哪里",
    "放在哪里了", "放在哪儿了", "放在哪里", "在哪儿呢", "在哪里呢",
    "放哪儿了", "放哪了", "在哪儿", "在哪里", "在哪", "搁哪儿了",
    "搁哪了", "去哪儿了", "在哪呢", "呢", "吗", "啊", "呀", "来着",
    "了", "的", "？", "?", "！", "!", "。", "，", ",", ".", " ",
)
NOISE_RE = re.compile(
    r"(?:到底|究竟|请问|帮我|我想知道|在哪|哪里|哪儿|放哪|放哪儿|"
    r"有没有|是不是|记不记得|告诉我|找一下|查一下|一下)"
)
PUNCT_RE = re.compile(r"[\s，,。.！!？?、~～:：;；]+")

LOCATION_LIST_HINTS = (
    "有什么", "有啥", "有哪些", "什么东西", "哪些东西",
    "都放了什么", "都放了啥", "都有什么", "都有啥", "放了些啥",
)
LOCATION_LIST_RES = (
    re.compile(
        r"^\s*(?:请问|帮我|告诉我)?\s*(.{1,15}?)(?:里|里面|内|中|上面|上)"
        r"(?:面)?(?:都)?(?:有|放了|搁了|存了|放)?(?:些)?"
        r"(?:哪些东西|什么东西|什么|啥|东西|物品)?(?:吗|呢|啊)?[？?。！!\s]*$"
    ),
    re.compile(
        r"^\s*(?:请问|帮我|告诉我)?\s*(.{1,15}?)都(?:有|放了|搁了|存了)"
        r"(?:些)?(?:什么|啥|哪些|东西)[？?。！!\s]*$"
    ),
)


def extract_keyword(text: str) -> str:
    """把「我的电脑在哪里」洗成「电脑」。反复剥离前后缀以处理叠加口语。"""
    s = (text or "").strip()
    changed = True
    while changed and s:
        changed = False
        for prefix in PREFIXES:
            if s.startswith(prefix) and len(s) > len(prefix):
                s, changed = s[len(prefix):].strip(), True
                break
        if changed:
            continue
        for suffix in SUFFIXES:
            if s.endswith(suffix) and len(s) > len(suffix):
                s, changed = s[:-len(suffix)].strip(), True
                break
    s = NOISE_RE.sub("", s)
    return PUNCT_RE.sub("", s).strip()


def classify(text: str) -> str:
    """先判强疑问词，再判存放动词，最后默认当作「找东西」。"""
    if any(marker in text for marker in STRONG_QUERY_MARKERS):
        return "query"
    if any(marker in text for marker in RECORD_MARKERS):
        return "record"
    return "query"


def _match_location_list(text: str) -> str | None:
    """识别「书房里有什么」「卧室都放了啥」这类按位置反查的问法。"""
    if not any(hint in text for hint in LOCATION_LIST_HINTS):
        return None
    # 含「在哪/找/查」的是找物品，不要误判成位置反查
    if any(m in text for m in ("在哪", "哪里", "哪儿", "放哪", "哪了", "找", "查")):
        return None
    for pattern in LOCATION_LIST_RES:
        match = pattern.match(text)
        if not match:
            continue
        loc = re.sub(r"^(?:我的|请问|帮我|告诉我|那个|这个)", "", match.group(1)).strip()
        if loc and not any(q in loc for q in ("哪", "吗", "呢", "?", "？")):
            return loc
    return None


# ---------- 语义理解（规则 / AI） ----------

CHAT_SYSTEM_PROMPT_TEMPLATE = """你是「置物窝」App 的语义理解模块。用户会用中文口语描述「把东西放在哪」或「找东西在哪」。

今天的日期：%TODAY%；昨天：%YESTERDAY%。

只输出一个 JSON 对象，不要解释、不要 markdown 代码块。字段：
- intent: "record"（陈述把某物放在某处）| "query"（询问）| "unknown"（闲聊/无法判断）
- scope: "item"（按物品找）| "location"（按位置反查，问「某处有什么」）
- item: 物品名称（去掉「我的」「在哪里」等口语成分）；无则 null
- location: 位置（录入时为存放位置，位置反查时为被问的位置）；无则 null
- placed_at: 存放日期 ISO YYYY-MM-DD，相对日期按上面基准换算；无则 null
- note: 备注；无则 null
- confidence: 0~1 浮点数

判断要点：
1. 「我的电脑在哪里」「护照放哪了」「上次那个充电器搁哪儿了」→ intent=query, scope=item, item=物品名
2. 「书房里有什么」「卧室都放了啥」→ intent=query, scope=location, location=位置, item=null
3. 「我把护照放在书房第二个抽屉」「昨天把医保卡塞进玄关柜」→ intent=record，给出 item/location/placed_at
4. 无法确定 → intent=unknown

示例输入：我的电脑在哪里
示例输出：{"intent":"query","scope":"item","item":"电脑","location":null,"placed_at":null,"note":null,"confidence":0.95}
"""


def _build_chat_prompt() -> str:
    today = date.today()
    return (
        CHAT_SYSTEM_PROMPT_TEMPLATE.replace("%TODAY%", today.isoformat())
        .replace("%YESTERDAY%", (today - timedelta(days=1)).isoformat())
    )


def _ai_enabled() -> bool:
    return bool(
        settings.parser_backend == "llm" and settings.llm_api_key and settings.llm_consent
    )


def _rule_understand(text: str) -> dict[str, Any]:
    intent = classify(text)
    scope, location = "item", None
    if intent == "query":
        loc = _match_location_list(text)
        if loc:
            scope, location = "location", loc
    keyword = extract_keyword(text)
    return {
        "intent": intent,
        "scope": scope,
        "item": keyword or None,
        "location": location,
        "keyword": keyword,
        "placed_at": None,
        "note": None,
        "source": "rule",
    }


def _ai_understand(text: str) -> dict[str, Any]:
    raw = _extract_json(call_agnes(_build_chat_prompt(), text))
    intent = raw.get("intent")
    if intent not in ("record", "query", "unknown"):
        raise ValueError(f"模型返回了未知 intent: {intent!r}")

    def s(key: str) -> str | None:
        value = raw.get(key)
        return value.strip() if isinstance(value, str) and value.strip() else None

    return {
        "intent": intent,
        "scope": "location" if raw.get("scope") == "location" else "item",
        "item": s("item"),
        "location": s("location"),
        "keyword": s("item") or extract_keyword(text),
        "placed_at": s("placed_at"),
        "note": s("note"),
        "source": "agnes",
    }


def understand(text: str, mode: str = "auto") -> dict[str, Any]:
    """返回统一的理解结果；AI 失败自动回退规则，mode 可强制覆盖意图。"""
    result = _rule_understand(text)
    if _ai_enabled():
        try:
            result = _ai_understand(text)
        except Exception as exc:  # 第三方服务不可用时必须兜底
            logger.warning("AI 意图理解失败，回退规则：%s", exc)
    if mode == "record":
        result["intent"] = "record"
    elif mode == "query":
        result["intent"] = "query"
    return result


# ---------- 增强检索 ----------

def search_records(db: Session, user_id: int, understood: dict[str, Any]) -> list[ItemRecord]:
    """物品名匹配 → 匹配不到时按位置回退；scope=location 时按位置反查。"""
    base = db.query(ItemRecord).filter(ItemRecord.placed_by == user_id)
    order = ItemRecord.created_at.desc()

    if understood.get("scope") == "location" and understood.get("location"):
        location = understood["location"]
        return (
            base.filter(ItemRecord.location_path.ilike(f"%{location}%"))
            .order_by(order)
            .limit(50)
            .all()
        )

    keyword = (understood.get("keyword") or "").strip()
    if not keyword:
        return base.order_by(order).limit(20).all()

    by_item = (
        base.join(Item)
        .filter(Item.name.ilike(f"%{keyword}%"))
        .order_by(order)
        .limit(50)
        .all()
    )
    if by_item:
        return by_item
    # 用户说的可能是位置（「书房」），再按位置找一次
    return (
        base.filter(ItemRecord.location_path.ilike(f"%{keyword}%"))
        .order_by(order)
        .limit(50)
        .all()
    )


# ---------- 人话回答 ----------

def _day(placed_at: str | None) -> str:
    return (placed_at or "")[:10]


def _record_answer(rec: RecordResponse) -> str:
    item = rec.item or "这个物品"
    location = rec.location or "（还没记位置）"
    if rec.needs_confirm:
        return f"我记下了，但不太确定：{item} → {location}。请核对下面的卡片，不对可以点确认修正。"
    day = _day(rec.placed_at)
    tail = f"，{day} 记的" if day else ""
    return f"记好啦 ✅ {item} 放在 {location}{tail}。以后直接问我「{item}在哪」就行。"


def _query_answer(understood: dict[str, Any], recs: list[RecordResponse]) -> str:
    keyword = understood.get("keyword") or "这个物品"
    if not recs:
        return f"还没找到「{keyword}」的存放记录 🤔 你可以告诉我它在哪，比如「把{keyword}放在书房抽屉」。"

    if understood.get("scope") == "location":
        location = understood.get("location") or "那里"
        names = "、".join(dict.fromkeys(r.item for r in recs if r.item)) or "一些物品"
        return f"{location}里目前记了 {len(recs)} 条：{names}。"

    if len(recs) == 1:
        r = recs[0]
        day = _day(r.placed_at)
        tail = f"，{day} 记的" if day else ""
        return f"你的{r.item or '东西'}放在「{r.location or '未记录位置'}」{tail}。"

    first = recs[0]
    day = _day(first.placed_at)
    tail = f"（{day}）" if day else ""
    return (
        f"找到 {len(recs)} 条关于「{keyword}」的记录，"
        f"最近一次放在「{first.location or '未记录位置'}」{tail}。"
    )


UNKNOWN_ANSWER = (
    "我还没太听明白 😅 你可以说「把护照放在书房抽屉」记一条，"
    "或者直接问「我的护照在哪里」找东西。"
)


# ---------- 对话入口 ----------

def handle(db: Session, user: User, text: str, mode: str = "auto") -> dict[str, Any]:
    """统一对话入口：自动判断录入/查询，返回人话回答 + 位置卡片。"""
    understood = understand(text, mode)
    intent = understood["intent"]

    if intent == "record":
        if understood["source"] == "agnes":
            parsed = {
                "item": understood.get("item"),
                "location": understood.get("location"),
                "placed_at": understood.get("placed_at") or date.today().isoformat(),
                "note": understood.get("note"),
                "confidence": (
                    1.0 if understood.get("item") and understood.get("location") else 0.5
                ),
            }
        else:
            parsed = dispatcher.parse(text)
        rec = create_from_parsed(db, user, parsed)
        record = to_response(db, rec)
        return {
            "type": "record",
            "intent": "record",
            "answer": _record_answer(record),
            "record": record,
            "records": [],
        }

    if intent == "query":
        recs = search_records(db, user.id, understood)
        responses = [to_response(db, r) for r in recs]
        return {
            "type": "query",
            "intent": "query",
            "answer": _query_answer(understood, responses),
            "record": None,
            "records": responses,
        }

    return {
        "type": "unknown",
        "intent": "unknown",
        "answer": UNKNOWN_ANSWER,
        "record": None,
        "records": [],
    }
