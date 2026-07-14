# Quick Start Guide

Get up and running with the HAR Analyzer in minutes.

## 🏠 Local Development (Start Here)

### 1. Initial Setup
```bash
# Run the setup script
./scripts/setup_local.sh

# Edit .env and add your Gemini API key
nano .env  # or use your preferred editor
```

### 2. Start Development Server
```bash
./scripts/run_local.sh
```

Visit http://localhost:8000

### 3. Make Your Changes
- Edit files in `backend/` or `frontend/`
- Server auto-reloads on changes
- Test your changes locally before deploying

---

## 🧪 Deploy to Staging (Test Your Changes)

### First Time Only
```bash
# Login to Heroku
heroku login

# The deploy script will create the app automatically
./scripts/deploy_staging.sh

# Set your Gemini API key
heroku config:set GEMINI_API_KEY=your_key_here --app advance-har-analyzer-staging
```

### Every Time You Want to Test
```bash
# Commit your changes
git add .
git commit -m "Your changes description"

# Deploy to staging
./scripts/deploy_staging.sh

# Test the staging site
heroku open --app advance-har-analyzer-staging
```

**Staging URL:** https://advance-har-analyzer-staging.herokuapp.com

---

## 🚀 Deploy to Production (After Staging Tests Pass)

### First Time Only
```bash
# The deploy script will create the app automatically
./scripts/deploy_production.sh

# Set your Gemini API key
heroku config:set GEMINI_API_KEY=your_key_here --app advance-har-analyzer
```

### Every Time You Want to Release
```bash
# Make sure staging works first!
curl https://advance-har-analyzer-staging.herokuapp.com/health

# Deploy to production (requires confirmation)
./scripts/deploy_production.sh

# Open production site
heroku open --app advance-har-analyzer
```

**Production URL:** https://advance-har-analyzer.herokuapp.com

---

## 🔍 Useful Commands

### Check Logs
```bash
# Staging logs
heroku logs --tail --app advance-har-analyzer-staging

# Production logs
heroku logs --tail --app advance-har-analyzer
```

### Health Check
```bash
# Local
curl http://localhost:8000/health

# Staging
curl https://advance-har-analyzer-staging.herokuapp.com/health

# Production
curl https://advance-har-analyzer.herokuapp.com/health
```

### View Config
```bash
heroku config --app advance-har-analyzer-staging
heroku config --app advance-har-analyzer
```

### Restart App
```bash
heroku restart --app advance-har-analyzer-staging
heroku restart --app advance-har-analyzer
```

---

## 📝 Recommended Workflow

1. **Develop locally** - Make changes, test with `./scripts/run_local.sh`
2. **Commit to Git** - `git add .` and `git commit -m "message"`
3. **Deploy to staging** - `./scripts/deploy_staging.sh`
4. **Test on staging** - Verify everything works
5. **Deploy to production** - `./scripts/deploy_production.sh`
6. **Monitor** - Check logs for any issues

---

## ⚠️ Troubleshooting

### Local server won't start
- Check if port 8000 is already in use
- Verify your `.env` file exists and has valid settings
- Try `./scripts/setup_local.sh` again

### Heroku deployment fails
- Make sure you're logged in: `heroku login`
- Check if you have uncommitted changes: `git status`
- View build logs: `heroku logs --tail --app your-app-name`

### AI features not working
- Verify `GEMINI_API_KEY` is set in your environment
- Check the key is valid: `heroku config --app your-app-name`
- View the health endpoint to confirm: `curl your-app-url/health`

---

## 📚 More Information

- **Full deployment guide:** See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Setup guide:** See [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **README:** See [README.md](README.md)

---

## 🆘 Need Help?

If you encounter issues:
1. Check the logs: `heroku logs --tail --app your-app-name`
2. Verify environment variables: `heroku config --app your-app-name`
3. Review the health endpoint: `curl your-app-url/health`
4. Consult [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
