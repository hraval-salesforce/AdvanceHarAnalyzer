"""
Database configuration and models for admin panel.
Uses PostgreSQL (Heroku Postgres) for production and SQLite for local development.
"""
import os
from sqlalchemy import create_engine, Column, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Database URL configuration
# Heroku provides DATABASE_URL automatically
DATABASE_URL = os.getenv("DATABASE_URL")

# Heroku Postgres URLs start with postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Fallback to SQLite for local development
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./admin_panel.db"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using them
    pool_size=10 if "postgresql" in DATABASE_URL else 1,
    max_overflow=20 if "postgresql" in DATABASE_URL else 0,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """Admin user model"""
    __tablename__ = "users"

    username = Column(String(50), primary_key=True, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class APIKey(Base):
    """Claude API Key storage model"""
    __tablename__ = "api_keys"

    api_key = Column(String(255), primary_key=True, unique=True, index=True)
    username = Column(String(50), nullable=False, index=True)
    key_name = Column(String(100), nullable=True)  # Optional friendly name for the key
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, nullable=True)


def get_db():
    """Dependency for getting database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print(f"✓ Database initialized: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'SQLite'}")


if __name__ == "__main__":
    init_db()
