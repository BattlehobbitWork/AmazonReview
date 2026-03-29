from pydantic import BaseModel, Field
from typing import Optional


class SampleReview(BaseModel):
    star_rating: int = Field(..., ge=1, le=5)
    review_text: str


class ProductItem(BaseModel):
    asin: str
    product_name: str


class ProductInfo(BaseModel):
    asin: str
    product_name: str
    description: Optional[str] = None
    average_rating: Optional[float] = None
    features: Optional[list[str]] = None
    positive_themes: Optional[list[str]] = None
    negative_themes: Optional[list[str]] = None
    scrape_failed: bool = False
    error_message: Optional[str] = None


class LLMSettings(BaseModel):
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=16384)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    frequency_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)


class ReviewGenerateRequest(BaseModel):
    asin: str
    product_name: str
    star_rating: int = Field(..., ge=1, le=5)
    product_info: Optional[ProductInfo] = None
    sample_reviews: list[SampleReview] = []
    llm_settings: Optional[LLMSettings] = None


class ReviewGenerateResponse(BaseModel):
    review_text: str
    model_used: str
    tokens_used: Optional[int] = None


class ExportRequest(BaseModel):
    reviews: list[dict]
    format: str = Field(default="csv", pattern="^(csv|txt)$")


class UploadResponse(BaseModel):
    success: bool
    row_count: int
    message: str
    data: Optional[list[dict]] = None
