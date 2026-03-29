from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # LLM API
    featherless_api_key: str = Field(default="", env="FEATHERLESS_API_KEY")
    featherless_api_url: str = Field(default="https://api.featherless.ai/v1", env="FEATHERLESS_API_URL")
    llm_model: str = Field(default="", env="LLM_MODEL")

    # LLM Parameters (defaults)
    llm_temperature: float = Field(default=0.75)
    llm_max_tokens: int = Field(default=1024)
    llm_top_p: float = Field(default=0.9)
    llm_frequency_penalty: float = Field(default=0.3)
    llm_presence_penalty: float = Field(default=0.1)

    # Auth
    app_password: str = Field(default="", env="APP_PASSWORD")

    # Server
    vps_host: str = Field(default="0.0.0.0", env="VPS_HOST")
    domain: str = Field(default="https://vine.werewolfhowl.com", env="DOMAIN")

    model_config = {
        "env_file": ("../.env", ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
