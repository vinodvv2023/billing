import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/mydb")

is_sqlite = DATABASE_URL.startswith("sqlite")

# Ensure sync psycopg2 is used (Neon uses standard postgresql:// which is fine)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # Add TCP keepalives so long-lived pooled connections don't die silently (common on cloud DBs/VPN).
    keepalive_params = "keepalives=1&keepalives_idle=30&keepalives_interval=10&keepalives_count=5"
    separator = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL_WITH_KEEPALIVES = f"{DATABASE_URL}{separator}{keepalive_params}"

    # Use pool_pre_ping to drop stale connections and recycle periodically.
    engine = create_engine(
        DATABASE_URL_WITH_KEEPALIVES,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_timeout=30,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
