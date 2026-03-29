"""Simple password-based auth for the app."""

import hashlib
import secrets
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings

router = APIRouter()

# In-memory token store: token -> expiry timestamp
_tokens: dict[str, float] = {}
TOKEN_TTL = 7 * 24 * 3600  # 7 days


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_in: int


def _clean_expired():
    now = time.time()
    expired = [t for t, exp in _tokens.items() if exp < now]
    for t in expired:
        _tokens.pop(t, None)


def verify_token(token: str) -> bool:
    """Check if a token is valid and not expired."""
    if not settings.app_password:
        return True  # No password configured = no auth required
    _clean_expired()
    return token in _tokens and _tokens[token] > time.time()


@router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """Validate password and return a session token."""
    if not settings.app_password:
        # No password set — grant access
        token = secrets.token_hex(32)
        _tokens[token] = time.time() + TOKEN_TTL
        return LoginResponse(token=token, expires_in=TOKEN_TTL)

    if req.password != settings.app_password:
        raise HTTPException(status_code=401, detail="Invalid password")

    token = secrets.token_hex(32)
    _tokens[token] = time.time() + TOKEN_TTL
    _clean_expired()
    return LoginResponse(token=token, expires_in=TOKEN_TTL)


@router.get("/auth/check")
async def check_auth():
    """Public endpoint — just confirms auth is enabled or not."""
    return {"auth_required": bool(settings.app_password)}
