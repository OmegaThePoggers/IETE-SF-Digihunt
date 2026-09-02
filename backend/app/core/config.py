from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEFAULT_JWT_SECRET = "local-only-change-before-deployment"
_DEFAULT_POSTGRES_PASSWORD_FRAGMENT = "digihunt-local-password"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    app_env: str = "development"
    database_url: str
    jwt_secret: str
    upload_directory: str = "../uploads"
    ppt_directory: str = "../ppts"
    cors_origins: list[str] = ["http://localhost:3000"]
    access_token_expire_minutes: int = 480
    enable_api_docs: bool | None = None

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_must_be_safe_in_production(cls, value: str, info):
        app_env = info.data.get("app_env", "development")
        if app_env == "production" and (
            len(value) < 32 or value == _DEFAULT_JWT_SECRET
        ):
            raise ValueError("JWT_SECRET must be at least 32 characters in production")
        return value

    @field_validator("database_url")
    @classmethod
    def database_url_must_not_use_local_default_in_production(cls, value: str, info):
        app_env = info.data.get("app_env", "development")
        if app_env == "production" and _DEFAULT_POSTGRES_PASSWORD_FRAGMENT in value:
            raise ValueError("POSTGRES_PASSWORD must be changed for production")
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def api_docs_enabled(self) -> bool:
        if self.enable_api_docs is not None:
            return self.enable_api_docs
        return not self.is_production


settings = Settings()
