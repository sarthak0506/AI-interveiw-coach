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
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-4o-mini"
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_fallback_provider: str = "groq"
    fallback_api_key: str = ""
    fallback_model: str = ""
    # Groq credential used by speech-to-text, not by the LLM fallback.
    groq_api_key: str = ""
    sarvam_api_key: str = ""
    sarvam_model: str = "bulbul:v3"
    sarvam_speaker: str = "shubh"
    sarvam_target_language: str = "en-IN"
    supertonic_endpoint: str = "http://127.0.0.1:7788"
    supertonic_voice: str = "F3"
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_model: str = "eleven_turbo_v2_5"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
