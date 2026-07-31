#!/usr/bin/env python3
"""
Initialize admin user for the admin panel.
Run this script once to create your first admin user.

Usage:
    python scripts/init_admin.py
"""
import sys
from pathlib import Path

# Add parent directory to path to import backend modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import init_db, SessionLocal, User
from backend.auth import get_password_hash
from datetime import datetime


def create_admin_user():
    """Create initial admin user"""
    print("=" * 60)
    print("🔧 Admin User Initialization")
    print("=" * 60)
    print()

    # Initialize database
    print("Initializing database...")
    init_db()
    print()

    # Get user input
    username = input("Enter admin username: ").strip()
    if not username or len(username) < 3:
        print("❌ Username must be at least 3 characters long")
        return

    password = input("Enter admin password: ").strip()
    if not password or len(password) < 6:
        print("❌ Password must be at least 6 characters long")
        return

    confirm_password = input("Confirm password: ").strip()
    if password != confirm_password:
        print("❌ Passwords do not match")
        return

    # Create user in database
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"❌ User '{username}' already exists")
            return

        # Create new user
        hashed_password = get_password_hash(password)
        new_user = User(
            username=username,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.utcnow()
        )

        db.add(new_user)
        db.commit()

        print()
        print("=" * 60)
        print("✅ Admin user created successfully!")
        print("=" * 60)
        print()
        print(f"Username: {username}")
        print()
        print("You can now login at: http://localhost:8000/admin/login.html")
        print("Or in production: https://your-app.herokuapp.com/admin/login.html")
        print()

    except Exception as e:
        db.rollback()
        print(f"❌ Error creating user: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    try:
        create_admin_user()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup cancelled by user")
        sys.exit(1)
