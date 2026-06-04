from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.postgres import get_db
from app.database.models import User, Team
from app.security import verify_admin, get_password_hash
from app.services.token_governance import TokenGovernance
from pydantic import BaseModel, EmailStr
from typing import List, Optional

router = APIRouter(prefix="/admin", tags=["admin"])

class UserCreate(BaseModel):
    email: EmailStr
    role: str = "employee"
    team_id: Optional[int] = None
    daily_token_quota: Optional[int] = 242000

class UserUpdate(BaseModel):
    role: Optional[str] = None
    team_id: Optional[int] = None
    daily_token_quota: Optional[int] = None

class PasswordReset(BaseModel):
    new_password: str

class TeamCreate(BaseModel):
    name: str

class TeamResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    username: Optional[str]
    email: str
    role: str
    is_temp_password: bool
    team_id: Optional[int]
    daily_token_quota: int
    tokens_used_today: int

    class Config:
        from_attributes = True

# --- Team CRUD ---

@router.get("/teams", response_model=List[TeamResponse])
def list_teams(db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    return db.query(Team).order_by(Team.name).all()

@router.post("/teams", response_model=TeamResponse)
def create_team(team_in: TeamCreate, db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    exists = db.query(Team).filter(Team.name == team_in.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Team already exists")
    team = Team(name=team_in.name)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

@router.delete("/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Unassign users belonging to this team
    db.query(User).filter(User.team_id == team_id).update({User.team_id: None})
    db.delete(team)
    db.commit()
    return {"message": "Team deleted and users unassigned successfully"}

# --- User CRUD ---

@router.get("/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    return db.query(User).order_by(User.id).all()

@router.post("/users", response_model=UserResponse)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    exists = db.query(User).filter(User.email == user_in.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email is already registered")
        
    # Default temporary password: ats123*
    hashed_pwd = get_password_hash("ats123*")
    user = User(
        email=user_in.email,
        username=None,
        hashed_password=hashed_pwd,
        role=user_in.role,
        team_id=user_in.team_id,
        is_temp_password=True,
        daily_token_quota=user_in.daily_token_quota or 242000
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.team_id is not None:
        # Check if team exists or is None
        if user_in.team_id != 0:
            team_exists = db.query(Team).filter(Team.id == user_in.team_id).first()
            if not team_exists:
                raise HTTPException(status_code=404, detail="Team not found")
            user.team_id = user_in.team_id
        else:
            user.team_id = None
            
    if user_in.daily_token_quota is not None:
        user.daily_token_quota = user_in.daily_token_quota
        # Sync to Redis cache
        TokenGovernance.update_quota_config(user_id, user_in.daily_token_quota)
        
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}/password")
def reset_password(user_id: int, reset_in: PasswordReset, db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.hashed_password = get_password_hash(reset_in.new_password)
    user.is_temp_password = False
    db.commit()
    return {"message": "Password updated successfully"}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(verify_admin)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete currently logged in admin user")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}
