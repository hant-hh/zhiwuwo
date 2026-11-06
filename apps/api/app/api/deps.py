from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import SessionLocal

bearer = HTTPBearer()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> User:
    try:
        payload = decode_access_token(creds.credentials)
        sub = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="无效或过期的令牌")
    if not sub or not str(sub).isdigit():
        raise HTTPException(status_code=401, detail="无效令牌")
    db: Session = SessionLocal()
    try:
        user = db.get(User, int(sub))
    finally:
        db.close()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user
