#!/bin/bash
# Test script to verify all environments are working correctly

echo "🧪 Testing all environments..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test local
echo -e "\n${YELLOW}Testing Local Environment...${NC}"
if curl -f -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Local is running${NC}"
    curl -s http://localhost:8000/health | python -m json.tool
else
    echo -e "${RED}✗ Local is not running${NC}"
    echo "  Start it with: ./scripts/run_local.sh"
fi

# Test staging
echo -e "\n${YELLOW}Testing Staging Environment...${NC}"
STAGING_URL="https://advance-har-analyzer-staging.herokuapp.com"
if curl -f -s $STAGING_URL/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Staging is healthy${NC}"
    curl -s $STAGING_URL/health | python -m json.tool
else
    echo -e "${RED}✗ Staging health check failed${NC}"
    echo "  Deploy with: ./scripts/deploy_staging.sh"
fi

# Test production
echo -e "\n${YELLOW}Testing Production Environment...${NC}"
PRODUCTION_URL="https://advance-har-analyzer.herokuapp.com"
if curl -f -s $PRODUCTION_URL/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Production is healthy${NC}"
    curl -s $PRODUCTION_URL/health | python -m json.tool
else
    echo -e "${RED}✗ Production health check failed${NC}"
    echo "  Deploy with: ./scripts/deploy_production.sh"
fi

echo -e "\n${GREEN}Testing complete!${NC}"
