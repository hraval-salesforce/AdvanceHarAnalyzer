# Deployment Guide

This guide covers local development, staging, and production deployment workflows for the HAR Analyzer.

## Prerequisites

- Python 3.11.9
- Heroku CLI (`brew install heroku/brew/heroku` on macOS)
- Git

## Local Development

### Initial Setup

1. **Clone the repository and set up the environment:**
   ```bash
   ./scripts/setup_local.sh
   ```

2. **Configure environment variables:**
   - Edit `.env` file and add your `GEMINI_API_KEY`
   - Adjust other settings as needed (PORT, DEBUG, etc.)

3. **Start the development server:**
   ```bash
   ./scripts/run_local.sh
   ```
   Or manually:
   ```bash
   source venv/bin/activate
   python -m uvicorn backend.app:app --reload --port 8000
   ```

4. **Access the application:**
   - Open http://localhost:8000 in your browser

### Local Testing

Test your changes locally before pushing to staging:

```bash
# Run tests (if available)
pytest

# Check code quality
flake8 backend/

# Test the health endpoint
curl http://localhost:8000/health
```

## Staging Deployment

### First-Time Setup

1. **Login to Heroku:**
   ```bash
   heroku login
   ```

2. **Create the staging app:**
   ```bash
   heroku create advance-har-analyzer-staging
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set ENVIRONMENT=staging --app advance-har-analyzer-staging
   heroku config:set GEMINI_API_KEY=your_key_here --app advance-har-analyzer-staging
   heroku config:set DEBUG=false --app advance-har-analyzer-staging
   heroku config:set WEB_CONCURRENCY=2 --app advance-har-analyzer-staging
   ```

4. **Set CORS origins (if needed):**
   ```bash
   heroku config:set CORS_ORIGINS=https://advance-har-analyzer-staging.herokuapp.com --app advance-har-analyzer-staging
   ```

### Deploying to Staging

Use the automated script:

```bash
./scripts/deploy_staging.sh
```

Or manually:

```bash
# Ensure you're on the main branch with latest changes
git checkout main
git pull origin main

# Copy staging Procfile
cp Procfile.staging Procfile

# Deploy to Heroku
git add Procfile
git commit -m "Use staging Procfile"
git push heroku-staging main:master

# Restore original Procfile
git checkout Procfile
```

### Verify Staging Deployment

```bash
# Check app status
heroku ps --app advance-har-analyzer-staging

# View logs
heroku logs --tail --app advance-har-analyzer-staging

# Test health endpoint
curl https://advance-har-analyzer-staging.herokuapp.com/health

# Open in browser
heroku open --app advance-har-analyzer-staging
```

## Production Deployment

### First-Time Setup

1. **Create the production app:**
   ```bash
   heroku create advance-har-analyzer
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set ENVIRONMENT=production --app advance-har-analyzer
   heroku config:set GEMINI_API_KEY=your_key_here --app advance-har-analyzer
   heroku config:set DEBUG=false --app advance-har-analyzer
   heroku config:set WEB_CONCURRENCY=4 --app advance-har-analyzer
   ```

3. **Set CORS origins:**
   ```bash
   heroku config:set CORS_ORIGINS=https://advance-har-analyzer.herokuapp.com,https://yourdomain.com --app advance-har-analyzer
   ```

4. **Add custom domain (optional):**
   ```bash
   heroku domains:add yourdomain.com --app advance-har-analyzer
   ```

### Deploying to Production

⚠️ **Always test on staging first!**

Use the automated script:

```bash
./scripts/deploy_production.sh
```

Or manually:

```bash
# Ensure staging tests pass
curl https://advance-har-analyzer-staging.herokuapp.com/health

# Deploy to production
cp Procfile.production Procfile
git add Procfile
git commit -m "Use production Procfile"
git push heroku-production main:master
git checkout Procfile
```

### Verify Production Deployment

```bash
# Check app status
heroku ps --app advance-har-analyzer

# View logs
heroku logs --tail --app advance-har-analyzer

# Test health endpoint
curl https://advance-har-analyzer.herokuapp.com/health

# Open in browser
heroku open --app advance-har-analyzer
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Application environment | `local`, `staging`, `production` |
| `GEMINI_API_KEY` | Google Gemini API key for AI features | `AIza...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (Heroku sets this automatically) | `8000` |
| `DEBUG` | Enable debug mode | `false` |
| `WEB_CONCURRENCY` | Number of Gunicorn workers | `2` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | App URL |
| `APP_URL` | Application base URL | Heroku app URL |

### Setting Environment Variables

**Local (.env file):**
```bash
ENVIRONMENT=local
GEMINI_API_KEY=your_key_here
DEBUG=true
```

**Heroku:**
```bash
# Set single variable
heroku config:set VARIABLE_NAME=value --app app-name

# Set multiple variables
heroku config:set VAR1=value1 VAR2=value2 --app app-name

# View all variables
heroku config --app app-name

# Unset a variable
heroku config:unset VARIABLE_NAME --app app-name
```

## Workflow Recommendations

### Development Workflow

1. **Make changes locally**
   - Edit code in your editor
   - Test with `./scripts/run_local.sh`
   - Commit changes to Git

2. **Test on staging**
   - Deploy to staging: `./scripts/deploy_staging.sh`
   - Verify functionality works as expected
   - Check logs for errors

3. **Deploy to production**
   - Once staging tests pass
   - Deploy to production: `./scripts/deploy_production.sh`
   - Monitor logs for issues

### Git Branching Strategy

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/my-feature

# Merge to main after review
git checkout main
git merge feature/my-feature
git push origin main

# Deploy to staging for testing
./scripts/deploy_staging.sh
```

## Monitoring and Troubleshooting

### View Logs

```bash
# Staging logs
heroku logs --tail --app advance-har-analyzer-staging

# Production logs
heroku logs --tail --app advance-har-analyzer

# Filter by component
heroku logs --tail --ps web --app advance-har-analyzer
```

### Check App Status

```bash
# View running dynos
heroku ps --app advance-har-analyzer

# Restart app
heroku restart --app advance-har-analyzer

# Scale dynos
heroku ps:scale web=2 --app advance-har-analyzer
```

### Database Backup (if using Postgres)

```bash
# Create backup
heroku pg:backups:capture --app advance-har-analyzer

# Download backup
heroku pg:backups:download --app advance-har-analyzer
```

## Rollback

If a deployment causes issues:

```bash
# View releases
heroku releases --app advance-har-analyzer

# Rollback to previous version
heroku rollback v123 --app advance-har-analyzer
```

## Cost Optimization

- **Staging**: Use `basic` or `hobby` dyno ($7/month)
- **Production**: Start with `standard-1x` ($25-50/month)
- Enable auto-scaling if traffic varies

## Security Checklist

- [ ] Never commit `.env` files or API keys
- [ ] Set `DEBUG=false` in staging and production
- [ ] Configure proper CORS origins
- [ ] Use HTTPS for all external origins
- [ ] Regularly rotate API keys
- [ ] Review Heroku app permissions

## Support

For issues or questions:
- Check logs: `heroku logs --tail --app app-name`
- Review Heroku status: https://status.heroku.com/
- Contact team lead or open an issue
