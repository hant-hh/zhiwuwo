import os


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv(
            "DATABASE_URL", "postgresql+psycopg2://zhiwuwo:change-me@postgres:5432/zhiwuwo"
        )
        self.secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
        self.algorithm: str = "HS256"
        self.access_token_expire_minutes: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
        )
        cors = os.getenv("CORS_ORIGINS", "*")
        self.cors_origins: list[str] = (
            [o.strip() for o in cors.split(",") if o.strip()] or ["*"]
        )

        # ===== AI 解析（Agnes 2.5 Flash，OpenAI 兼容 Chat Completions）=====
        self.llm_api_key: str = os.getenv("LLM_API_KEY", "").strip()
        self.llm_base_url: str = (
            os.getenv("LLM_BASE_URL", "https://api.agnes-ai.cn/v1").strip().rstrip("/")
        )
        self.llm_model: str = os.getenv("LLM_MODEL", "agnes-2.5-flash").strip()
        try:
            self.llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "8"))
        except ValueError:
            self.llm_timeout = 8.0
        # rule=纯规则（代码默认，零成本）；llm=Agnes 2.5 Flash（失败自动回退 rule）
        self.parser_backend: str = os.getenv("PARSER_BACKEND", "rule").strip().lower()
        # 隐私开关：关闭后即使配置了 Key 也不把录入文本发给第三方 AI
        self.llm_consent: bool = os.getenv("LLM_CONSENT", "true").strip().lower() in (
            "1", "true", "yes", "on",
        )


settings = Settings()
