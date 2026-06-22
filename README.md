# 🔍 Gemini HAR Analyzer

A sophisticated web application for analyzing HTTP Archive (HAR) files with AI-powered insights, waterfall visualization, GDPR compliance auditing, and data sanitization.

![Status](https://img.shields.io/badge/status-beta-yellow)
![Python](https://img.shields.io/badge/python-3.8+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### Core Analysis
- 📊 **Waterfall Visualization** - Chronological request timeline with color-coded timing phases
- 🔄 **Flow Pathway** - Visual request sequencing with configurable latency thresholds
- 🔎 **Advanced Filtering** - Multi-dimensional filtering by method, host, MIME type, and latency
- 📈 **Performance Metrics** - Total requests, payload size, load time, and status code distribution

### AI-Powered Insights
- 🤖 **Request Explanation** - AI analysis of individual HTTP requests
- ⚡ **Performance Diagnostics** - Automated bottleneck detection and optimization recommendations
- 🔒 **Security Auditing** - AI-powered security and compliance analysis

### Privacy & Compliance
- 🛡️ **GDPR Consent Auditing** - Detect third-party trackers firing before user consent
- 🧹 **Data Sanitization** - Redact sensitive headers, cookies, and query parameters
- 📤 **Safe Export** - Export sanitized HAR files for sharing

### User Experience
- 📁 **Drag-and-Drop Upload** - Easy HAR file import
- 🎯 **Smart Search** - Real-time search across all request attributes
- 📋 **Detailed Inspector** - View headers, cookies, timings, and response payloads
- 🎨 **Modern UI** - Clean, responsive interface with dark theme

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd GeminiHarAnalyzer

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY

# 4. Fix Procfile naming (for Heroku)
mv backend/procfile backend/Procfile

# 5. Start the backend
cd backend && uvicorn app:app --reload

# 6. Open frontend
open frontend/har_analyzer_deployment_workspace.html
```

**Full setup instructions:** [SETUP_GUIDE.md](SETUP_GUIDE.md)

---

## 📖 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed installation and configuration
- **[ANALYSIS_REPORT.md](ANALYSIS_REPORT.md)** - Complete code quality and feature analysis
- **[SECURITY_ISSUES.md](SECURITY_ISSUES.md)** - Security audit findings and fixes
- **[test_analyzer.py](test_analyzer.py)** - Automated test suite

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│   JavaScript    │
│                 │
│  - Visualization│
│  - Filtering    │
│  - UI Logic     │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│   Backend       │
│   FastAPI       │      API Key
│                 │◄────────────┐
│  - HAR Parsing  │             │
│  - AI Proxy     │             ▼
└────────┬────────┘      ┌──────────────┐
         │               │  Gemini API  │
         ▼               │  (Google)    │
┌─────────────────┐      └──────────────┘
│   Libraries     │
│                 │
│  - haralyzer    │
│  - msgspec      │
│  - FastAPI      │
└─────────────────┘
```

### Tech Stack

**Backend:**
- FastAPI - Modern async web framework
- msgspec - High-performance JSON parsing
- haralyzer - HAR file parsing
- Gunicorn - Production WSGI server

**Frontend:**
- Vanilla JavaScript - No framework dependencies
- Tailwind CSS - Utility-first styling
- marked.js - Markdown rendering for AI reports

**AI:**
- Google Gemini 2.5 Flash - AI analysis and insights

---

## 🔒 Security

### Current Status
⚠️ **Important:** This project has security issues that must be addressed before production:

1. **CRITICAL:** Empty Gemini API key (blocks AI features)
2. **HIGH:** API key security needs backend proxy implementation
3. **MEDIUM:** CORS configuration too permissive

**See [SECURITY_ISSUES.md](SECURITY_ISSUES.md) for complete details and fixes.**

### Recommended Fixes
```bash
# Implement all security fixes
python3 test_analyzer.py  # Run tests first
# Follow SECURITY_ISSUES.md remediation steps
```

---

## 🧪 Testing

Run the comprehensive test suite:

```bash
python3 test_analyzer.py
```

**Tests include:**
- ✅ Dependency validation
- ✅ HAR parsing functionality
- ✅ API endpoint logic
- ✅ Security vulnerability scanning
- ✅ Error handling verification
- ✅ Frontend feature checks
- ✅ Configuration validation

---

## 📊 Usage

### Analyzing a HAR File

1. **Capture HAR file:**
   - Chrome: DevTools → Network → Right-click → "Save all as HAR"
   - Firefox: DevTools → Network → Click gear icon → "Save All As HAR"

2. **Upload to analyzer:**
   - Drag and drop HAR file onto the upload zone
   - OR click to browse and select file

3. **Explore analysis:**
   - **Waterfall tab:** View request timeline
   - **Flow Pipeline:** See latency distribution
   - **AI Suite:** Get AI-powered insights
   - **Sanitizer:** Redact and export cleaned HAR
   - **GDPR Consent:** Audit pre-consent trackers

### Demo Mode

Click "Load Demo Session" to explore features with sample data.

---

## 🎯 Use Cases

### Web Performance Optimization
- Identify slow requests and bottlenecks
- Analyze timing phases (DNS, connect, SSL, TTFB, download)
- Detect unoptimized assets
- Track third-party script impact

### Security Auditing
- Find security header misconfigurations
- Detect potential data leakage
- Identify insecure cookies
- Audit HTTPS usage

### GDPR Compliance
- Verify consent timing for third-party trackers
- Document pre-consent violations
- Generate compliance reports
- Audit cookie usage

### Development & Debugging
- Debug API call failures
- Inspect request/response details
- Compare frontend vs backend load times
- Identify missing resources (404s)

---

## 🛠️ Development

### Project Structure

```
GeminiHarAnalyzer/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── gunicorn.conf.py       # Production server config
│   ├── requirements.txt       # Python dependencies
│   ├── Procfile              # Heroku deployment config
│   └── .env                   # Environment variables (not in git)
├── frontend/
│   ├── app.js                 # Main application logic
│   └── har_analyzer_deployment_workspace.html  # UI
├── test_analyzer.py           # Test suite
├── .gitignore                # Git ignore rules
├── README.md                 # This file
├── SETUP_GUIDE.md            # Setup instructions
├── ANALYSIS_REPORT.md        # Code analysis
└── SECURITY_ISSUES.md        # Security audit
```

### Adding New Features

1. **Backend endpoint:**
   ```python
   @app.post("/new-endpoint")
   async def new_feature(data: dict):
       # Implementation
       return {"result": "success"}
   ```

2. **Frontend function:**
   ```javascript
   async function newFeature() {
       const response = await fetch('/new-endpoint', {
           method: 'POST',
           body: JSON.stringify(data)
       });
       return await response.json();
   }
   ```

3. **Update tests:**
   ```python
   def test_new_feature():
       # Test implementation
       assert True
   ```

---

## 🚢 Deployment

### Heroku

```bash
# Login and create app
heroku login
heroku create your-app-name

# Configure environment
heroku config:set GEMINI_API_KEY=your_key
heroku config:set ALLOWED_ORIGINS=https://your-app.herokuapp.com

# Deploy
git push heroku main

# Open
heroku open
```

### Render

1. Connect GitHub repository
2. Select "Web Service"
3. Configure:
   - Build: `pip install -r backend/requirements.txt`
   - Start: `cd backend && gunicorn -c gunicorn.conf.py app:app`
4. Add environment variables in dashboard
5. Deploy

**Full deployment guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md#deployment)

---

## 💰 Cost Estimation

### Hosting
- **Free tier:** Heroku/Render free tier (limited hours)
- **Production:** $7-25/month (Heroku Hobby/Professional)

### API Usage
- **Gemini API:** Pay-per-use
  - Input: $0.000125 per 1K tokens
  - Output: $0.0005 per 1K tokens
  - Typical analysis: $0.001-0.003 per request
- **Free tier:** 15 requests/minute, 1500 requests/day

**Estimated monthly:** $17-85 (includes hosting + moderate API use)

---

## 🐛 Known Issues

1. **API Key Empty** (CRITICAL)
   - Status: Documented
   - Fix: Follow SETUP_GUIDE.md Step 6-7
   - Impact: AI features non-functional

2. **Dependencies Not Installed** (CRITICAL)
   - Status: Documented
   - Fix: `pip install -r backend/requirements.txt`
   - Impact: Backend won't start

3. **CORS Too Permissive** (MEDIUM)
   - Status: Acceptable for demo
   - Fix: Configure ALLOWED_ORIGINS for production
   - Impact: Security risk in production

**Full issue list:** [ANALYSIS_REPORT.md](ANALYSIS_REPORT.md)

---

## 📝 TODO / Roadmap

### Phase 1: Critical Fixes (Now)
- [x] Document security issues
- [x] Create setup guide
- [x] Add test suite
- [ ] Implement API proxy (security fix)
- [ ] Fix empty API key
- [ ] Install dependencies

### Phase 2: Production Ready (Week 1)
- [ ] Add rate limiting
- [ ] Configure production CORS
- [ ] Add logging system
- [ ] Create deployment guide
- [ ] Add monitoring/alerts

### Phase 3: Feature Enhancements (Month 1)
- [ ] HAR comparison mode
- [ ] PDF/CSV export
- [ ] User authentication
- [ ] Persistent analysis sessions
- [ ] Custom waterfall themes

### Phase 4: Enterprise Features (Month 2+)
- [ ] Real-time monitoring
- [ ] Team collaboration
- [ ] API for automation
- [ ] Custom AI prompts
- [ ] Advanced analytics

---

## 🤝 Contributing

This is currently a personal project. If you'd like to contribute:

1. Report bugs via issues
2. Suggest features via issues
3. Submit pull requests with tests
4. Improve documentation

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Google Gemini** - AI-powered analysis
- **haralyzer** - HAR parsing library
- **FastAPI** - Modern web framework
- **msgspec** - High-performance JSON parsing

---

## 📧 Support

For questions or issues:

1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) troubleshooting section
2. Review [ANALYSIS_REPORT.md](ANALYSIS_REPORT.md) for details
3. Run `python3 test_analyzer.py` to diagnose issues
4. Check application logs for errors

---

## 🔗 Links

- **Gemini API:** https://ai.google.dev/docs
- **HAR Specification:** https://w3c.github.io/web-performance/specs/HAR/Overview.html
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Haralyzer:** https://haralyzer.readthedocs.io

---

**Made with ❤️ for web developers, performance engineers, and security auditors**

*Last updated: May 28, 2026*
