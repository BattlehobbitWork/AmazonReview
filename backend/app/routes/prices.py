"""Price tracker API routes."""

import csv
import io

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from app.services.price_db import (
    add_products,
    get_tracked_products,
    get_price_history,
    get_price_summary,
    get_export_data,
    remove_product,
)
from app.services.price_scheduler import run_price_check_now

router = APIRouter()


class TrackProductsRequest(BaseModel):
    products: list[dict]


class TrackProductsResponse(BaseModel):
    added: int
    skipped: int
    initial_prices: int = 0
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
    msg = f"Added {result['added']} new products, {result['skipped']} already tracked"
    if result.get("initial_prices", 0) > 0:
        msg += f", {result['initial_prices']} initial prices recorded"
    return TrackProductsResponse(
        added=result["added"],
        skipped=result["skipped"],
        initial_prices=result.get("initial_prices", 0),
        total=result["total"],
        message=msg,
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


@router.get("/prices/export")
async def api_export_csv():
    """Download a CSV report of all tracked products with prices."""
    data = get_export_data()
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["ASIN", "Product Name", "Purchase Date", "Current Price", "Lowest Price (365d)"],
    )
    writer.writeheader()
    for row in data:
        writer.writerow({
            "ASIN": row["asin"],
            "Product Name": row["product_name"],
            "Purchase Date": row.get("purchase_date") or "",
            "Current Price": f"${row['current_price']:.2f}" if row.get("current_price") is not None else "",
            "Lowest Price (365d)": f"${row['lowest_price_365d']:.2f}" if row.get("lowest_price_365d") is not None else "",
        })
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=price_tracker_report.csv"},
    )
