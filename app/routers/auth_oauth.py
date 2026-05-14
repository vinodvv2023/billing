import json
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, OAuthAccount, AuditLog
from ..security import create_access_token, get_roles_from_user
from ..oauth_registry import oauth

router = APIRouter(prefix="/auth", tags=["OAuth Providers"])

@router.get("/{provider}/login")
async def login_via_oauth(provider: str, request: Request, json: bool = False):
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not supported.")
    
    redirect_uri = request.url_for('oauth_callback', provider=provider)
    response = await client.authorize_redirect(request, redirect_uri)
    if json:
        return {"authorization_url": response.headers.get("location")}
    return response

def extract_user_info(provider: str, token: dict, user_info: dict = None) -> dict:
    # A generic helper to extract normalized user information from different providers
    email = None
    account_id = None
    account_email = None
    
    if user_info:
        # Most OIDC providers (Google, Microsoft, Apple, GitLab, LinkedIn OIDC)
        email = user_info.get("email")
        account_id = user_info.get("sub") or user_info.get("id")
        account_email = email
        
        # specific provider overrides if they return fields differently
        if provider == "github":
            account_id = str(user_info.get("id"))
            email = user_info.get("email") # might be None if private, usually requires another API call for private emails
            
        elif provider == "facebook":
            account_id = user_info.get("id")
            email = user_info.get("email")
            
        elif provider == "twitter":
            account_id = user_info.get("data", {}).get("id")
            email = user_info.get("data", {}).get("username") # Twitter doesn't always provide email
            
        elif provider == "discord":
            account_id = user_info.get("id")
            email = user_info.get("email")
            
    return {
        "email": email,           # Standard email for our User table
        "account_id": str(account_id) if account_id else None,
        "account_email": account_email or email
    }


@router.get("/{provider}/callback")
async def oauth_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    try:
        token = await client.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to authenticate with {provider}: {str(e)}")
        
    # Attempt to parse OIDC token first (Google, Apple, MS, etc)
    user_info = token.get("userinfo")
    if not user_info:
        # If not OIDC, try to fetch from provider's user profile endpoint
        if provider == "github":
            resp = await client.get('user', token=token)
            user_info = resp.json()
            # GitHub specific: fetch emails if main email is missing
            if not user_info.get("email"):
                emails_resp = await client.get('user/emails', token=token)
                for e in emails_resp.json():
                    if e.get("primary") and e.get("verified"):
                        user_info["email"] = e.get("email")
                        break
        elif provider == "facebook":
            resp = await client.get('me?fields=id,name,email', token=token)
            user_info = resp.json()
        elif provider == "twitter":
            resp = await client.get('users/me', token=token)
            user_info = resp.json()
        elif provider == "discord":
            resp = await client.get('users/@me', token=token)
            user_info = resp.json()
        else:
            # Fallback for others that might support generic profile endpoints
            try:
                resp = await client.get('userinfo', token=token)
                user_info = resp.json()
            except:
                pass

    if not user_info:
         raise HTTPException(status_code=400, detail="Could not retrieve user info from provider.")
         
    extracted = extract_user_info(provider, token, user_info)
    email = extracted.get("email")
    account_id = extracted.get("account_id")
    account_email = extracted.get("account_email")
    
    if not email or not account_id:
        # Fall-back: use account_id as email if provider doesn't give email explicitly (e.g. twitter)
        email = f"{account_id}@{provider}.local"
        
    # Check if OAuth account exists
    oauth_acc = db.query(OAuthAccount).filter(
        OAuthAccount.oauth_name == provider,
        OAuthAccount.account_id == account_id
    ).first()
    
    if oauth_acc:
        user = oauth_acc.user
        # If the linked user was deleted, recreate and relink to keep OAuth usable
        if not user:
            user = User(email=email, full_name=user_info.get("name"))
            db.add(user)
            db.commit()
            db.refresh(user)
            oauth_acc.user_id = user.id
            db.add(AuditLog(
                action="oauth_relinked_user",
                actor_id=user.id,
                target_type="user",
                target_id=user.id,
                provider=provider,
                email=email,
            ))
            db.commit()
    else:
        # Check if user with this email exists (link accounts dynamically or create new)
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, full_name=user_info.get("name"))
            db.add(user)
            db.commit()
            db.refresh(user)
        elif not user.full_name and user_info.get("name"):
            user.full_name = user_info.get("name")
            db.commit()
            db.refresh(user)
            
        new_oauth_acc = OAuthAccount(
            oauth_name=provider,
            account_id=account_id,
            account_email=account_email or email,
            user_id=user.id
        )
        db.add(new_oauth_acc)
        db.add(AuditLog(
            action="oauth_account_linked",
            actor_id=user.id,
            target_type="user",
            target_id=user.id,
            provider=provider,
            email=email,
        ))
        db.commit()

    # Create JWT for our system
    access_token = create_access_token(data={
        "sub": user.email,
        "roles": get_roles_from_user(user),
        "uid": user.id,
        "full_name": user.full_name,
    })
    
    # Redirect to frontend with token in URL (standard for SPAs handling OAuth)
    # Alternatively could set an HttpOnly cookie here.
    redirect_url = f"{settings.FRONTEND_URL}/oauth/callback?token={access_token}"
    return RedirectResponse(url=redirect_url)
