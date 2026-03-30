"""Background scheduler that periodically scrapes prices for all tracked products."""

import asyncio
import logging
from typing import Optional

from app.services.price_db import get_tracked_products, record_price
from app.services.scraper import scrape_product

logger = logging.getLogger("price_scheduler")

_task: Optional[asyncio.Task] = None
_CHECK_INTERVAL_HOURS = 12


async def _check_all_prices():
    """Scrape prices for all active tracked products."""
    products = get_tracked_products(active_only=True)
    if not products:
        logger.info("No tracked products, skipping price check.")
        return

    logger.info(f"Starting price check for {len(products)} products...")
    success = 0
    failed = 0

    for p in products:
        asin = p["asin"]
        try:
            info = await scrape_product(asin, max_retries=2)
            if info.scrape_failed:
                record_price(asin, None, failed=True, error=info.error_message)
                failed += 1
            else:
                record_price(asin, info.price, failed=False)
                success += 1
        except Exception as e:
            record_price(asin, None, failed=True, error=str(e))
            failed += 1

        # Small extra delay between products to be polite
        await asyncio.sleep(1)

    logger.info(f"Price check complete: {success} success, {failed} failed out of {len(products)}")


async def _scheduler_loop():
    """Run price checks on a fixed interval."""
    while True:
        try:
            await _check_all_prices()
        except Exception as e:
            logger.error(f"Price check cycle failed: {e}")
        # Wait for next cycle
        await asyncio.sleep(_CHECK_INTERVAL_HOURS * 3600)


def start_scheduler():
    """Start the background price checking scheduler."""
    global _task
    if _task is not None and not _task.done():
        logger.info("Scheduler already running.")
        return
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_scheduler_loop())
    logger.info(f"Price scheduler started (every {_CHECK_INTERVAL_HOURS}h)")


def stop_scheduler():
    """Stop the background scheduler."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        _task = None
        logger.info("Price scheduler stopped.")


async def run_price_check_now():
    """Trigger an immediate price check (for manual trigger via API)."""
    await _check_all_prices()
