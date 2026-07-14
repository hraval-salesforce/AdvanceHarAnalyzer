#!/bin/bash
set -e

echo "🚀 Deploying to Production..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first."
    exit 1
fi

# Production app name
PRODUCTION_APP="advance-har-analyzer"

# Confirmation prompt
read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Create production app if it doesn't exist
if ! heroku apps:info --app $PRODUCTION_APP &> /dev/null; then
    echo "📦 Creating production app..."
    heroku create $PRODUCTION_APP
fi

# Set environment variables
echo "⚙️  Setting environment variables..."
heroku config:set ENVIRONMENT=production --app $PRODUCTION_APP
heroku config:set DEBUG=false --app $PRODUCTION_APP
heroku config:set WEB_CONCURRENCY=4 --app $PRODUCTION_APP

# Copy production Procfile
cp Procfile.production Procfile

# Deploy to Heroku
echo "📤 Pushing to Heroku..."
git push https://git.heroku.com/$PRODUCTION_APP.git main:master --force

# Restore original Procfile
git checkout Procfile

# Run health check
echo "🏥 Running health check..."
sleep 5
curl -f https://$PRODUCTION_APP.herokuapp.com/health || echo "⚠️  Health check failed"

echo "✅ Production deployment complete!"
echo "🌐 Visit: https://$PRODUCTION_APP.herokuapp.com"
