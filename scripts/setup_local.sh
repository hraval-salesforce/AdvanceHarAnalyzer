#!/bin/bash
set -e

echo "🏠 Setting up local development environment..."

# Find Python 3 (prefer 3.11, fall back to 3.9+)
PYTHON_CMD=""
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo "📍 Found Python $PYTHON_VERSION"
    PYTHON_CMD="python3"
else
    echo "❌ Python 3 not found. Please install Python 3.9 or higher."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment with $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your GEMINI_API_KEY"
fi

echo "✅ Local setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Edit .env and add your GEMINI_API_KEY (if you haven't already)"
echo "  2. Run: ./scripts/run_local.sh"
echo ""
echo "Or manually:"
echo "  1. source venv/bin/activate"
echo "  2. python -m uvicorn backend.app:app --reload --port 8000"
