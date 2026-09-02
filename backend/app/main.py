import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.cases import router as cases_router
from app.routers.gates import router as gates_router
from app.routers.incident import router as incident_router
from app.routers.judging import router as judging_router
from app.routers.questions import router as questions_router
from app.routers.submissions import router as submissions_router
from app.routers.teams import router as teams_router
from app.websocket.routes import router as websocket_router

logger = logging.getLogger("digihunt")

app = FastAPI(
    title="DigiHunt API",
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url="/redoc" if settings.api_docs_enabled else None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
)

# Middleware runs in reverse-add order (last added = outermost), so adding
# CORS after rate-limit means CORS still wraps everything, including 429s.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)

app.include_router(auth_router)
app.include_router(teams_router)
app.include_router(questions_router)
app.include_router(incident_router)
app.include_router(cases_router)
app.include_router(submissions_router)
app.include_router(admin_router)
app.include_router(judging_router)
app.include_router(gates_router)
app.include_router(websocket_router)


@app.get("/health")
def health():
    return {"status": "ok"}
