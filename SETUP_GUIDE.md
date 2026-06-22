# Setup Guide - Gemini HAR Analyzer

Complete setup instructions to get your HAR Analyzer running locally and deployed to production.

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Python 3.8+** (3.9 recommended)
  ```bash
  python3 --version
  ```

- **pip** (Python package manager)
  ```bash
  pip --version
  ```

- **Git** (for version control)
  ```bash
  git --version
  ```

### Required Accounts
- **Google Cloud Account** - For Gemini API key
  - Visit: https://makersuite.google.com/app/apikey
  - Create project and enable Gemini API

### Optional (for deployment)
- **Heroku Account** or **Render Account**
- **Domain name** (optional)

---

## Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone or navigate to project
cd /Users/hraval/Documents/SFCCprojects/GeminiHarAnalyzer

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Create environment file
cat > backend/.env << 'EOF'
GEMINI_API_KEY=your_key_here
PORT=8000
EOF

# 4. Fix Procfile naming
mv backend/procfile backend/Procfile

# 5. Start backend
cd backend && uvicorn app:app --reload

# 6. Open frontend
open frontend/har_analyzer_deployment_workspace.html
```

**⚠️ Important:** Replace `your_key_here` with your actual Gemini API key (Step 3 below).

---

## Detailed Setup

### Step 1: Install Python Dependencies

Navigate to the backend directory and install all required packages:

```bash
cd backend/
pip install -r requirements.txt
```

**Expected output:**
```
Successfully installed fastapi-0.110.0 uvicorn-0.28.0 msgspec-0.18.6 haralyzer-2.3.0 gunicorn-21.2.0 python-multipart-0.0.9
```

**Verify installation:**
```bash
python3 -c "import fastapi, uvicorn, msgspec, haralyzer, gunicorn; print('✓ All dependencies installed')"
```

**Common issues:**
- If `pip` fails, try `pip3` instead
- If permission denied, use `pip install --user -r requirements.txt`
- For virtual environment: `python3 -m venv venv && source venv/bin/activate`

### Step 2: Get Gemini API Key

1. **Visit Google AI Studio:**
   - Go to: https://makersuite.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key:**
   - Click "Create API Key"
   - Select or create a Google Cloud project
   - Copy the generated key (starts with `AIzaSy...`)

3. **Store safely:**
   ```bash
   # DO NOT share this key or commit to git
   # Example key format: AIzaSyBx1234567890abcdefghijklmnopqrst
   ```

**Cost Information:**
- Gemini 2.5 Flash Pricing (as of 2026):
  - Input: $0.000125 per 1K tokens
  - Output: $0.0005 per 1K tokens
- Free tier: 15 requests/minute, 1500 requests/day
- Typical HAR analysis: ~500-2000 tokens ($0.001-0.003 per request)

### Step 3: Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cd backend/
cat > .env << 'EOF'
# Gemini API Configuration
GEMINI_API_KEY=AIzaSyYOUR_ACTUAL_KEY_HERE

# Server Configuration
PORT=8000
HOST=0.0.0.0

# Worker Configuration (for Gunicorn)
WEB_CONCURRENCY=2

# CORS Configuration (optional)
ALLOWED_ORIGINS=*

# Environment
ENVIRONMENT=development
EOF
```

**Important:** Replace `AIzaSyYOUR_ACTUAL_KEY_HERE` with your actual key from Step 2.

**Security Note:**
- NEVER commit `.env` to git
- Add to `.gitignore` (see Step 4)

### Step 4: Configure Git Ignore

Create or update `.gitignore`:

```bash
cd ..  # Return to project root
cat > .gitignore << 'EOF'
# Environment variables
.env
*.env
.env.local
.env.production
backend/.env
frontend/.env

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Testing
.pytest_cache/
.coverage
htmlcov/
EOF
```

### Step 5: Fix Procfile Naming (for Heroku deployment)

```bash
mv backend/procfile backend/Procfile
```

**Why?** Heroku requires capital 'P' in Procfile.

### Step 6: Update Backend for API Proxy (CRITICAL SECURITY FIX)

Add this endpoint to `backend/app.py`:

```python
# Add after existing imports
import os
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Add this new endpoint before the __main__ block
@app.post("/api/ai/analyze")
async def analyze_with_ai(request: dict):
    """
    Proxy endpoint for Gemini API calls
    Keeps API key secure on server-side
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI features not configured. Please set GEMINI_API_KEY environment variable."
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
    except httpx.HTTPError as err:
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(err)}"
        )
```

**Add httpx to requirements.txt:**
```bash
echo "httpx==0.27.0" >> backend/requirements.txt
echo "python-dotenv==1.0.1" >> backend/requirements.txt
pip install httpx python-dotenv
```

### Step 7: Update Frontend to Use Backend Proxy

Edit `frontend/app.js`, replace the `callGemini` function (around line 1062):

```javascript
// OLD CODE (lines 1062-1093) - REMOVE THIS:
async function callGemini(systemPrompt, userQuery) {
    const apiKey = ""; 
    const url = `https://generativelanguage.googleapis.com/...`;
    // ... rest of old code
}

// NEW CODE - REPLACE WITH THIS:
async function callGemini(systemPrompt, userQuery) {
    // Call backend API proxy instead of Gemini directly
    const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000/api/ai/analyze'  // Local development
        : '/api/ai/analyze';  // Production (same domain)
    
    try {
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                system_prompt: systemPrompt,
                query: userQuery
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'AI analysis failed');
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error("No response received from AI model");
        }
        
        return text;
    } catch (err) {
        throw new Error(`Gemini AI error: ${err.message}`);
    }
}
```

**What changed:**
- ❌ Removed hardcoded API key from frontend
- ✅ API calls now go through backend proxy
- ✅ Automatic localhost detection for development
- ✅ Better error handling

---

## Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | None | Your Gemini API key from Google |
| `PORT` | ⬜ No | 8000 | Backend server port |
| `HOST` | ⬜ No | 0.0.0.0 | Backend server host |
| `WEB_CONCURRENCY` | ⬜ No | 2 | Number of Gunicorn workers |
| `ALLOWED_ORIGINS` | ⬜ No | * | CORS allowed origins (comma-separated) |
| `ENVIRONMENT` | ⬜ No | development | Environment name |

### Production Environment Variables

For production deployment (Heroku/Render):

```bash
# Set via platform UI or CLI:
heroku config:set GEMINI_API_KEY=your_actual_key
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com
heroku config:set ENVIRONMENT=production
```

---

## Running Locally

### Option 1: Development Mode (with auto-reload)

```bash
# Terminal 1: Start backend
cd backend/
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Serve frontend
cd frontend/
python3 -m http.server 3000
# OR use any static file server
```

**Access:**
- Backend API: http://localhost:8000
- Frontend: http://localhost:3000/har_analyzer_deployment_workspace.html
- API Docs: http://localhost:8000/docs

### Option 2: Production Mode (with Gunicorn)

```bash
# Start with Gunicorn (same as Heroku)
cd backend/
gunicorn -c gunicorn.conf.py app:app

# Serve frontend
cd frontend/
python3 -m http.server 3000
```

### Option 3: Single File Mode (No Backend)

If you only want to test frontend visualization (without AI features):

```bash
cd frontend/
open har_analyzer_deployment_workspace.html
# OR
python3 -m http.server 3000
```

**Note:** AI features will not work without the backend running.

---

## Testing

### Run Test Suite

```bash
# From project root
python3 test_analyzer.py
```

**Expected output:**
```
============================================================
HAR Analyzer - Comprehensive Test Suite
============================================================
Test 1: Checking backend imports...
  ✓ All imports successful
Test 2: Testing HAR parsing...
  ✓ Successfully parsed HAR with 2 entries
...
============================================================
TEST SUMMARY
============================================================
Passed: 8/8
Failed: 0/8
Success Rate: 100.0%

✓ All tests passed!
```

### Manual Testing

1. **Test Backend Health:**
   ```bash
   curl http://localhost:8000
   ```

2. **Test AI Proxy Endpoint:**
   ```bash
   curl -X POST http://localhost:8000/api/ai/analyze \
     -H "Content-Type: application/json" \
     -d '{"system_prompt":"You are a helpful assistant","query":"Say hello"}'
   ```

3. **Test Frontend:**
   - Open http://localhost:3000/har_analyzer_deployment_workspace.html
   - Click "Load Demo Session"
   - Verify waterfall renders
   - Click on a request and switch to "AI Explainer" tab
   - Click "🤖 Explain This Request with AI"
   - Verify AI response appears

### Test HAR File Upload

Download sample HAR:
```bash
curl -o sample.har https://raw.githubusercontent.com/ahmadnassri/har-examples/master/google.com.har
```

Upload via UI and verify analysis.

---

## Deployment

### Deploy to Heroku

#### Prerequisites
```bash
# Install Heroku CLI
brew install heroku/brew/heroku  # macOS
# OR: https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login
```

#### Deployment Steps

```bash
# 1. Create Heroku app
heroku create your-har-analyzer

# 2. Set environment variables
heroku config:set GEMINI_API_KEY=your_actual_key
heroku config:set ALLOWED_ORIGINS=https://your-har-analyzer.herokuapp.com

# 3. Ensure Procfile is correct
cat backend/Procfile
# Should show: web: gunicorn -c gunicorn.conf.py app:app

# 4. Create git repo if not exists
git init
git add .
git commit -m "Initial commit"

# 5. Deploy
git push heroku main

# 6. Open app
heroku open
```

#### Post-Deployment

```bash
# View logs
heroku logs --tail

# Check dyno status
heroku ps

# Scale workers
heroku ps:scale web=1

# Test API
curl https://your-har-analyzer.herokuapp.com/
```

### Deploy to Render

1. **Connect Repository:**
   - Visit https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo

2. **Configure Service:**
   - **Name:** har-analyzer
   - **Environment:** Python 3
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && gunicorn -c gunicorn.conf.py app:app`

3. **Set Environment Variables:**
   - `GEMINI_API_KEY` = your_actual_key
   - `ALLOWED_ORIGINS` = https://har-analyzer.onrender.com

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for build (~2-3 minutes)
   - Access at https://har-analyzer.onrender.com

### Deploy Frontend Separately (Optional)

**Netlify / Vercel:**
1. Create new site from git
2. Set publish directory: `frontend/`
3. No build command needed (static files)
4. Update frontend `backendUrl` to point to your backend domain

**GitHub Pages:**
```bash
# Create gh-pages branch
git checkout -b gh-pages
git push origin gh-pages

# Enable in repo Settings > Pages
```

---

## Troubleshooting

### Issue: "No module named 'fastapi'"

**Solution:**
```bash
cd backend/
pip install -r requirements.txt
# OR
pip3 install -r requirements.txt
```

### Issue: "AI features not configured"

**Causes:**
1. Missing `.env` file
2. Empty `GEMINI_API_KEY`
3. `.env` not loaded

**Solutions:**
```bash
# Check if .env exists
ls -la backend/.env

# Check if key is set
cat backend/.env | grep GEMINI_API_KEY

# Ensure python-dotenv is installed
pip install python-dotenv

# Test key directly
python3 -c "from dotenv import load_dotenv; import os; load_dotenv('backend/.env'); print(os.getenv('GEMINI_API_KEY'))"
```

### Issue: "CORS error" in browser

**Solution:**
Update `backend/app.py` to allow your frontend origin:
```python
allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://yourdomain.com"
]
```

### Issue: "Address already in use"

**Solution:**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# OR use different port
uvicorn app:app --port 8001
```

### Issue: Frontend can't connect to backend

**Check:**
1. Backend is running: `curl http://localhost:8000`
2. CORS is configured correctly
3. Frontend URL matches backend URL in `callGemini()`

**Debug:**
```javascript
// Add to frontend console
console.log('Backend URL:', backendUrl);
```

### Issue: "Procfile declares types -> web"

**Solution:**
```bash
# Ensure correct filename
mv backend/procfile backend/Procfile
```

### Issue: Heroku build fails

**Common causes:**
1. Wrong Python version
2. Missing dependencies
3. Incorrect Procfile location

**Solutions:**
```bash
# Specify Python version
echo "python-3.9.6" > runtime.txt

# Verify requirements.txt location
ls -la backend/requirements.txt

# Check Procfile
cat backend/Procfile
```

---

## Next Steps

After setup:
1. ✅ Review [ANALYSIS_REPORT.md](ANALYSIS_REPORT.md) for full project analysis
2. ✅ Review [SECURITY_ISSUES.md](SECURITY_ISSUES.md) for security details
3. ✅ Test all features locally
4. ✅ Deploy to staging environment
5. ✅ Configure monitoring and alerts
6. ✅ Set up automated backups (if using database in future)

---

## Additional Resources

- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Gemini API Docs:** https://ai.google.dev/docs
- **HAR Spec:** https://w3c.github.io/web-performance/specs/HAR/Overview.html
- **Haralyzer Docs:** https://haralyzer.readthedocs.io

---

## Getting Help

**Issues?**
1. Check [TROUBLESHOOTING](#troubleshooting) section above
2. Review logs: `heroku logs --tail` (production) or console output (local)
3. Run test suite: `python3 test_analyzer.py`
4. Check configuration: Verify `.env` and environment variables

**Feature requests or bugs?**
- Document in project README
- Create issues in your git repository
