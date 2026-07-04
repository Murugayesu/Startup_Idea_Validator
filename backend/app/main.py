from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import router

settings = get_settings()

app = FastAPI(
    title="Startup Idea Validator API",
    description="Multi-agent AI validation pipeline for startup ideas",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
