"""Agnes 2.5 Flash 解析器。

走 OpenAI 兼容的 Chat Completions 接口：
    POST https://api.agnes-ai.cn/v1/chat/completions
    model = agnes-2.5-flash（agnes-2.0-flash 已废弃，不作为回退）

本模块只负责「调用 + 输出清洗 + 字段归一化」；任何异常由 dispatcher
回退到 RuleParser，保证录入功能不会因第三方服务不可用而中断。
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, timedelta
from typing import Any

import httpx

from app.core.config import settings
from app.services.parser_interface import ParserInterface

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """你是「置物窝」App 的信息抽取器。用户会用中文口语描述「把某个物品放在某处」，请抽取结构化信息。

今天的日期：%TODAY%；昨天：%YESTERDAY%；前天：%DAY_BEFORE%。

只输出一个 JSON 对象，不要输出任何解释文字，不要包裹 markdown 代码块。字段：
- item: 物品名称（字符串）；无法确定填 null
- location: 存放位置（字符串），保留完整层级与修饰，例如「书房第二个抽屉」「玄关柜最上面那层」；无法确定填 null
- placed_at: 存放日期，ISO 格式 YYYY-MM-DD；相对日期按上面的基准换算；未提及或无法确定填 null
- note: 备注（字符串）；无则 null
- confidence: 0~1 的浮点数，表示你对本次抽取的把握程度

示例输入：昨天把护照放在书房第二个抽屉
示例输出：{"item":"护照","location":"书房第二个抽屉","placed_at":"%YESTERDAY%","note":null,"confidence":0.95}
"""


def _build_system_prompt() -> str:
    """把当天日期注入 prompt，模型才能正确换算「昨天」「上周」等相对日期。"""
    today = date.today()
    return (
        SYSTEM_PROMPT_TEMPLATE.replace("%TODAY%", today.isoformat())
        .replace("%YESTERDAY%", (today - timedelta(days=1)).isoformat())
        .replace("%DAY_BEFORE%", (today - timedelta(days=2)).isoformat())
    )


def _extract_json(text: Any) -> dict[str, Any]:
    """从模型输出里抠出 JSON 对象（容忍 ```json 围栏与前后废话）。"""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("模型返回内容为空")
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("模型返回内容中找不到 JSON 对象")
    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("模型返回内容不是 JSON 对象")
    return data


def _as_str(value: Any) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    """把模型输出归一成与 RuleParser 完全一致的 ParseResult 契约。"""
    item = _as_str(raw.get("item"))
    location = _as_str(raw.get("location"))
    note = _as_str(raw.get("note"))

    placed_at = _as_str(raw.get("placed_at"))
    if placed_at:
        try:
            placed_at = date.fromisoformat(placed_at[:10]).isoformat()
        except ValueError:
            placed_at = None
    # 未提及日期时与规则解析器保持一致：按「今天」记录
    if placed_at is None:
        placed_at = date.today().isoformat()

    try:
        ai_confidence = float(raw.get("confidence", 0.0))
    except (TypeError, ValueError):
        ai_confidence = 0.0
    ai_confidence = max(0.0, min(1.0, ai_confidence))

    # 对齐应用现有刻度：1.0 完整 / 0.5 缺一半 / 0.0 全缺。
    # records.py 以 confidence < 1.0 判定是否需要确认，若直接采用模型自评
    # （常见 0.9x）会导致每条记录都弹确认卡，故这里做一次刻度映射。
    if item and location:
        confidence = 1.0
    elif item or location:
        confidence = 0.5
    else:
        confidence = 0.0
    if ai_confidence < 0.6:
        confidence = min(confidence, 0.5)

    return {
        "item": item,
        "location": location,
        "placed_at": placed_at,
        "note": note,
        "confidence": confidence,
    }


def call_agnes(
    system_prompt: str,
    user_text: str,
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
    timeout: float | None = None,
    max_tokens: int = 256,
) -> str:
    """调用 Agnes Chat Completions，返回 choices[0].message.content 文本。

    录入解析与对话意图理解共用这一层；异常由各自调用方兜底。
    """
    key = settings.llm_api_key if api_key is None else api_key
    url_base = settings.llm_base_url if base_url is None else base_url.rstrip("/")
    model_name = settings.llm_model if model is None else model
    timeout_s = settings.llm_timeout if timeout is None else timeout
    if not key:
        raise RuntimeError("LLM_API_KEY 未配置")

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    response = httpx.post(
        f"{url_base}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout_s,
    )
    response.raise_for_status()
    body = response.json()
    try:
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Agnes 响应缺少 choices[0].message.content") from exc


class AgnesParser(ParserInterface):
    """Agnes 2.5 Flash 文字解析器（Chat Completions）。"""

    name = "agnes-2.5-flash"

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.api_key = settings.llm_api_key if api_key is None else api_key
        self.base_url = settings.llm_base_url if base_url is None else base_url.rstrip("/")
        self.model = settings.llm_model if model is None else model
        self.timeout = settings.llm_timeout if timeout is None else timeout

    def parse(self, content: str) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("LLM_API_KEY 未配置")
        text = (content or "").strip()
        if not text:
            raise ValueError("录入内容为空")

        message = call_agnes(
            _build_system_prompt(),
            text,
            api_key=self.api_key,
            base_url=self.base_url,
            model=self.model,
            timeout=self.timeout,
        )
        result = _normalize(_extract_json(message))
        logger.info("Agnes 解析结果: %s", result)
        return result
