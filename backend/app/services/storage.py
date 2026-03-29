"""Server-side JSON file persistence for app state."""

import json
import os
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data"))
STATE_FILE = DATA_DIR / "state.json"

DEFAULT_STATE: dict[str, Any] = {
    "sampleReviews": [],
    "productList": [],
    "outputReviews": [],
    "productDrafts": {},
    "currentProductIndex": 0,
    "llmSettings": {},
    "outputFormat": "csv",
}


def _ensure_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict[str, Any]:
    """Load app state from disk, returning defaults if missing."""
    _ensure_dir()
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                stored = json.load(f)
            # Merge with defaults so new keys are always present
            merged = {**DEFAULT_STATE, **stored}
            return merged
        except (json.JSONDecodeError, IOError):
            return dict(DEFAULT_STATE)
    return dict(DEFAULT_STATE)


def save_state(state: dict[str, Any]) -> dict[str, Any]:
    """Save app state to disk. Returns the saved state."""
    _ensure_dir()
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    return state


def patch_state(partial: dict[str, Any]) -> dict[str, Any]:
    """Merge partial update into existing state and save."""
    current = load_state()
    current.update(partial)
    return save_state(current)
