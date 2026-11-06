from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, chat, parser, records
from app.core.config import settings
from app.db.session import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="置物窝 API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(records.router, prefix="/api/v1/records", tags=["records"])
    app.include_router(parser.router, prefix="/api/v1/parser", tags=["parser"])
    app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app
