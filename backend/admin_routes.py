"""
Admin panel routes for user authentication and API key management.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.database import get_db, User, APIKey
from backend.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash
)

router = APIRouter(prefix="/admin", tags=["admin"])


# Pydantic models for request/response validation
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class APIKeyCreate(BaseModel):
    api_key: str = Field(..., min_length=20, max_length=255)
    key_name: str = Field(None, max_length=100)


class APIKeyResponse(BaseModel):
    api_key: str
    key_name: Optional[str]
    username: str
    is_active: bool
    created_at: datetime
    last_used: Optional[datetime]

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    """
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login timestamp
    user.last_login = datetime.utcnow()
    db.commit()

    # Create access token
    access_token = create_access_token(data={"sub": user.username})

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        username=user.username
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new admin user (for initial setup).
    In production, you should restrict this endpoint or remove it after creating admin users.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        hashed_password=hashed_password
    )

    try:
        db.add(new_user)
        db.commit()
        return {"message": "User created successfully", "username": user_data.username}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.get("/verify", status_code=status.HTTP_200_OK)
async def verify_token(current_user: User = Depends(get_current_user)):
    """
    Verify JWT token and return current user info.
    """
    return {
        "username": current_user.username,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }


@router.post("/api-keys", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def add_api_key(
    key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a new Claude API key. The key must be unique across all users.
    """
    # Validate that the key starts with sk-
    if not key_data.api_key.startswith("sk-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Claude API key format. Keys should start with 'sk-'"
        )

    # Check if key already exists
    existing_key = db.query(APIKey).filter(APIKey.api_key == key_data.api_key).first()
    if existing_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="API key already exists in the system"
        )

    # Create new API key entry
    new_key = APIKey(
        api_key=key_data.api_key,
        username=current_user.username,
        key_name=key_data.key_name or f"Key-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    )

    try:
        db.add(new_key)
        db.commit()
        db.refresh(new_key)
        return new_key
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="API key already exists"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add API key: {str(e)}"
        )


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all API keys associated with the current user.
    Returns masked keys (last 8 characters only) for security.
    """
    keys = db.query(APIKey).filter(APIKey.username == current_user.username).all()

    # Mask API keys before returning
    response_keys = []
    for key in keys:
        masked_key = f"sk-ant-...{key.api_key[-8:]}"
        response_keys.append(
            APIKeyResponse(
                api_key=masked_key,
                key_name=key.key_name,
                username=key.username,
                is_active=key.is_active,
                created_at=key.created_at,
                last_used=key.last_used
            )
        )

    return response_keys


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,  # Last 8 characters of the key
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deactivate an API key. Only the owner can deactivate their keys.
    Pass the last 8 characters of the key as key_id.
    """
    # Find key by matching last 8 characters and username
    keys = db.query(APIKey).filter(APIKey.username == current_user.username).all()

    target_key = None
    for key in keys:
        if key.api_key.endswith(key_id):
            target_key = key
            break

    if not target_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or you don't have permission to delete it"
        )

    try:
        # Soft delete - set is_active to False
        target_key.is_active = False
        db.commit()
        return {"message": "API key deactivated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete API key: {str(e)}"
        )


@router.get("/health")
async def admin_health():
    """Health check for admin panel"""
    return {"status": "healthy", "service": "admin-panel"}
