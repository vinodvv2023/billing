from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta

from ..database import get_db
from ..models import User, InviteToken
from ..security import get_password_hash, verify_password, create_access_token, get_roles_from_user, decode_access_token

router = APIRouter(prefix="/auth", tags=["Local Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: str | None = None

class TokenInfo(BaseModel):
    access_token: str
    token_type: str


class ProfileResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    role: str
    access_token: str | None = None


class ProfileUpdate(BaseModel):
    email: EmailStr
    full_name: str | None = None


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

@router.post("/register", response_model=TokenInfo)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=user.role or "user"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={
        "sub": new_user.email,
        "roles": get_roles_from_user(new_user),
        "uid": new_user.id,
        "full_name": new_user.full_name,
    })
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=TokenInfo)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not user.hashed_password:
         # Note: if they only have OAuth accounts, user.hashed_password might be None
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = create_access_token(data={
        "sub": user.email,
        "roles": get_roles_from_user(user),
        "uid": user.id,
        "full_name": user.full_name,
    })
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=ProfileResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }


@router.patch("/me", response_model=ProfileResponse)
def update_me(payload: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    next_email = payload.email.strip().lower()
    if next_email != current_user.email:
        existing = db.query(User).filter(User.email == next_email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = next_email
    current_user.full_name = payload.full_name.strip() if payload.full_name else None
    db.commit()
    db.refresh(current_user)
    access_token = create_access_token(data={
        "sub": current_user.email,
        "roles": get_roles_from_user(current_user),
        "uid": current_user.id,
        "full_name": current_user.full_name,
    })
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "access_token": access_token,
    }


@router.get("/magic/validate")
def magic_validate(token: str, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter(InviteToken.token == token).first()
    if not invite or invite.used_at is not None:
        raise HTTPException(status_code=400, detail="Link has been used or is invalid")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Link expired")
    user = db.query(User).filter(User.id == invite.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.hashed_password:
        raise HTTPException(status_code=400, detail="User already active")
    return {"email": user.email}


class MagicAcceptPayload(BaseModel):
    token: str
    password: str


@router.post("/magic/accept")
def magic_accept(body: MagicAcceptPayload, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter(InviteToken.token == body.token).first()
    if not invite or invite.used_at is not None:
        raise HTTPException(status_code=400, detail="Link has been used or is invalid")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Link expired")
    user = db.query(User).filter(User.id == invite.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.hashed_password:
        raise HTTPException(status_code=400, detail="User already active")

    user.hashed_password = get_password_hash(body.password)
    invite.used_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={
        "sub": user.email,
        "roles": get_roles_from_user(user),
        "uid": user.id,
        "full_name": user.full_name,
    })
    return {"access_token": access_token, "token_type": "bearer"}
