from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.schemas import ReviewGenerateRequest, ReviewGenerateResponse, ExportRequest
from app.services.llm import generate_review
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
