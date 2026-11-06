from pydantic import BaseModel, Field


# ---------- 鉴权 ----------
class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- 记录 ----------
class RecordCreate(BaseModel):
    content: str
    modality: str = "text"


class ParseResult(BaseModel):
    item: str | None = None
    location: str | None = None
    placed_at: str | None = None
    note: str | None = None
    confidence: float = 0.0


class RecordResponse(BaseModel):
    id: int
    item: str | None = None
    location: str | None = None
    placed_at: str | None = None
    note: str | None = None
    confidence: float
    confirmed: bool
    needs_confirm: bool


class ConfirmRequest(BaseModel):
    item: str | None = None
    location: str | None = None
    placed_at: str | None = None
    note: str | None = None


# ---------- 对话 ----------
class ChatRequest(BaseModel):
    message: str
    mode: str = "auto"  # auto | record | query（后两者为强制覆盖）


class ChatResponse(BaseModel):
    type: str  # record | query | unknown
    intent: str
    answer: str
    record: RecordResponse | None = None
    records: list[RecordResponse] = Field(default_factory=list)
