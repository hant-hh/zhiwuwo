"""记录写入与响应组装的公共业务逻辑。

供 records 路由与 chat 对话服务共用，避免两处重复实现解析结果入库。
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Item, ItemRecord, User
from app.schemas import RecordResponse


def to_response(db: Session, rec: ItemRecord) -> RecordResponse:
    item = db.get(Item, rec.item_id) if rec.item_id else None
    return RecordResponse(
        id=rec.id,
        item=item.name if item else None,
        location=rec.location_path,
        placed_at=rec.placed_at.isoformat() if rec.placed_at else None,
        note=rec.note,
        confidence=rec.confidence,
        confirmed=rec.confirmed,
        needs_confirm=rec.confidence < 1.0,
    )


def create_from_parsed(db: Session, user: User, parsed: dict) -> ItemRecord:
    """把 ParseResult 形状的 dict 落库，返回新建的 ItemRecord。"""
    item = None
    if parsed.get("item"):
        item = db.query(Item).filter(Item.name == parsed["item"]).first()
        if not item:
            item = Item(name=parsed["item"])
            db.add(item)
            db.flush()

    placed_at = None
    if parsed.get("placed_at"):
        try:
            placed_at = datetime.fromisoformat(parsed["placed_at"])
        except ValueError:
            placed_at = None

    rec = ItemRecord(
        item_id=item.id if item else None,
        placed_by=user.id,
        location_path=parsed.get("location"),
        placed_at=placed_at,
        note=parsed.get("note"),
        confidence=parsed.get("confidence", 0.0),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec
