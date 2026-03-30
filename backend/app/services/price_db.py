"""SQLite-backed price tracking database."""

import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Optional

_DATA_DIR = os.environ.get("DATA_DIR", "./data")
_DB_PATH = os.path.join(_DATA_DIR, "price_tracker.db")
_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    """Get a SQLite connection, creating tables if needed."""
    os.makedirs(_DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tracked_products (
            asin TEXT PRIMARY KEY,
            product_name TEXT NOT NULL,
            added_at TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            purchase_date TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asin TEXT NOT NULL,
            price REAL,
            scraped_at TEXT NOT NULL,
            scrape_failed INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            FOREIGN KEY (asin) REFERENCES tracked_products(asin)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_price_history_asin
        ON price_history(asin, scraped_at)
    """)
    # Migration: add purchase_date column if missing (existing DBs)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(tracked_products)").fetchall()]
    if "purchase_date" not in cols:
        conn.execute("ALTER TABLE tracked_products ADD COLUMN purchase_date TEXT")
    conn.commit()
    return conn


def add_products(products: list[dict]) -> dict:
    """Add products to tracking. Returns counts of added vs skipped.
    
    Each product dict can optionally include a 'price' key to record
    an initial price snapshot (e.g. the order price from the CSV).
    """
    added = 0
    skipped = 0
    initial_prices = 0
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _get_conn()
        try:
            for p in products:
                asin = p.get("asin", "").strip()
                name = p.get("product_name", "").strip()
                if not asin or not name:
                    continue
                existing = conn.execute(
                    "SELECT asin FROM tracked_products WHERE asin = ?", (asin,)
                ).fetchone()
                purchase_date = (p.get("purchase_date") or "").strip() or None
                if existing:
                    # Reactivate if it was deactivated, update name and purchase_date if provided
                    if purchase_date:
                        conn.execute(
                            "UPDATE tracked_products SET active = 1, product_name = ?, purchase_date = ? WHERE asin = ?",
                            (name, purchase_date, asin),
                        )
                    else:
                        conn.execute(
                            "UPDATE tracked_products SET active = 1, product_name = ? WHERE asin = ?",
                            (name, asin),
                        )
                    skipped += 1
                else:
                    conn.execute(
                        "INSERT INTO tracked_products (asin, product_name, added_at, purchase_date) VALUES (?, ?, ?, ?)",
                        (asin, name, now, purchase_date),
                    )
                    added += 1

                # If an initial price was provided, record it (only if no history exists yet)
                raw_price = p.get("price")
                if raw_price is not None:
                    try:
                        price_val = float(str(raw_price).replace("$", "").replace(",", "").strip())
                        if price_val > 0:
                            has_history = conn.execute(
                                "SELECT 1 FROM price_history WHERE asin = ? LIMIT 1", (asin,)
                            ).fetchone()
                            if not has_history:
                                conn.execute(
                                    "INSERT INTO price_history (asin, price, scraped_at, scrape_failed) VALUES (?, ?, ?, 0)",
                                    (asin, price_val, now),
                                )
                                initial_prices += 1
                    except (ValueError, TypeError):
                        pass

            conn.commit()
        finally:
            conn.close()
    return {"added": added, "skipped": skipped, "initial_prices": initial_prices, "total": added + skipped}


def get_tracked_products(active_only: bool = True) -> list[dict]:
    """Get all tracked products."""
    with _lock:
        conn = _get_conn()
        try:
            query = "SELECT * FROM tracked_products"
            if active_only:
                query += " WHERE active = 1"
            query += " ORDER BY added_at DESC"
            rows = conn.execute(query).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def record_price(asin: str, price: Optional[float], failed: bool = False, error: Optional[str] = None):
    """Record a price snapshot for a product."""
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                "INSERT INTO price_history (asin, price, scraped_at, scrape_failed, error_message) VALUES (?, ?, ?, ?, ?)",
                (asin, price, now, 1 if failed else 0, error),
            )
            conn.commit()
        finally:
            conn.close()


def get_price_history(asin: str, days: int = 365) -> list[dict]:
    """Get price history for a product within the last N days."""
    with _lock:
        conn = _get_conn()
        try:
            rows = conn.execute(
                """
                SELECT price, scraped_at, scrape_failed, error_message
                FROM price_history
                WHERE asin = ?
                  AND scraped_at >= datetime('now', ?)
                  AND scrape_failed = 0
                ORDER BY scraped_at ASC
                """,
                (asin, f"-{days} days"),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def get_price_summary() -> list[dict]:
    """Get a summary of all tracked products with latest price, lowest price, and price count."""
    with _lock:
        conn = _get_conn()
        try:
            rows = conn.execute("""
                SELECT
                    tp.asin,
                    tp.product_name,
                    tp.added_at,
                    tp.purchase_date,
                    (SELECT ph.price FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     ORDER BY ph.scraped_at DESC LIMIT 1) as current_price,
                    (SELECT ph.scraped_at FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     ORDER BY ph.scraped_at DESC LIMIT 1) as last_checked,
                    (SELECT MIN(ph.price) FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     AND ph.scraped_at >= datetime('now', '-365 days')) as lowest_price_365d,
                    (SELECT ph.scraped_at FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     AND ph.scraped_at >= datetime('now', '-365 days')
                     ORDER BY ph.price ASC LIMIT 1) as lowest_price_date,
                    (SELECT MAX(ph.price) FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     AND ph.scraped_at >= datetime('now', '-365 days')) as highest_price_365d,
                    (SELECT COUNT(*) FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL) as check_count
                FROM tracked_products tp
                WHERE tp.active = 1
                ORDER BY tp.product_name ASC
            """).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def remove_product(asin: str):
    """Deactivate a product (keeps history)."""
    with _lock:
        conn = _get_conn()
        try:
            conn.execute("UPDATE tracked_products SET active = 0 WHERE asin = ?", (asin,))
            conn.commit()
        finally:
            conn.close()


def get_export_data() -> list[dict]:
    """Get data for CSV export: ASIN, product name, purchase date, lowest price."""
    with _lock:
        conn = _get_conn()
        try:
            rows = conn.execute("""
                SELECT
                    tp.asin,
                    tp.product_name,
                    tp.purchase_date,
                    (SELECT MIN(ph.price) FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     AND ph.scraped_at >= datetime('now', '-365 days')) as lowest_price_365d,
                    (SELECT ph.price FROM price_history ph
                     WHERE ph.asin = tp.asin AND ph.scrape_failed = 0 AND ph.price IS NOT NULL
                     ORDER BY ph.scraped_at DESC LIMIT 1) as current_price
                FROM tracked_products tp
                WHERE tp.active = 1
                ORDER BY tp.product_name ASC
            """).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
