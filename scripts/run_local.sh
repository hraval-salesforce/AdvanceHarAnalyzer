#!/bin/bash
set -e

echo "🚀 Starting local development server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run ./scripts/setup_local.sh first"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your GEMINI_API_KEY"
fi

# Export environment variable
export ENVIRONMENT=local

# Start the server with auto-reload
echo "🌐 Server starting at http://localhost:8000"
echo "📝 Press Ctrl+C to stop"
python -m uvicorn backend.app:app --reload --port 8000 --host 0.0.0.0
