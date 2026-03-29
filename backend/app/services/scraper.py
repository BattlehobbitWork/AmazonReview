"""Amazon product page scraper service."""

import asyncio
import random
import time
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from app.models.schemas import ProductInfo

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

_last_request_time: float = 0.0
_MIN_REQUEST_INTERVAL = 3.0  # seconds between requests


async def _rate_limit():
    """Enforce minimum interval between Amazon requests."""
    global _last_request_time
    now = time.monotonic()
    elapsed = now - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        await asyncio.sleep(_MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.monotonic()


def _extract_product_info(html: str, asin: str) -> ProductInfo:
    """Parse Amazon product page HTML and extract structured info."""
    soup = BeautifulSoup(html, "lxml")

    # Product title
    title_el = soup.find("span", id="productTitle")
    title = title_el.get_text(strip=True) if title_el else ""

    # Description
    description = ""
    desc_el = soup.find("div", id="productDescription")
    if desc_el:
        description = desc_el.get_text(strip=True)
    if not description:
        feature_div = soup.find("div", id="feature-bullets")
        if feature_div:
            description = feature_div.get_text(" ", strip=True)

    # Average rating
    avg_rating: Optional[float] = None
    rating_el = soup.find("span", {"data-hook": "rating-out-of-text"})
    if rating_el:
        try:
            avg_rating = float(rating_el.get_text(strip=True).split()[0])
        except (ValueError, IndexError):
            pass
    if avg_rating is None:
        rating_el = soup.select_one("#acrPopover .a-size-base")
        if rating_el:
            try:
                avg_rating = float(rating_el.get_text(strip=True).split()[0])
            except (ValueError, IndexError):
                pass

    # Feature bullets
    features: list[str] = []
    bullets = soup.select("#feature-bullets .a-list-item")
    for b in bullets[:10]:
        text = b.get_text(strip=True)
        if text and len(text) > 5:
            features.append(text)

    # Review themes from review highlights
    positive_themes: list[str] = []
    negative_themes: list[str] = []

    # Try to get review summary snippets
    review_snippets = soup.select("[data-hook='review-body'] span")
    positive_keywords = {"great", "love", "excellent", "perfect", "amazing", "fantastic", "best", "good", "recommend"}
    negative_keywords = {"bad", "poor", "terrible", "waste", "broke", "cheap", "disappointing", "worst", "defective"}

    for snippet in review_snippets[:20]:
        text = snippet.get_text(strip=True).lower()
        if any(kw in text for kw in positive_keywords):
            short = snippet.get_text(strip=True)[:80]
            if short not in positive_themes and len(positive_themes) < 5:
                positive_themes.append(short)
        elif any(kw in text for kw in negative_keywords):
            short = snippet.get_text(strip=True)[:80]
            if short not in negative_themes and len(negative_themes) < 5:
                negative_themes.append(short)

    return ProductInfo(
        asin=asin,
        product_name=title or f"Product {asin}",
        description=description or None,
        average_rating=avg_rating,
        features=features or None,
        positive_themes=positive_themes or None,
        negative_themes=negative_themes or None,
        scrape_failed=False,
    )


async def scrape_product(asin: str, max_retries: int = 3) -> ProductInfo:
    """Scrape an Amazon product page by ASIN with rate limiting and retries."""
    url = f"https://www.amazon.com/dp/{asin}"
    headers = {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    for attempt in range(max_retries):
        try:
            await _rate_limit()

            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
                resp = await client.get(url, headers=headers)

            if resp.status_code == 200:
                return _extract_product_info(resp.text, asin)
            elif resp.status_code == 503:
                # Amazon is blocking us, back off
                wait = (2 ** attempt) + random.uniform(0.5, 1.5)
                await asyncio.sleep(wait)
                headers["User-Agent"] = random.choice(_USER_AGENTS)
                continue
            else:
                return ProductInfo(
                    asin=asin,
                    product_name=f"Product {asin}",
                    scrape_failed=True,
                    error_message=f"HTTP {resp.status_code} from Amazon",
                )
        except httpx.TimeoutException:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            return ProductInfo(
                asin=asin,
                product_name=f"Product {asin}",
                scrape_failed=True,
                error_message="Request timed out after multiple attempts",
            )
        except Exception as e:
            return ProductInfo(
                asin=asin,
                product_name=f"Product {asin}",
                scrape_failed=True,
                error_message=str(e),
            )

    return ProductInfo(
        asin=asin,
        product_name=f"Product {asin}",
        scrape_failed=True,
        error_message="Max retries exceeded (Amazon may be blocking requests)",
    )
