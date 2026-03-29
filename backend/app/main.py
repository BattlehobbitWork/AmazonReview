from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import reviews, products, settings as settings_routes, state

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

app.include_router(reviews.router, prefix="/api", tags=["reviews"])
app.include_router(products.router, prefix="/api", tags=["products"])
app.include_router(settings_routes.router, prefix="/api", tags=["settings"])
app.include_router(state.router, prefix="/api", tags=["state"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Capitalism But Make It Hot"}
