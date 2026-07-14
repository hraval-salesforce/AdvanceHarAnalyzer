"""
Configuration management for different environments (local, staging, production)
"""
import os
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration"""
    ENVIRONMENT = os.getenv("ENVIRONMENT", "local")
    PORT = int(os.getenv("PORT", 8000))
    HOST = os.getenv("HOST", "0.0.0.0")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    APP_URL = os.getenv("APP_URL", "http://localhost:8000")

    # Parse CORS origins from comma-separated string
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []

class LocalConfig(Config):
    """Local development configuration"""
    DEBUG = True
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

class StagingConfig(Config):
    """Staging environment configuration"""
    DEBUG = False
    # Will be set via Heroku config vars

class ProductionConfig(Config):
    """Production environment configuration"""
    DEBUG = False
    # Will be set via Heroku config vars

# Configuration mapping
config_map = {
    "local": LocalConfig,
    "staging": StagingConfig,
    "production": ProductionConfig
}

def get_config():
    """Get configuration based on ENVIRONMENT variable"""
    env = os.getenv("ENVIRONMENT", "local")
    return config_map.get(env, LocalConfig)()
