"""API routes for server-side app state persistence."""

from fastapi import APIRouter
from app.services.storage import load_state, save_state, patch_state

router = APIRouter()


@router.get("/state")
async def api_get_state():
    """Load the full app state from disk."""
    return load_state()


@router.put("/state")
async def api_put_state(state: dict):
    """Replace the full app state on disk."""
    return save_state(state)


@router.patch("/state")
async def api_patch_state(partial: dict):
    """Merge a partial update into the existing state."""
    return patch_state(partial)
