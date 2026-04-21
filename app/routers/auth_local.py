from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone

from ..database import get_db
from ..models import InviteToken, OrganizationMember, User
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
    active_org_id: int | None = None
    effective_role: str
    client_id: int | None = None
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


def get_active_membership(
    db: Session,
    user_id: int,
    org_id: int | None = None,
) -> OrganizationMember | None:
    query = db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id)
    if org_id is not None:
        membership = query.filter(OrganizationMember.organization_id == org_id).first()
        if not membership:
            raise HTTPException(status_code=403, detail="You cannot access that organization context")
        return membership
    return query.order_by(OrganizationMember.organization_id.asc(), OrganizationMember.id.asc()).first()


def build_profile_response(
    db: Session,
    user: User,
    *,
    access_token: str | None = None,
    org_id: int | None = None,
) -> dict:
    membership = get_active_membership(db, user.id, org_id)
    effective_role = membership.role if membership and membership.role else user.role
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "active_org_id": membership.organization_id if membership else None,
        "effective_role": effective_role,
        "client_id": membership.client_id if membership else None,
        "access_token": access_token,
    }


def utc_now_like(value: datetime | None) -> datetime:
    now = datetime.now(timezone.utc)
    if value is not None and value.tzinfo is None:
        return now.replace(tzinfo=None)
    return now


def invite_is_expired(invite: InviteToken) -> bool:
    return invite.expires_at < utc_now_like(invite.expires_at)

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
def get_me(
    org_id: int | None = Query(default=None, description="Optional organization context"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_profile_response(db, current_user, org_id=org_id)


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
        **build_profile_response(db, current_user, access_token=access_token),
    }


@router.get("/magic/validate")
def magic_validate(token: str, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter(InviteToken.token == token).first()
    if not invite or invite.used_at is not None:
        raise HTTPException(status_code=400, detail="Link has been used or is invalid")
    if invite_is_expired(invite):
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
    if invite_is_expired(invite):
        raise HTTPException(status_code=400, detail="Link expired")
    user = db.query(User).filter(User.id == invite.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.hashed_password:
        raise HTTPException(status_code=400, detail="User already active")

    user.hashed_password = get_password_hash(body.password)
    invite.used_at = utc_now_like(invite.expires_at)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={
        "sub": user.email,
        "roles": get_roles_from_user(user),
        "uid": user.id,
        "full_name": user.full_name,
    })
    return {"access_token": access_token, "token_type": "bearer"}
