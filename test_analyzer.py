#!/usr/bin/env python3
"""
Comprehensive test suite for HAR Analyzer
Tests backend API, HAR parsing, security issues, and functionality
"""
import json
import sys
import os
from io import BytesIO

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def create_sample_har():
    """Create a minimal valid HAR file for testing"""
    return {
        "log": {
            "version": "1.2",
            "creator": {"name": "Test", "version": "1.0"},
            "pages": [{
                "id": "page_1",
                "title": "Test Page",
                "startedDateTime": "2024-01-01T00:00:00.000Z",
                "pageTimings": {"onLoad": 1000}
            }],
            "entries": [
                {
                    "startedDateTime": "2024-01-01T00:00:00.000Z",
                    "time": 100,
                    "request": {
                        "method": "GET",
                        "url": "https://example.com/test",
                        "headers": [{"name": "Host", "value": "example.com"}],
                        "cookies": [],
                        "queryString": []
                    },
                    "response": {
                        "status": 200,
                        "bodySize": 1024,
                        "headersSize": 256,
                        "headers": [{"name": "Content-Type", "value": "text/html"}],
                        "cookies": [],
                        "content": {"mimeType": "text/html", "size": 1024}
                    },
                    "timings": {
                        "blocked": 1,
                        "dns": 2,
                        "connect": 3,
                        "ssl": 4,
                        "wait": 50,
                        "receive": 40
                    }
                },
                {
                    "startedDateTime": "2024-01-01T00:00:00.200Z",
                    "time": 50,
                    "request": {
                        "method": "GET",
                        "url": "https://google-analytics.com/collect",
                        "headers": [],
                        "cookies": [],
                        "queryString": []
                    },
                    "response": {
                        "status": 200,
                        "bodySize": 0,
                        "headersSize": 100,
                        "headers": [],
                        "cookies": [],
                        "content": {"mimeType": "image/gif", "size": 0}
                    },
                    "timings": {
                        "blocked": 1,
                        "dns": 5,
                        "connect": 10,
                        "ssl": 8,
                        "wait": 20,
                        "receive": 6
                    }
                }
            ]
        }
    }

def test_imports():
    """Test 1: Verify all backend dependencies can be imported"""
    print("Test 1: Checking backend imports...")
    try:
        from fastapi import FastAPI, UploadFile
        from haralyzer import HarParser
        from msgspec import json as msgspec_json
        print("  ✓ All imports successful")
        return True
    except ImportError as e:
        print(f"  ✗ Import failed: {e}")
        return False

def test_har_parsing():
    """Test 2: Test HAR parsing with haralyzer"""
    print("\nTest 2: Testing HAR parsing...")
    try:
        from haralyzer import HarParser
        sample_har = create_sample_har()
        parser = HarParser(sample_har)

        # Check if pages exist
        if not parser.pages:
            print("  ✗ No pages found in HAR")
            return False

        # Check if entries exist
        entries_count = sum(len(page.entries) for page in parser.pages)
        if entries_count != 2:
            print(f"  ✗ Expected 2 entries, found {entries_count}")
            return False

        print(f"  ✓ Successfully parsed HAR with {entries_count} entries")
        return True
    except Exception as e:
        print(f"  ✗ Parsing failed: {e}")
        return False

def test_msgspec_performance():
    """Test 3: Test msgspec JSON parsing"""
    print("\nTest 3: Testing msgspec JSON decoder...")
    try:
        from msgspec import json as msgspec_json
        sample_har = create_sample_har()
        json_bytes = json.dumps(sample_har).encode('utf-8')

        # Test decoding
        decoded = msgspec_json.decode(json_bytes)

        if 'log' not in decoded:
            print("  ✗ Decoded data missing 'log' key")
            return False

        print("  ✓ msgspec JSON decoding successful")
        return True
    except Exception as e:
        print(f"  ✗ msgspec test failed: {e}")
        return False

def test_api_endpoint():
    """Test 4: Test FastAPI endpoint logic"""
    print("\nTest 4: Testing API endpoint logic...")
    try:
        from app import analyze_har_payload
        from fastapi import UploadFile

        # Note: This is a mock test since we can't easily test async endpoints
        print("  ✓ API module loaded successfully")
        print("  ⚠ Full endpoint testing requires running server")
        return True
    except Exception as e:
        print(f"  ✗ API test failed: {e}")
        return False

def test_security_issues():
    """Test 5: Check for security vulnerabilities"""
    print("\nTest 5: Security vulnerability scan...")
    issues = []

    # Read backend code
    with open('backend/app.py', 'r') as f:
        backend_code = f.read()

    # Check for CORS wildcard (acceptable for demo, but flagged)
    if 'allow_origins=["*"]' in backend_code:
        issues.append("CORS allows all origins (acceptable for demo/public API)")

    # Check for missing input validation
    if 'HTTPException' in backend_code:
        print("  ✓ Input validation present (HTTPException used)")
    else:
        issues.append("Missing input validation")

    # Read frontend code
    with open('frontend/app.js', 'r') as f:
        frontend_code = f.read()

    # Check for empty API key
    if 'apiKey = ""' in frontend_code or 'apiKey = \'\'' in frontend_code:
        issues.append("CRITICAL: Empty Gemini API key in frontend (line 1063)")

    # Check for API key in plaintext (security risk)
    if 'const apiKey =' in frontend_code:
        issues.append("WARNING: API key stored in frontend code (should use env vars/backend)")

    if issues:
        print("  Security issues found:")
        for issue in issues:
            print(f"    - {issue}")
        return False
    else:
        print("  ✓ No critical security issues")
        return True

def test_error_handling():
    """Test 6: Check error handling implementation"""
    print("\nTest 6: Error handling validation...")
    try:
        with open('backend/app.py', 'r') as f:
            code = f.read()

        checks = {
            "try/except blocks": "try:" in code and "except" in code,
            "HTTPException raised": "raise HTTPException" in code,
            "File validation": ".har" in code and "endswith" in code,
            "JSON error responses": "JSONResponse" in code
        }

        failed = [k for k, v in checks.items() if not v]

        if failed:
            print(f"  ✗ Missing: {', '.join(failed)}")
            return False
        else:
            print("  ✓ All error handling checks passed")
            return True
    except Exception as e:
        print(f"  ✗ Error handling test failed: {e}")
        return False

def test_frontend_functionality():
    """Test 7: Frontend code validation"""
    print("\nTest 7: Frontend functionality checks...")
    try:
        with open('frontend/app.js', 'r') as f:
            code = f.read()

        checks = {
            "HAR validation": "validateAndLoadHAR" in code,
            "Waterfall rendering": "renderWaterfallRows" in code,
            "Filter functionality": "applyFilters" in code,
            "Third-party detection": "isThirdPartyTracker" in code,
            "GDPR consent audit": "auditConsentViolations" in code,
            "Sanitization feature": "executeSanitisation" in code,
            "AI integration": "callGemini" in code,
            "Demo data": "loadDemoHAR" in code
        }

        failed = [k for k, v in checks.items() if not v]

        if failed:
            print(f"  ✗ Missing features: {', '.join(failed)}")
            return False
        else:
            print("  ✓ All frontend features present")
            return True
    except Exception as e:
        print(f"  ✗ Frontend test failed: {e}")
        return False

def test_configuration():
    """Test 8: Configuration validation"""
    print("\nTest 8: Configuration validation...")
    issues = []

    # Check requirements.txt
    with open('backend/requirements.txt', 'r') as f:
        requirements = f.read()
        required_packages = ['fastapi', 'uvicorn', 'msgspec', 'haralyzer', 'gunicorn']
        for pkg in required_packages:
            if pkg not in requirements:
                issues.append(f"Missing package: {pkg}")

    # Check gunicorn config
    with open('backend/gunicorn.conf.py', 'r') as f:
        gunicorn_conf = f.read()
        if 'bind' not in gunicorn_conf:
            issues.append("gunicorn.conf.py missing bind configuration")
        if 'workers' not in gunicorn_conf:
            issues.append("gunicorn.conf.py missing workers configuration")

    # Check Procfile
    with open('backend/procfile', 'r') as f:
        procfile = f.read()
        if 'gunicorn' not in procfile:
            issues.append("Procfile doesn't use gunicorn")

    if issues:
        print("  Configuration issues:")
        for issue in issues:
            print(f"    - {issue}")
        return False
    else:
        print("  ✓ All configurations valid")
        return True

def run_all_tests():
    """Run all tests and generate report"""
    print("=" * 60)
    print("HAR Analyzer - Comprehensive Test Suite")
    print("=" * 60)

    tests = [
        test_imports,
        test_har_parsing,
        test_msgspec_performance,
        test_api_endpoint,
        test_security_issues,
        test_error_handling,
        test_frontend_functionality,
        test_configuration
    ]

    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"\n  ✗ Test crashed: {e}")
            results.append(False)

    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")

    if passed == total:
        print("\n✓ All tests passed!")
        return 0
    else:
        print("\n✗ Some tests failed. Review output above.")
        return 1

if __name__ == "__main__":
    sys.exit(run_all_tests())
