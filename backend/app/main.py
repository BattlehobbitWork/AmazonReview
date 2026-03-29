from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes import reviews, products, settings as settings_routes, state, auth
from app.routes.auth import verify_token
from app.config import settings as app_settings

app = FastAPI(
    title="Capitalism But Make It Hot",
    description="Amazon Vine Review Assistant API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth routes (public, no token needed)
app.include_router(auth.router, prefix="/api", tags=["auth"])


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Protect all /api/* routes except auth and health."""
    path = request.url.path
    # Public endpoints — no auth required
    if (
        not path.startswith("/api/")
        or path.startswith("/api/auth/")
        or path == "/api/health"
    ):
        return await call_next(request)

    # If no password configured, skip auth
    if not app_settings.app_password:
        return await call_next(request)

    # Check Authorization header
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    if not verify_token(token):
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


app.include_router(reviews.router, prefix="/api", tags=["reviews"])
app.include_router(products.router, prefix="/api", tags=["products"])
app.include_router(settings_routes.router, prefix="/api", tags=["settings"])
app.include_router(state.router, prefix="/api", tags=["state"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Capitalism But Make It Hot"}
