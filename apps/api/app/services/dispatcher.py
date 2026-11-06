"""解析调度器（对应 docs/PLAN.md §6.2 ParserDispatcher）。

业务层只调用 parse()；具体用哪个解析器由 .env 配置决定。
AI 解析失败时自动回退规则解析，保证录入永不因第三方服务故障而中断。
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings
from app.services.parser_interface import ParserInterface
from app.services.rule_parser import RuleParser

logger = logging.getLogger(__name__)


def get_parser() -> ParserInterface:
    """按配置选择解析器；Key 缺失或用户未授权时强制走规则解析。"""
    if settings.parser_backend == "llm" and settings.llm_api_key and settings.llm_consent:
        from app.services.agnes_parser import AgnesParser

        return AgnesParser()
    return RuleParser()


def parse(content: str) -> dict[str, Any]:
    """业务层唯一入口，签名与旧 rule_parser.parse 完全一致。"""
    parser = get_parser()
    try:
        return parser.parse(content)
    except Exception as exc:  # 第三方服务不可用时必须兜底
        if isinstance(parser, RuleParser):
            raise
        logger.warning("AI 解析失败，回退规则解析：%s", exc)
        return RuleParser().parse(content)
