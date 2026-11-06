"""统一对话接口：用户只管说一句话，后端自动判断录入/查找并用人话回答。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.chat_service import handle

router = APIRouter()


@router.post("", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mode = body.mode if body.mode in ("auto", "record", "query") else "auto"
    return handle(db, user, body.message, mode)
