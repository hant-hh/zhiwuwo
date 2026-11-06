"""规则式解析器（M1 阶段）。

输入自然语言文本，抽取：物品(item)、位置(location)、存放日期(placed_at)、备注(note)，
并给出置信度(confidence, 0~1)。本解析器为规则版本，后续可替换为 LLM/Vision 实现同一接口。
"""

from datetime import date, datetime, timedelta

from app.services.parser_interface import ParserInterface

LOCATION_VOCAB = [
    "书房", "卧室", "客厅", "厨房", "卫生间", "玄关", "阳台", "储物间",
    "抽屉", "柜子", "衣柜", "冰箱", "微波炉", "餐桌", "茶几", "床头柜",
    "鞋柜", "密码箱", "保险柜", "书架", "书柜", "电视柜", "玄关柜",
]
LOCATION_MODIFIERS = [
    "第一个", "第二个", "第三个", "左边", "右边", "上层", "下层",
    "里面", "外面", "最上面", "最下面",
]


def _extract_date(text: str) -> str | None:
    today = date.today()
    if "前天" in text:
        return (today - timedelta(days=2)).isoformat()
    if "昨天" in text:
        return (today - timedelta(days=1)).isoformat()
    if "今天" in text or "刚" in text:
        return today.isoformat()
    m = __import__("re").search(r"(\d{1,2})月(\d{1,2})日", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        year = today.year
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return None
    return None


def _extract_location(text: str) -> str | None:
    found = [w for w in LOCATION_VOCAB if w in text]
    if not found:
        return None
    # 取最长匹配，避免「玄关柜」被截成「玄关」
    primary = max(found, key=len)
    # 尝试拼接前面的修饰词，如 "第二个抽屉"
    for mod in LOCATION_MODIFIERS:
        if mod in text and text.find(mod) < text.find(primary) <= text.find(mod) + len(mod) + 6:
            return mod + primary
    return primary


def _extract_item(text: str) -> str | None:
    import re

    # 模式1：把 <物品> 放...
    m = re.search(r"把(.+?)放", text)
    if m:
        return m.group(1).strip()
    # 模式2：<物品> 放在/放到/放进了/放去 ...
    m = re.search(r"(.+?)(?:放在|放到|放进了|放去|放进)", text)
    if m:
        return m.group(1).strip()
    # 模式3：第一个"放"之前的内容（去掉句首冗余词）
    if "放" in text:
        candidate = text.split("放", 1)[0].strip()
        candidate = re.sub(r"^(我|帮|请|把|将|已经|刚刚|刚才)", "", candidate).strip()
        if candidate:
            return candidate
    return None


def parse_text(content: str) -> dict:
    text = (content or "").strip()
    placed_at = _extract_date(text)
    location = _extract_location(text)
    item = _extract_item(text)

    score = 0.0
    if item:
        score += 0.5
    if location:
        score += 0.5

    return {
        "item": item,
        "location": location,
        "placed_at": placed_at or date.today().isoformat(),
        "note": None,
        "confidence": score,
    }


def parse(content: str) -> dict:
    """对外统一接口（与后续 LLM/Vision 解析器保持签名一致）。"""
    return parse_text(content)


class RuleParser(ParserInterface):
    """规则解析器的接口适配；保留 parse/parse_text 函数供既有调用与测试使用。"""

    name = "rule"

    def parse(self, content: str) -> dict:
        return parse_text(content)
