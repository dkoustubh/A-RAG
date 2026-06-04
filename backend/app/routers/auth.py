from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database.postgres import get_db
from app.database.models import User
from app.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    oauth2_scheme
)
from pydantic import BaseModel
from typing import Optional
from jose import jwt, JWTError
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

class UserRegister(BaseModel):
    username: str
    password: str
    role: str = "employee"

class ProfileSetup(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    status: str
    access_token: str
    token_type: str
    role: str
    username: Optional[str] = None

class UserMeResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    role: str
    team_id: Optional[int] = None
    daily_token_quota: int
    tokens_used_today: int

@router.post("/register")
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        email=f"{user_in.username}@ats-group.in",
        hashed_password=hashed_pwd,
        role=user_in.role,
        is_temp_password=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"user_id": user.id, "sub": user.username, "role": user.role})
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Find user by email or username
    user = db.query(User).filter(
        (User.email == form_data.username) | (User.username == form_data.username)
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.is_temp_password:
        # Create a setup-only token
        setup_token = create_access_token({
            "user_id": user.id,
            "sub": user.email,
            "role": user.role,
            "setup_mode": True
        })
        return {
            "status": "setup_required",
            "access_token": setup_token,
            "token_type": "bearer",
            "role": user.role
        }

    token = create_access_token({"user_id": user.id, "sub": user.username, "role": user.role})
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.post("/setup-profile")
def setup_profile(setup_in: ProfileSetup, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate setup credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        setup_mode = payload.get("setup_mode")
        if user_id is None or not setup_mode:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not user.is_temp_password:
        raise HTTPException(status_code=400, detail="Profile already set up")
        
    # Check if username is taken
    existing = db.query(User).filter(User.username == setup_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username is already taken")
        
    # Update user details
    user.username = setup_in.username
    user.hashed_password = get_password_hash(setup_in.password)
    user.is_temp_password = False
    db.commit()
    db.refresh(user)
    
    new_token = create_access_token({"user_id": user.id, "sub": user.username, "role": user.role})
    return {
        "status": "success",
        "access_token": new_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns details of the currently authenticated user.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "role": current_user.role,
        "team_id": current_user.team_id,
        "daily_token_quota": current_user.daily_token_quota,
        "tokens_used_today": current_user.tokens_used_today
    }
