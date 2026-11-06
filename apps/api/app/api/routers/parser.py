"""解析器状态查询接口（不暴露 API Key）。"""

from fastapi import APIRouter

from app.core.config import settings
from app.services.dispatcher import get_parser
from app.services.rule_parser import RuleParser

router = APIRouter()


@router.get("/status")
def parser_status():
    """查看当前生效的解析器与 AI 配置状态，用于启动后自检。"""
    parser = get_parser()
    return {
        "configured_backend": settings.parser_backend,
        "active_backend": parser.name,
        "model": settings.llm_model,
        "api_key_configured": bool(settings.llm_api_key),
        "consent": settings.llm_consent,
        "fallback": RuleParser.name,
    }
