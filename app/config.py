"""
app/config.py — Centralised settings (Block 9).
Reads from environment variables / .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Simple settings bag backed by environment variables."""

    @property
    def SECRET_KEY(self) -> str:
        return os.getenv("SECRET_KEY", "")

    @property
    def ENVIRONMENT(self) -> str:
        return os.getenv("ENVIRONMENT", "development")

    @property
    def IS_PRODUCTION(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def DATABASE_URL(self) -> str:
        return os.getenv("DATABASE_URL", "")

    @property
    def FRONTEND_URL(self) -> str:
        return os.getenv("FRONTEND_URL", "http://localhost:3000")

    @property
    def ADMIN_API_KEY(self) -> str:
        return os.getenv("ADMIN_API_KEY", "")

    @property
    def ADMIN_USERNAMES(self) -> str:
        return os.getenv("ADMIN_USERNAMES", "")


settings = Settings()
