import os
from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import auth_local, auth_oauth

# Create tables if not exist (In production, use Alembic migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Multi-Provider OAuth API")

# Setup session middleware which is required by Authlib for storing OAuth state
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-for-session")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# CORS setup (allow Next.js frontend usually running on 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_local.router)
app.include_router(auth_oauth.router)

@app.get("/")
def root():
    return {"message": "Welcome to the OAuth unified backend"}
