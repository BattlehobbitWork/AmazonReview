"""Price tracker API routes."""

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from app.services.price_db import (
    add_products,
    get_tracked_products,
    get_price_history,
    get_price_summary,
    remove_product,
)
from app.services.price_scheduler import run_price_check_now

router = APIRouter()


class TrackProductsRequest(BaseModel):
    products: list[dict]


class TrackProductsResponse(BaseModel):
    added: int
    skipped: int
    total: int
    message: str


class PriceHistoryEntry(BaseModel):
    price: Optional[float]
    scraped_at: str
    scrape_failed: int
    error_message: Optional[str]


class PriceSummaryEntry(BaseModel):
    asin: str
    product_name: str
    added_at: str
    current_price: Optional[float]
    last_checked: Optional[str]
    lowest_price_365d: Optional[float]
    lowest_price_date: Optional[str]
    highest_price_365d: Optional[float]
    check_count: int


@router.post("/prices/track", response_model=TrackProductsResponse)
async def api_track_products(req: TrackProductsRequest):
    """Add products to price tracking. Skips duplicates."""
    result = add_products(req.products)
    return TrackProductsResponse(
        added=result["added"],
        skipped=result["skipped"],
        total=result["total"],
        message=f"Added {result['added']} new products, {result['skipped']} already tracked",
    )


@router.get("/prices/tracked")
async def api_get_tracked():
    """Get all actively tracked products."""
    return get_tracked_products(active_only=True)


@router.get("/prices/summary")
async def api_get_summary():
    """Get price summary for all tracked products."""
    return get_price_summary()


@router.get("/prices/history/{asin}")
async def api_get_history(asin: str, days: int = 365):
    """Get price history for a specific product."""
    return get_price_history(asin, days=days)


@router.post("/prices/check-now")
async def api_check_now(background_tasks: BackgroundTasks):
    """Trigger an immediate price check for all tracked products."""
    background_tasks.add_task(run_price_check_now)
    return {"message": "Price check started in background"}


@router.delete("/prices/track/{asin}")
async def api_untrack(asin: str):
    """Stop tracking a product (preserves history)."""
    remove_product(asin)
    return {"message": f"Stopped tracking {asin}"}
