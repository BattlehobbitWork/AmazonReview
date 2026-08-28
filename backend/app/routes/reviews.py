from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.schemas import (
    ReviewGenerateRequest, ReviewGenerateResponse, ExportRequest,
    AutoGenerateRequest, AutoGenerateResponse,
)
from app.services.llm import generate_review
from app.services.scraper import scrape_product
from app.services.csv_parser import export_reviews_csv, export_reviews_txt

router = APIRouter()


@router.post("/reviews/generate", response_model=ReviewGenerateResponse)
async def api_generate_review(request: ReviewGenerateRequest):
    """Generate a review via the LLM."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info(f"Generate request: asin={request.asin}, stars={request.star_rating}, samples={len(request.sample_reviews)}")
        result = await generate_review(request)
        logger.info(f"Generated OK: {len(result.review_text)} chars, model={result.model_used}")
        return result
    except ValueError as e:
        logger.error(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"LLM error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")


@router.post("/reviews/generate-auto", response_model=AutoGenerateResponse)
async def api_auto_generate(request: AutoGenerateRequest):
    """Scrape product info + generate a review in one call."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        # Scrape product info
        product_info = await scrape_product(request.asin)
        logger.info(f"Auto-gen scrape: asin={request.asin}, failed={product_info.scrape_failed}")

        # Determine star rating: use provided, or Amazon average (rounded), or default 4
        star_rating = request.star_rating
        if star_rating is None:
            if product_info.average_rating and not product_info.scrape_failed:
                star_rating = max(1, min(5, round(product_info.average_rating)))
            else:
                star_rating = 4

        # Build generate request
        gen_request = ReviewGenerateRequest(
            asin=request.asin,
            product_name=request.product_name,
            star_rating=star_rating,
            product_info=product_info,
            sample_reviews=request.sample_reviews,
            llm_settings=request.llm_settings,
        )
        result = await generate_review(gen_request)
        logger.info(f"Auto-gen OK: asin={request.asin}, {len(result.review_text)} chars")

        return AutoGenerateResponse(
            asin=request.asin,
            product_name=request.product_name,
            star_rating=star_rating,
            review_title=result.review_title,
            review_text=result.review_text,
            model_used=result.model_used,
            tokens_used=result.tokens_used,
            scrape_failed=product_info.scrape_failed,
        )
    except ValueError as e:
        logger.error(f"Auto-gen ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Auto-gen error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Auto-generate error: {str(e)}")


@router.post("/reviews/export")
async def api_export_reviews(request: ExportRequest):
    """Export reviews as CSV or TXT download."""
    if request.format == "csv":
        content = export_reviews_csv(request.reviews)
        media_type = "text/csv"
        filename = "reviews.csv"
    else:
        content = export_reviews_txt(request.reviews)
        media_type = "text/plain"
        filename = "reviews.txt"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
