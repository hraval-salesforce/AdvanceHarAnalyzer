# Admin Panel Setup Guide

This guide walks you through setting up the admin panel with Claude API key management for HAR file analysis.

## Features

✅ Secure admin authentication with JWT tokens  
✅ Claude API key management (add, list, delete)  
✅ PostgreSQL database (Heroku Postgres) for production  
✅ SQLite fallback for local development  
✅ API key security - keys never exposed to frontend  
✅ Unique key constraint across all users  
✅ User-based key ownership tracking  

## Architecture

### Database Schema

**Users Table:**
- `username` (PK): Admin username
- `hashed_password`: Bcrypt-hashed password
- `is_active`: Account active status
- `created_at`: Account creation timestamp
- `last_login`: Last successful login timestamp

**API Keys Table:**
- `api_key` (PK, Unique): Claude API key
- `username`: Owner of the key
- `key_name`: Optional friendly name
- `is_active`: Key active status
- `created_at`: Key creation timestamp
- `last_used`: Last time the key was used

### Security Features

1. **Password Hashing**: Bcrypt with salt
2. **JWT Authentication**: 8-hour token expiration
3. **API Key Masking**: Keys displayed as `sk-ant-...XXXXXXXX` in UI
4. **Server-Side Proxy**: API keys never sent to frontend
5. **HTTPS Enforcement**: Recommended for production

---

## Local Development Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

Create or update your `.env` file:

```bash
# Required for JWT token signing
SECRET_KEY=your-secret-key-here-change-this

# Optional: Claude API key can be added via admin panel
# CLAUDE_API_KEY=sk-ant-your-key-here

# Database (optional, defaults to SQLite)
# DATABASE_URL=postgresql://user:pass@localhost/dbname

# Application settings
ENVIRONMENT=development
DEBUG=true
```

**Generate a secure SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Initialize Database

```bash
# This creates the database tables
python -c "from backend.database import init_db; init_db()"
```

### 4. Create Admin User

```bash
python scripts/init_admin.py
```

Follow the prompts to create your first admin user:
```
Enter admin username: admin
Enter admin password: ******
Confirm password: ******
```

### 5. Run the Application

```bash
cd backend
python app.py
```

Or using uvicorn:
```bash
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

### 6. Access Admin Panel

Open your browser and navigate to:
- **Login**: http://localhost:8000/admin/login.html
- **Dashboard**: http://localhost:8000/admin/dashboard.html (after login)

---

## Production Deployment (Heroku)

### 1. Add PostgreSQL Database

```bash
# Heroku automatically provisions PostgreSQL with the app
# Or add it manually:
heroku addons:create heroku-postgresql:essential-0 -a your-app-name
```

### 2. Set Environment Variables

```bash
# Generate and set SECRET_KEY
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
heroku config:set SECRET_KEY="$SECRET_KEY" -a your-app-name

# Set environment
heroku config:set ENVIRONMENT=production -a your-app-name
heroku config:set DEBUG=false -a your-app-name
```

### 3. Deploy Application

```bash
git add .
git commit -m "Add admin panel with Claude API key management"
git push heroku main
```

### 4. Initialize Database on Heroku

```bash
# Database tables are automatically created on startup
# Check logs to confirm:
heroku logs --tail -a your-app-name
```

### 5. Create First Admin User on Heroku

**Option A: Using Heroku CLI (Interactive)**
```bash
heroku run python scripts/init_admin.py -a your-app-name
```

**Option B: Using Python One-Liner**
```bash
heroku run python -c "
from backend.database import init_db, SessionLocal, User
from backend.auth import get_password_hash
from datetime import datetime

init_db()
db = SessionLocal()

# Change these values
username = 'admin'
password = 'YourSecurePassword123!'

hashed_password = get_password_hash(password)
user = User(
    username=username,
    hashed_password=hashed_password,
    is_active=True,
    created_at=datetime.utcnow()
)

db.add(user)
db.commit()
print(f'✅ User {username} created successfully!')
db.close()
" -a your-app-name
```

### 6. Access Production Admin Panel

Navigate to:
- **Login**: https://your-app.herokuapp.com/admin/login.html
- **Dashboard**: https://your-app.herokuapp.com/admin/dashboard.html

---

## Using the Admin Panel

### 1. Login

1. Navigate to `/admin/login.html`
2. Enter your username and password
3. Click "Sign In"
4. You'll be redirected to the dashboard upon successful login

### 2. Add Claude API Key

1. Click "Add New Key" button
2. Enter your Claude API key from https://console.anthropic.com/
   - Format: `sk-ant-api03-...`
3. Optionally provide a friendly name (e.g., "Production Key")
4. Click "Add API Key"

**Getting a Claude API Key:**
1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### 3. Manage Keys

- **View Keys**: All your keys are listed with masked values
- **Key Information**: See creation date, last used date, and status
- **Delete Key**: Click "Delete" to deactivate a key (soft delete)

### 4. Key Security

- Keys are stored securely in PostgreSQL
- Keys are **unique** across the entire system
- Only the last 8 characters are displayed in the UI
- Keys are never sent to the frontend during HAR analysis
- Each key tracks the owner (username)

---

## API Endpoints

### Authentication

**Login**
```http
POST /admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "username": "admin"
}
```

**Verify Token**
```http
GET /admin/verify
Authorization: Bearer <token>

Response:
{
  "username": "admin",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00"
}
```

### API Key Management

**Add Key**
```http
POST /admin/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "api_key": "sk-ant-api03-...",
  "key_name": "Production Key"
}
```

**List Keys**
```http
GET /admin/api-keys
Authorization: Bearer <token>

Response:
[
  {
    "api_key": "sk-ant-...XXXXXXXX",
    "key_name": "Production Key",
    "username": "admin",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00",
    "last_used": "2024-01-02T12:00:00"
  }
]
```

**Delete Key**
```http
DELETE /admin/api-keys/<last-8-chars>
Authorization: Bearer <token>
```

### Claude Analysis (Frontend Use)

**Analyze HAR with Claude**
```http
POST /api/claude/analyze
Content-Type: application/json

{
  "har_data": { ... },
  "analysis_prompt": "What are the slowest requests?"
}

Response:
{
  "analysis": "Based on the HAR data...",
  "model": "claude-3-5-sonnet-20241022",
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 567
  }
}
```

---

## Updating Frontend to Use Claude

Update your HAR analyzer frontend to call the Claude endpoint:

```javascript
// Example: Analyze HAR with Claude
async function analyzeWithClaude(harData, prompt) {
    const response = await fetch('/api/claude/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            har_data: harData,
            analysis_prompt: prompt
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
    }

    return await response.json();
}

// Usage
try {
    const result = await analyzeWithClaude(
        parsedHarData,
        "What are the performance bottlenecks?"
    );
    console.log('Analysis:', result.analysis);
    console.log('Tokens used:', result.usage);
} catch (error) {
    console.error('Analysis error:', error.message);
}
```

---

## Error Handling

### Common Error Responses

**503 - No API Key Configured**
```json
{
  "detail": "No active Claude API key configured. Please add an API key in the admin panel."
}
```

**401 - Invalid API Key**
```json
{
  "detail": "Invalid Claude API key. Please update the API key in admin panel."
}
```

**429 - Rate Limit**
```json
{
  "detail": "Claude API rate limit exceeded. Please try again later."
}
```

**409 - Duplicate Key**
```json
{
  "detail": "API key already exists in the system"
}
```

### Frontend Error Handling

```javascript
async function analyzeWithErrorHandling(harData, prompt) {
    try {
        const result = await analyzeWithClaude(harData, prompt);
        return result;
    } catch (error) {
        if (error.message.includes('503')) {
            alert('No API key configured. Please contact administrator.');
        } else if (error.message.includes('401')) {
            alert('Invalid API key. Please contact administrator.');
        } else if (error.message.includes('429')) {
            alert('Rate limit exceeded. Please try again later.');
        } else {
            alert('Analysis failed: ' + error.message);
        }
        throw error;
    }
}
```

---

## Security Best Practices

1. **Change Default Credentials**: Never use default admin credentials in production
2. **Use Strong Passwords**: Minimum 12 characters, mix of letters, numbers, symbols
3. **Rotate API Keys**: Regularly rotate Claude API keys
4. **Use HTTPS**: Always use HTTPS in production
5. **Limit Admin Access**: Only create necessary admin accounts
6. **Monitor Key Usage**: Check `last_used` timestamps regularly
7. **Set SECRET_KEY**: Always use a unique, randomly generated SECRET_KEY

---

## Troubleshooting

### Database Connection Issues

**Local Development (SQLite)**
```bash
# Check if database file exists
ls -la admin_panel.db

# Reinitialize if needed
python -c "from backend.database import init_db; init_db()"
```

**Heroku (PostgreSQL)**
```bash
# Check database connection
heroku pg:info -a your-app-name

# Check DATABASE_URL
heroku config:get DATABASE_URL -a your-app-name

# Access database console
heroku pg:psql -a your-app-name
```

### Authentication Issues

```bash
# Check if SECRET_KEY is set
heroku config:get SECRET_KEY -a your-app-name

# Verify user exists
heroku pg:psql -a your-app-name
SELECT * FROM users;
```

### API Key Issues

```bash
# List all keys
heroku pg:psql -a your-app-name
SELECT api_key, username, is_active, created_at FROM api_keys;

# Check key validation
heroku run python -c "
from backend.claude_service import ClaudeService
from backend.database import SessionLocal
db = SessionLocal()
service = ClaudeService(db)
result = service.test_api_key('sk-ant-...')
print(result)
" -a your-app-name
```

---

## Maintenance

### Backup Database

**Heroku Postgres**
```bash
# Create backup
heroku pg:backups:capture -a your-app-name

# Download backup
heroku pg:backups:download -a your-app-name

# List backups
heroku pg:backups -a your-app-name
```

### Clean Up Inactive Keys

```python
# Remove keys inactive for 90+ days
from backend.database import SessionLocal, APIKey
from datetime import datetime, timedelta

db = SessionLocal()
cutoff_date = datetime.utcnow() - timedelta(days=90)

old_keys = db.query(APIKey).filter(
    APIKey.is_active == True,
    (APIKey.last_used < cutoff_date) | (APIKey.last_used == None)
).all()

for key in old_keys:
    print(f"Deactivating: {key.api_key[-8:]} (last used: {key.last_used})")
    key.is_active = False

db.commit()
print(f"Deactivated {len(old_keys)} old keys")
```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Heroku logs: `heroku logs --tail -a your-app-name`
3. Check database status: `heroku pg:info -a your-app-name`
4. Verify environment variables: `heroku config -a your-app-name`

---

## Next Steps

1. ✅ Set up admin panel
2. ✅ Create admin user
3. ✅ Add Claude API key
4. 📝 Update frontend to use `/api/claude/analyze` endpoint
5. 📝 Test HAR analysis with Claude
6. 📝 Monitor API usage and costs
7. 📝 Set up additional admin users if needed

---

**Version**: 2.0.0  
**Last Updated**: 2024
