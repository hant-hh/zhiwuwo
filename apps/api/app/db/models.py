from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invite_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(16), default="member")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(128), index=True)
    aliases: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ItemRecord(Base):
    __tablename__ = "item_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("items.id"), nullable=True)
    placed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id"), nullable=True
    )
    location_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    placed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("item_records.id"))
    type: Mapped[str] = mapped_column(String(16))
    oss_key: Mapped[str] = mapped_column(String(255))
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(16))
    raw_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    parse_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    entity: Mapped[str] = mapped_column(String(32))
    last_seq: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
