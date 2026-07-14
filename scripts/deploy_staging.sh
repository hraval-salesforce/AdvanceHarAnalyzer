#!/bin/bash
set -e

echo "🚀 Deploying to Staging..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first."
    exit 1
fi

# Check if staging app exists
STAGING_APP="advance-har-analyzer-staging"

# Create staging app if it doesn't exist
if ! heroku apps:info --app $STAGING_APP &> /dev/null; then
    echo "📦 Creating staging app..."
    heroku create $STAGING_APP
fi

# Set environment variables
echo "⚙️  Setting environment variables..."
heroku config:set ENVIRONMENT=staging --app $STAGING_APP
heroku config:set DEBUG=false --app $STAGING_APP
heroku config:set WEB_CONCURRENCY=2 --app $STAGING_APP

# Copy staging Procfile
cp Procfile.staging Procfile

# Deploy to Heroku
echo "📤 Pushing to Heroku..."
git push https://git.heroku.com/$STAGING_APP.git main:master --force

# Restore original Procfile
git checkout Procfile

# Run health check
echo "🏥 Running health check..."
sleep 5
curl -f https://$STAGING_APP.herokuapp.com/health || echo "⚠️  Health check failed"

echo "✅ Staging deployment complete!"
echo "🌐 Visit: https://$STAGING_APP.herokuapp.com"
