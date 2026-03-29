from fastapi import APIRouter, UploadFile, File

from app.models.schemas import LLMSettings, UploadResponse
from app.services.csv_parser import parse_sample_reviews
from app.config import settings as app_settings

router = APIRouter()

# Runtime LLM settings override (in-memory, per server session)
_runtime_llm_settings: dict = {}


@router.get("/settings/llm", response_model=LLMSettings)
async def api_get_llm_settings():
    """Get current LLM settings (runtime overrides merged with defaults)."""
    return LLMSettings(
        api_key=_runtime_llm_settings.get("api_key") or "",
        api_url=_runtime_llm_settings.get("api_url") or app_settings.featherless_api_url,
        model=_runtime_llm_settings.get("model") or app_settings.llm_model,
        temperature=_runtime_llm_settings.get("temperature", app_settings.llm_temperature),
        max_tokens=_runtime_llm_settings.get("max_tokens", app_settings.llm_max_tokens),
        top_p=_runtime_llm_settings.get("top_p", app_settings.llm_top_p),
        frequency_penalty=_runtime_llm_settings.get("frequency_penalty", app_settings.llm_frequency_penalty),
        presence_penalty=_runtime_llm_settings.get("presence_penalty", app_settings.llm_presence_penalty),
    )


@router.put("/settings/llm", response_model=LLMSettings)
async def api_update_llm_settings(new_settings: LLMSettings):
    """Update runtime LLM settings."""
    global _runtime_llm_settings
    update = new_settings.model_dump(exclude_none=True)
    _runtime_llm_settings.update(update)
    return await api_get_llm_settings()


@router.post("/upload/samples", response_model=UploadResponse)
async def api_upload_samples(file: UploadFile = File(...)):
    """Upload and validate a sample reviews CSV."""
    return await parse_sample_reviews(file)
