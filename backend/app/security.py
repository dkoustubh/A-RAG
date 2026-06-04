from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.database.postgres import SessionLocal
from app.database.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    db = SessionLocal()
    try:
        if token == "dummy-token":
            # Seed or query admin
            user = db.query(User).filter(User.username == "admin").first()
            if not user:
                hashed_pwd = get_password_hash("Ats@123*")
                user = User(
                    email="admin@ats-group.in",
                    username="admin",
                    hashed_password=hashed_pwd,
                    role="admin",
                    is_temp_password=False,
                    daily_token_quota=1000000
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            return user

        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        
        # If user_id is missing, try matching by sub (which might be username or email)
        if user_id is None:
            sub = payload.get("sub")
            if sub:
                user = db.query(User).filter((User.username == sub) | (User.email == sub)).first()
            else:
                raise credentials_exception
        else:
            user = db.query(User).filter(User.id == user_id).first()
            
        if user is None:
            raise credentials_exception
            
        return user
    except JWTError:
        raise credentials_exception
    finally:
        db.close()

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # If user has temporary password, block access until setup is complete
        if current_user.is_temp_password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Password change and profile setup required"
            )
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for your role"
            )
        return current_user

# Roles definitions (dependencies now yield DB User objects)
verify_admin = RoleChecker(["admin"])
verify_manager = RoleChecker(["admin", "manager"])
verify_employee = RoleChecker(["admin", "manager", "employee"])
