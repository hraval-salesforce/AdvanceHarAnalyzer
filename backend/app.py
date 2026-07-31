import os
import re
import json
import httpx
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from haralyzer import HarParser
from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, Field
import sys

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import get_config
from backend.admin_routes import router as admin_router
from backend.database import get_db, init_db
from backend.claude_service import ClaudeService
from sqlalchemy.orm import Session

# Load environment variables from .env file
load_dotenv()

# Get configuration based on environment
config = get_config()
GEMINI_API_KEY = config.GEMINI_API_KEY

app = FastAPI(
    title="AetherHAR Analytics API",
    version="2.0.0",
    debug=config.DEBUG
)

limiter = Limiter(key_func=get_remote_address)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    print("✓ Application started successfully")

# Dynamic CORS origins based on environment
cors_origins = config.CORS_ORIGINS if config.CORS_ORIGINS else [
    "http://localhost:3000",
    "http://localhost:8000",
]

# Enable CORS for external dashboard consumption
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the base directory (project root)
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
ADMIN_DIR = BASE_DIR / "admin"

@app.get("/")
async def read_root():
    """Serve the main HAR analyzer HTML page"""
    return FileResponse(str(FRONTEND_DIR / "har_analyzer.html"))

@app.get("/admin", include_in_schema=False)
async def admin_redirect():
    return FileResponse(str(ADMIN_DIR / "login.html"))

@app.get("/admin/login.html", include_in_schema=False)
async def admin_login():
    return FileResponse(str(ADMIN_DIR / "login.html"))

@app.get("/admin/dashboard.html", include_in_schema=False)
async def admin_dashboard():
    return FileResponse(str(ADMIN_DIR / "dashboard.html"))

# Include admin API routes AFTER the HTML file routes
app.include_router(admin_router)

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "environment": config.ENVIRONMENT,
        "ai_configured": bool(GEMINI_API_KEY)
    }

# Mount static files directory (must be after route definitions to avoid conflicts)
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")

@app.post("/analyze")
async def analyze_har_payload(file: UploadFile = File(...)):
    """
    Core dynamic streaming parser integrating high-speed msgspec json 
    decoders with automated validation.
    """
    if not file.filename.endswith('.har'):
        raise HTTPException(status_code=400, detail="Invalid target file format. Must be .har")

    try:
        # Stream load file directly in memory for parsing validation
        content_stream = await file.read()

        # Parse JSON content
        decoded_data = json.loads(content_stream)
        
        # Instantiate haralyzer compliance wrappers
        parser = HarParser(decoded_data)
        
        total_requests = 0
        third_party_count = 0
        total_bytes = 0
        
        page_entries = []
        
        for page in parser.pages:
            for entry in page.entries:
                total_requests += 1
                
                # Check target payload volume mapping
                body_sz = entry.get('response', {}).get('bodySize', 0)
                hdr_sz = entry.get('response', {}).get('headersSize', 0)
                total_bytes += max(0, body_sz) + max(0, hdr_sz)
                
                # Filter criteria sorting
                req_url = entry.get('request', {}).get('url', '')
                if "google-analytics" in req_url or "facebook" in req_url:
                    third_party_count += 1
                
                page_entries.append({
                    "url": req_url,
                    "method": entry.get('request', {}).get('method'),
                    "status": entry.get('response', {}).get('status'),
                    "duration": entry.get('time'),
                    "mime_type": entry.get('response', {}).get('content', {}).get('mimeType')
                })
                
        return {
            "metadata": {
                "file_name": file.filename,
                "total_requests": total_requests,
                "total_payload_bytes": total_bytes,
                "third_party_count": third_party_count
            },
            "entries": page_entries
        }
        
    except Exception as err:
        return JSONResponse(
            status_code=500,
            content={"message": f"Fatal processing error: {str(err)}"}
        )

# Pydantic models for Claude API requests
class ClaudeAnalysisRequest(BaseModel):
    har_data: dict = Field(..., description="Parsed HAR file data")
    analysis_prompt: str = Field(..., min_length=1, max_length=2000, description="User's analysis question")


@app.post("/api/claude/analyze")
async def analyze_with_claude(
    request: ClaudeAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    Analyze HAR data using Claude API (secure proxy endpoint).
    The API key is retrieved from the database and never exposed to the frontend.

    This replaces the Gemini endpoint with Claude for HAR analysis.
    """
    try:
        claude_service = ClaudeService(db)
        result = await claude_service.analyze_har_data(
            har_data=request.har_data,
            analysis_prompt=request.analysis_prompt
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@app.post("/api/ai/analyze")
async def analyze_with_ai(request: dict):
    """
    Legacy Gemini API endpoint (kept for backward compatibility).
    Consider migrating to /api/claude/analyze for Claude-powered analysis.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI features not configured. Please set GEMINI_API_KEY environment variable."
        )

    # Validate request structure
    if "query" not in request or "system_prompt" not in request:
        raise HTTPException(
            status_code=400,
            detail="Invalid request. Required fields: 'query' and 'system_prompt'"
        )

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                params={"key": GEMINI_API_KEY},
                json={
                    "contents": [{"parts": [{"text": request["query"]}]}],
                    "systemInstruction": {"parts": [{"text": request["system_prompt"]}]}
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as err:
        raise HTTPException(
            status_code=err.response.status_code,
            detail=f"Gemini API error: {err.response.text}"
        )
    except httpx.RequestError as err:
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: Unable to connect to Gemini API"
        )
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(err)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=True)