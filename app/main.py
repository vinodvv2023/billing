from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .routers import auth_local, auth_oauth, billing, clients, rbac, timesheets

# Create tables automatically only outside production.
if not settings.is_production:
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="Multi-Provider OAuth API")

app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# CORS setup driven by env so frontend can move between local, Vercel, and other hosts.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_local.router)
app.include_router(auth_oauth.router)
app.include_router(rbac.router)
app.include_router(clients.router)
app.include_router(timesheets.router)
app.include_router(billing.router)

@app.get("/")
def root():
    return {"message": "Welcome to the OAuth unified backend"}


@app.get("/healthz")
def healthz():
    return {
        "status": "ok",
        "environment": settings.APP_ENV,
        "frontend_url": settings.FRONTEND_URL,
    }
