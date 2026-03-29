"""CSV import/export logic."""

import csv
import io
from typing import Optional

from fastapi import UploadFile

from app.models.schemas import SampleReview, ProductItem, UploadResponse


async def parse_sample_reviews(file: UploadFile) -> UploadResponse:
    """Parse a sample reviews CSV. Required columns: star_rating, review_text."""
    try:
        content = (await file.read()).decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))

        if not reader.fieldnames:
            return UploadResponse(success=False, row_count=0, message="Empty or invalid CSV file")

        lower_fields = {f.lower().strip(): f for f in reader.fieldnames}
        if "star_rating" not in lower_fields or "review_text" not in lower_fields:
            return UploadResponse(
                success=False, row_count=0,
                message=f"Missing required columns. Found: {list(reader.fieldnames)}. Need: star_rating, review_text",
            )

        sr_key = lower_fields["star_rating"]
        rt_key = lower_fields["review_text"]
        rows: list[dict] = []
        for row in reader:
            rating_str = (row.get(sr_key) or "").strip()
            text = (row.get(rt_key) or "").strip()
            if rating_str and text:
                try:
                    rating = int(float(rating_str))
                    if 1 <= rating <= 5:
                        rows.append({"star_rating": rating, "review_text": text})
                except ValueError:
                    continue

        return UploadResponse(
            success=True, row_count=len(rows),
            message=f"Parsed {len(rows)} sample reviews",
            data=rows,
        )
    except Exception as e:
        return UploadResponse(success=False, row_count=0, message=f"Parse error: {str(e)}")


async def parse_product_list(file: UploadFile) -> UploadResponse:
    """Parse a product list CSV. Required columns: ASIN, Product Name."""
    try:
        content = (await file.read()).decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))

        if not reader.fieldnames:
            return UploadResponse(success=False, row_count=0, message="Empty or invalid CSV file")

        lower_fields = {f.lower().strip(): f for f in reader.fieldnames}
        asin_key: Optional[str] = lower_fields.get("asin")
        name_key: Optional[str] = lower_fields.get("product name") or lower_fields.get("product_name")

        if not asin_key or not name_key:
            return UploadResponse(
                success=False, row_count=0,
                message=f"Missing required columns. Found: {list(reader.fieldnames)}. Need: ASIN, Product Name",
            )

        rows: list[dict] = []
        for row in reader:
            asin = (row.get(asin_key) or "").strip()
            name = (row.get(name_key) or "").strip()
            if asin and name:
                rows.append({"asin": asin, "product_name": name})

        return UploadResponse(
            success=True, row_count=len(rows),
            message=f"Parsed {len(rows)} products",
            data=rows,
        )
    except Exception as e:
        return UploadResponse(success=False, row_count=0, message=f"Parse error: {str(e)}")


def export_reviews_csv(reviews: list[dict]) -> str:
    """Generate CSV string from review data."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["ASIN", "Product Name", "Star Rating", "Review Text"])
    writer.writeheader()
    for r in reviews:
        writer.writerow({
            "ASIN": r.get("asin", ""),
            "Product Name": r.get("product_name", ""),
            "Star Rating": r.get("star_rating", ""),
            "Review Text": r.get("review_text", ""),
        })
    return output.getvalue()


def export_reviews_txt(reviews: list[dict]) -> str:
    """Generate plain text from review data."""
    lines: list[str] = []
    for i, r in enumerate(reviews, 1):
        lines.append(f"--- Review {i} ---")
        lines.append(f"ASIN: {r.get('asin', '')}")
        lines.append(f"Product: {r.get('product_name', '')}")
        lines.append(f"Stars: {r.get('star_rating', '')}")
        lines.append(f"Review:\n{r.get('review_text', '')}")
        lines.append("")
    return "\n".join(lines)
