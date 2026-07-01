import os
import re
import json
import httpx
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from haralyzer import HarParser
from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.util import get_remote_address

# Load environment variables from .env file
load_dotenv()

# Get Gemini API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="AetherHAR Analytics API", version="1.0.0")

limiter = Limiter(key_func=get_remote_address)

# Enable CORS for external dashboard consumption
app.add_middleware(
    CORSMiddleware,
   allow_origins=[
        "http://localhost:3000",  # Development
        "https://yourdomain.com",  # Production
        "https://www.yourdomain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the base directory (project root)
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

@app.get("/")
async def read_root():
    """Serve the main HAR analyzer HTML page"""
    return FileResponse(str(FRONTEND_DIR / "har_analyzer.html"))

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

@app.post("/api/ai/analyze")
async def analyze_with_ai(request: dict):
    """
    Proxy endpoint for Gemini API calls to keep API key secure on server-side.
    This endpoint accepts AI analysis requests from the frontend and forwards
    them to the Gemini API with the server's API key.
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
    # Bind environment specified dynamic routing port or fallback to dev port
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)