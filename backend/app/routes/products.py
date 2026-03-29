from fastapi import APIRouter, UploadFile, File, HTTPException

from app.models.schemas import ProductInfo, UploadResponse
from app.services.scraper import scrape_product
from app.services.csv_parser import parse_product_list

router = APIRouter()

# In-memory product list storage (per server session)
_product_list: list[dict] = []


@router.post("/upload/products", response_model=UploadResponse)
async def api_upload_products(file: UploadFile = File(...)):
    """Upload and validate a product list CSV."""
    global _product_list
    result = await parse_product_list(file)
    if result.success and result.data:
        _product_list = result.data
    return result


@router.get("/products/{index}")
async def api_get_product(index: int):
    """Get product at index from uploaded list."""
    if not _product_list:
        raise HTTPException(status_code=404, detail="No product list uploaded")
    if index < 0 or index >= len(_product_list):
        raise HTTPException(status_code=404, detail=f"Index {index} out of range (0-{len(_product_list) - 1})")
    return _product_list[index]


@router.post("/products/{asin}/scrape", response_model=ProductInfo)
async def api_scrape_product(asin: str):
    """Scrape Amazon product page by ASIN."""
    return await scrape_product(asin)
