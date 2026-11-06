import sys
from pathlib import Path

# 让 tests 能 import 到 app 包（apps/api 需加入 sys.path）
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import app_factory as app_factory_mod
from app.api import deps as deps_mod
from app.db import session as session_mod
from app.db.session import Base, get_db
from app.app_factory import create_app


@pytest.fixture
def client(monkeypatch):
    # 使用内存 SQLite（StaticPool 保证多会话共享同一连接）
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    # 把模块级 engine / SessionLocal 全部指向测试库，覆盖 lifespan 与鉴权中的直接引用
    monkeypatch.setattr(session_mod, "engine", engine)
    monkeypatch.setattr(session_mod, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(app_factory_mod, "engine", engine)  # lifespan 里直接引用的模块级 engine
    monkeypatch.setattr(deps_mod, "SessionLocal", TestingSessionLocal)

    # 测试期强制走规则解析，避免单测触网或依赖 API Key
    from app.core.config import settings

    monkeypatch.setattr(settings, "parser_backend", "rule")
    monkeypatch.setattr(settings, "llm_api_key", "")

    app = create_app()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c

    Base.metadata.drop_all(bind=engine)
