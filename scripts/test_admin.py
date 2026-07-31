#!/usr/bin/env python3
"""
Test script for admin panel functionality.
Tests database connection, user creation, and API key management.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import init_db, SessionLocal, User, APIKey
from backend.auth import get_password_hash, verify_password, create_access_token, decode_token
from datetime import datetime


def test_database():
    """Test database initialization"""
    print("Testing database connection...")
    try:
        init_db()
        print("✅ Database initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return False


def test_user_operations():
    """Test user creation and authentication"""
    print("\nTesting user operations...")
    db = SessionLocal()

    try:
        # Create test user
        test_username = "test_user"
        test_password = "test_password"

        # Clean up existing test user
        existing = db.query(User).filter(User.username == test_username).first()
        if existing:
            db.delete(existing)
            db.commit()

        # Create user
        hashed = get_password_hash(test_password)
        user = User(
            username=test_username,
            hashed_password=hashed,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        print(f"✅ User '{test_username}' created")

        # Verify password
        if verify_password(test_password, hashed):
            print("✅ Password verification works")
        else:
            print("❌ Password verification failed")
            return False

        # Test JWT token
        token = create_access_token({"sub": test_username})
        print(f"✅ JWT token created: {token[:20]}...")

        # Decode token
        decoded = decode_token(token)
        if decoded["username"] == test_username:
            print("✅ JWT token decoding works")
        else:
            print("❌ JWT token decoding failed")
            return False

        # Clean up
        db.delete(user)
        db.commit()
        print("✅ Test user cleaned up")

        return True

    except Exception as e:
        print(f"❌ User operations error: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()


def test_api_key_operations():
    """Test API key management"""
    print("\nTesting API key operations...")
    db = SessionLocal()

    try:
        # Create test user for API keys
        test_username = "key_test_user"
        user = User(
            username=test_username,
            hashed_password=get_password_hash("password"),
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()

        # Create API key
        test_key = "sk-ant-test-key-12345678"
        api_key = APIKey(
            api_key=test_key,
            username=test_username,
            key_name="Test Key",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(api_key)
        db.commit()
        print(f"✅ API key created: {test_key[-8:]}")

        # Test unique constraint
        try:
            duplicate_key = APIKey(
                api_key=test_key,
                username="another_user",
                key_name="Duplicate",
                is_active=True
            )
            db.add(duplicate_key)
            db.commit()
            print("❌ Unique constraint not working (duplicate key allowed)")
            return False
        except Exception:
            db.rollback()
            print("✅ Unique constraint works (duplicate rejected)")

        # Query key
        found_key = db.query(APIKey).filter(APIKey.api_key == test_key).first()
        if found_key and found_key.username == test_username:
            print("✅ API key query works")
        else:
            print("❌ API key query failed")
            return False

        # Update last_used
        found_key.last_used = datetime.utcnow()
        db.commit()
        print("✅ API key update works")

        # List user's keys
        user_keys = db.query(APIKey).filter(APIKey.username == test_username).all()
        if len(user_keys) == 1:
            print(f"✅ Key listing works ({len(user_keys)} key found)")
        else:
            print(f"❌ Key listing failed ({len(user_keys)} keys found)")
            return False

        # Soft delete
        found_key.is_active = False
        db.commit()
        print("✅ Soft delete works")

        # Clean up
        db.delete(found_key)
        db.delete(user)
        db.commit()
        print("✅ Test data cleaned up")

        return True

    except Exception as e:
        print(f"❌ API key operations error: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    print("=" * 60)
    print("Admin Panel Test Suite")
    print("=" * 60)

    results = {
        "Database": test_database(),
        "User Operations": test_user_operations(),
        "API Key Operations": test_api_key_operations()
    }

    print("\n" + "=" * 60)
    print("Test Results")
    print("=" * 60)

    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:.<40} {status}")
        if not passed:
            all_passed = False

    print("=" * 60)

    if all_passed:
        print("\n🎉 All tests passed! Admin panel is ready to use.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
