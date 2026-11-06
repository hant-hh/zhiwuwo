from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Item, ItemRecord, User
from app.db.session import get_db
from app.schemas import ConfirmRequest, RecordCreate, RecordResponse
from app.services.chat_service import extract_keyword, search_records
from app.services.dispatcher import parse
from app.services.record_service import create_from_parsed, to_response

router = APIRouter()


@router.post("", response_model=RecordResponse)
def create_record(
    body: RecordCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = create_from_parsed(db, user, parse(body.content))
    return to_response(db, rec)


@router.get("", response_model=list[RecordResponse])
def list_records(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 旧接口也做口语清洗：「我的电脑在哪里」→「电脑」
    understood = {
        "scope": "item",
        "keyword": extract_keyword(q) if q else "",
        "location": None,
    }
    recs = search_records(db, user.id, understood)
    return [to_response(db, r) for r in recs]


@router.post("/{record_id}/confirm", response_model=RecordResponse)
def confirm_record(
    record_id: int,
    body: ConfirmRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = db.get(ItemRecord, record_id)
    if not rec or rec.placed_by != user.id:
        raise HTTPException(status_code=404, detail="记录不存在")
    if body.item:
        item = db.query(Item).filter(Item.name == body.item).first()
        if not item:
            item = Item(name=body.item)
            db.add(item)
            db.flush()
        rec.item_id = item.id
    if body.location is not None:
        rec.location_path = body.location
    if body.placed_at is not None:
        try:
            rec.placed_at = datetime.fromisoformat(body.placed_at)
        except ValueError:
            pass
    if body.note is not None:
        rec.note = body.note
    rec.confirmed = True
    rec.confidence = 1.0
    db.commit()
    db.refresh(rec)
    return to_response(db, rec)
