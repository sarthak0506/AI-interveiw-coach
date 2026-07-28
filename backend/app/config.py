from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central app config. Values come from environment variables (or a .env
    file in local dev). Never hardcode secrets here.
    """

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/interview_coach"
    jwt_secret: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 hours

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
