from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import or_
import os
import secrets
from datetime import datetime, timedelta

from ..database import get_db
from ..models import User, Organization, Project, AuditLog, InviteToken, OAuthAccount, OrganizationMember, ProjectMember
from ..security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

router = APIRouter(prefix="/rbac", tags=["RBAC"])
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

CREATOR_ROLES = {"Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin", "Individual User"}
INVITER_ROLES = {"Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"}
ADMIN_ROLES = {"Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"}
LEGACY_MEMBERSHIP_ROLES = {"Owner", "Member"}


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


def require_role(user: User, allowed: set[str], message: str = "Admin role required"):
    if (user.role or "").strip() not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def require_admin(user: User):
    require_role(user, ADMIN_ROLES, "Admin role required")


def get_manageable_roles(actor_role: str) -> set[str]:
    if actor_role == "Super Admin":
        return {
            "Super Admin",
            "Agency Admin",
            "Agency Company Admin",
            "Agency User",
            "Company Admin",
            "Company User",
            "Individual User",
        }
    if actor_role == "Agency Admin":
        return {"Agency Company Admin", "Agency User"}
    if actor_role == "Agency Company Admin":
        return {"Agency User"}
    if actor_role == "Company Admin":
        return {"Company User"}
    return set()


def get_org_membership(db: Session, organization_id: int, user_id: int) -> OrganizationMember | None:
    return db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id,
    ).first()


def get_effective_scoped_role(membership_role: str | None, fallback_role: str | None) -> str:
    normalized_membership_role = (membership_role or "").strip()
    normalized_fallback_role = (fallback_role or "").strip()
    if normalized_membership_role and normalized_membership_role not in LEGACY_MEMBERSHIP_ROLES:
        return normalized_membership_role
    if normalized_fallback_role:
        return normalized_fallback_role
    return normalized_membership_role or "user"


def get_org_role(db: Session, organization: Organization, user: User) -> str:
    membership = get_org_membership(db, organization.id, user.id)
    return get_effective_scoped_role(membership.role if membership else None, user.role)


def get_user_role_for_org(db: Session, organization_id: int, user: User) -> str:
    membership = get_org_membership(db, organization_id, user.id)
    return get_effective_scoped_role(membership.role if membership else None, user.role)


def get_manageable_roles_for_orgs(db: Session, current_user: User, organization_ids: list[int]) -> set[str]:
    if (current_user.role or "").strip() == "Super Admin":
        return get_manageable_roles("Super Admin")
    manageable_roles: set[str] = set()
    for org_id in organization_ids:
        organization = db.query(Organization).filter(Organization.id == org_id).first()
        if not organization:
            continue
        manageable_roles.update(get_manageable_roles(get_org_role(db, organization, current_user)))
    return manageable_roles


def get_visible_org_roles(db: Session, current_user: User, organization_ids: set[int] | None = None) -> set[str]:
    if (current_user.role or "").strip() == "Super Admin":
        return {"Super Admin"}
    visible_org_ids = organization_ids if organization_ids is not None else get_visible_organization_ids(db, current_user)
    roles: set[str] = set()
    for org_id in visible_org_ids:
        organization = db.query(Organization).filter(Organization.id == org_id).first()
        if not organization:
            continue
        roles.add(get_org_role(db, organization, current_user))
    return roles


def has_admin_access_in_scope(db: Session, current_user: User, organization_ids: set[int] | None = None) -> bool:
    return any(role in ADMIN_ROLES for role in get_visible_org_roles(db, current_user, organization_ids))


def get_scope_inviter_ids(db: Session, organization_ids: set[int]) -> set[int]:
    creator_ids = {
        user_id
        for (user_id,) in db.query(Organization.created_by).filter(Organization.id.in_(organization_ids or {-1})).all()
        if user_id
    }
    member_rows = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id.in_(organization_ids or {-1})
    ).all()
    member_actor_ids = {
        row.user_id
        for row in member_rows
        if (row.role or "").strip() in INVITER_ROLES
    }
    if member_actor_ids:
        global_admin_ids = {
            user.id
            for user in db.query(User).filter(User.id.in_(member_actor_ids)).all()
            if (user.role or "").strip() in INVITER_ROLES
        }
        member_actor_ids = member_actor_ids.union(global_admin_ids)
    return creator_ids.union(member_actor_ids)


def get_organization_member_payload(
    db: Session,
    organization_id: int,
    creator_id: int | None,
    extra_inviter_ids: set[int] | None = None,
) -> list[dict]:
    members = db.query(OrganizationMember, User).join(
        User, OrganizationMember.user_id == User.id
    ).filter(OrganizationMember.organization_id == organization_id).all()
    member_payload: list[dict] = [
        {
            "user_id": row.User.id,
            "email": row.User.email,
            "role": get_effective_scoped_role(row.OrganizationMember.role, row.User.role),
        }
        for row in members
    ]

    creator = db.query(User).filter(User.id == creator_id).first() if creator_id else None
    if creator and all(member["user_id"] != creator.id for member in member_payload):
        member_payload.append({"user_id": creator.id, "email": creator.email, "role": get_effective_scoped_role("Owner", creator.role)})

    inviter_ids = set(extra_inviter_ids or set())
    if creator_id:
        inviter_ids.add(creator_id)
    for inviter_id in inviter_ids:
        invited_members = db.query(User).join(
            AuditLog,
            AuditLog.target_id == User.id,
        ).filter(
            AuditLog.actor_id == inviter_id,
            AuditLog.action == "user_invited",
            AuditLog.target_type == "user",
        ).all()
        for invited in invited_members:
            if all(member["user_id"] != invited.id for member in member_payload):
                member_payload.append({"user_id": invited.id, "email": invited.email, "role": get_effective_scoped_role(None, invited.role)})
    return member_payload


def get_project_member_payload(db: Session, project_id: int) -> list[dict]:
    members = db.query(ProjectMember, User).join(
        User, ProjectMember.user_id == User.id
    ).filter(ProjectMember.project_id == project_id).all()
    return [
        {
            "user_id": row.User.id,
            "email": row.User.email,
            "role": get_effective_scoped_role(row.ProjectMember.role, row.User.role),
        }
        for row in members
    ]


def get_visible_organization_ids(db: Session, current_user: User) -> set[int]:
    role = (current_user.role or "").strip()
    if role == "Super Admin":
        return {org_id for (org_id,) in db.query(Organization.id).all()}

    owned_org_ids = {
        org_id for (org_id,) in db.query(Organization.id).filter(Organization.created_by == current_user.id).all()
    }
    member_org_ids = {
        org_id
        for (org_id,) in db.query(OrganizationMember.organization_id).filter(
            OrganizationMember.user_id == current_user.id
        ).all()
    }
    invited_org_ids = {
        org_id
        for (org_id,) in db.query(Organization.id).join(
            AuditLog,
            AuditLog.actor_id == Organization.created_by,
        ).filter(
            AuditLog.target_type == "user",
            AuditLog.target_id == current_user.id,
            AuditLog.action == "user_invited",
        ).all()
    }
    return owned_org_ids.union(member_org_ids).union(invited_org_ids)


def get_visible_user_ids(db: Session, current_user: User, visible_org_ids: set[int] | None = None) -> set[int]:
    role = (current_user.role or "").strip()
    if role == "Super Admin":
        return {user_id for (user_id,) in db.query(User.id).all()}

    visible_org_ids = visible_org_ids if visible_org_ids is not None else get_visible_organization_ids(db, current_user)
    creator_user_ids = {
        uid
        for (uid,) in db.query(Organization.created_by).filter(Organization.id.in_(visible_org_ids or {-1})).all()
        if uid
    }
    member_user_ids = {
        uid
        for (uid,) in db.query(OrganizationMember.user_id).filter(
            OrganizationMember.organization_id.in_(visible_org_ids or {-1})
        ).all()
    }
    invited_user_ids = {
        tid
        for (tid,) in db.query(AuditLog.target_id).filter(
            AuditLog.actor_id == current_user.id,
            AuditLog.action == "user_invited",
            AuditLog.target_type == "user",
        ).all()
    }
    scope_inviter_ids = get_scope_inviter_ids(db, visible_org_ids)
    scope_invited_user_ids = {
        tid
        for (tid,) in db.query(AuditLog.target_id).filter(
            AuditLog.actor_id.in_(scope_inviter_ids or {-1}),
            AuditLog.action == "user_invited",
            AuditLog.target_type == "user",
        ).all()
    }
    return creator_user_ids.union(member_user_ids).union(invited_user_ids).union(scope_invited_user_ids).union({current_user.id})


@router.get("/organizations")
def list_organizations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    visible_org_ids = get_visible_organization_ids(db, current_user)
    if not visible_org_ids:
        return []
    orgs = db.query(Organization).filter(Organization.id.in_(visible_org_ids)).all()
    results = []
    for o in orgs:
        creator = db.query(User).filter(User.id == o.created_by).first() if o.created_by else None
        members = get_organization_member_payload(db, o.id, o.created_by)
        results.append({
            "id": o.id,
            "name": o.name,
            "type": o.type,
            "projects": len(o.projects),
            "members": len({member["user_id"] for member in members}),
            "status": o.status,
            "created_by": o.created_by,
            "created_by_email": creator.email if creator else None,
        })
    return results


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    visible_org_ids = get_visible_organization_ids(db, current_user)
    if not visible_org_ids:
        return []
    query = db.query(Project).join(Organization, Project.organization_id == Organization.id)
    if has_admin_access_in_scope(db, current_user, visible_org_ids):
        query = query.filter(Project.organization_id.in_(visible_org_ids))
    else:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id, isouter=True)
        base_filter = (
            (Project.organization_id.in_(visible_org_ids)) &
            (
                (Project.created_by == current_user.id) |
                (Organization.created_by == current_user.id) |
                (ProjectMember.user_id == current_user.id)
            )
        )
        query = query.filter(base_filter)
    projects = query.all()
    results = []
    for p in projects:
        creator = db.query(User).filter(User.id == p.created_by).first() if p.created_by else None
        members = get_project_member_payload(db, p.id)
        org = db.query(Organization).filter(Organization.id == p.organization_id).first()
        results.append({
            "id": p.id,
            "name": p.name,
            "org": p.organization.name if p.organization else None,
            "role": get_org_role(db, org, current_user) if org else (current_user.role or "user"),
            "members": len({member["user_id"] for member in members}),
            "status": p.status,
            "created_by": p.created_by,
            "created_by_email": creator.email if creator else None,
        })
    return results


def can_assign_role(assigner_role: str, target_role: str) -> bool:
    if assigner_role == "Super Admin":
        return True
    if assigner_role == "Agency Admin":
        return target_role in {"Agency Company Admin", "Agency User"}
    if assigner_role == "Agency Company Admin":
        return target_role in {"Agency User"}
    if assigner_role == "Company Admin":
        return target_role in {"Company User"}
    return False


def ensure_project_assignment_access(db: Session, project: Project, current_user: User) -> Organization:
    org = db.query(Organization).filter(Organization.id == project.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    assigner_role = get_org_role(db, org, current_user)
    if assigner_role not in ADMIN_ROLES and assigner_role not in {"Agency Company Admin", "Company Admin"}:
        raise HTTPException(status_code=403, detail="Not allowed to manage project members")

    if assigner_role != "Super Admin":
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == current_user.id
        ).first()
        if org.created_by != current_user.id and not membership:
            raise HTTPException(status_code=403, detail="Not allowed to manage members outside your org")
    return org


@router.get("/tenant-summary")
def tenant_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    orgs = list_organizations(db, current_user)  # scoped
    results = []
    for org in orgs:
        org_creator_id = org.get("created_by")
        member_payload = get_organization_member_payload(
            db,
            org["id"],
            org_creator_id,
            extra_inviter_ids=get_scope_inviter_ids(db, {org["id"]}).union({current_user.id}),
        )
        projects = db.query(Project).filter(Project.organization_id == org["id"]).all()
        project_payload = []
        for p in projects:
            project_payload.append({
                "id": p.id,
                "name": p.name,
                "members": get_project_member_payload(db, p.id),
            })
        results.append({
            "id": org["id"],
            "name": org["name"],
            "members": member_payload,
            "projects": project_payload,
        })
    return results


@router.post("/projects/{project_id}/assign", status_code=204)
def assign_project_member(project_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    org = ensure_project_assignment_access(db, project, current_user)
    assigner_role = get_org_role(db, org, current_user)

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    visible_user_ids = get_visible_user_ids(db, current_user, {org.id})
    if target_user.id not in visible_user_ids:
        raise HTTPException(status_code=403, detail="User is not part of this tenant")
    target_role = get_user_role_for_org(db, org.id, target_user)
    if not can_assign_role(assigner_role, target_role):
        raise HTTPException(status_code=403, detail="Not allowed to assign this role")

    target_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user_id,
    ).first()
    if not target_membership:
        db.add(OrganizationMember(organization_id=org.id, user_id=user_id, role=target_role or "Member"))

    existing = db.query(ProjectMember).filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user_id).first()
    if not existing:
        db.add(ProjectMember(project_id=project.id, user_id=user_id, role=target_role or "Member"))
    db.add(AuditLog(
        action="project_assigned",
        actor_id=current_user.id,
        target_type="project",
        target_id=project.id,
        email=target_user.email,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return Response(status_code=204)


@router.delete("/projects/{project_id}/assignments/{user_id}", status_code=204)
def unassign_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    org = ensure_project_assignment_access(db, project, current_user)

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself from the project here")

    assigner_role = get_org_role(db, org, current_user)
    target_role = get_user_role_for_org(db, org.id, target_user)
    if not can_assign_role(assigner_role, target_role):
        raise HTTPException(status_code=403, detail="Not allowed to remove this role")

    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Project member not found")

    db.delete(membership)
    db.add(AuditLog(
        action="project_unassigned",
        actor_id=current_user.id,
        target_type="project",
        target_id=project.id,
        email=target_user.email,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return Response(status_code=204)


@router.get("/users")
def list_users(
    org_id: int | None = Query(default=None, description="Optional organization scope for role display"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_user_ids = get_visible_user_ids(db, current_user)
    if not allowed_user_ids:
        return []
    if org_id is not None and org_id not in get_visible_organization_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You cannot view users for this organization")
    user_query = db.query(User).filter(User.id.in_(allowed_user_ids))

    users = user_query.all()
    results = []
    for u in users:
        invite = (
            db.query(InviteToken)
            .filter(InviteToken.user_id == u.id, InviteToken.used_at.is_(None), InviteToken.expires_at > datetime.utcnow())
            .order_by(InviteToken.expires_at.desc())
            .first()
        )
        results.append({
            "id": u.id,
            "email": u.email,
            "role": get_user_role_for_org(db, org_id, u) if org_id is not None else (u.role or "user"),
            "org": "All",
            "status": "Active" if u.hashed_password or u.oauth_accounts else "Pending",
            "invite_link": f"{FRONTEND_URL}/oauth/magic?token={invite.token}" if invite else None,
            "invite_expires_at": invite.expires_at.isoformat() if invite else None,
        })
    return results


@router.post("/organizations", status_code=201)
def create_organization(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_role(current_user, CREATOR_ROLES, "Not allowed to create organizations")
    name = payload.get("name")
    org_type = payload.get("type")
    if not name or not org_type:
        raise HTTPException(status_code=400, detail="name and type are required")
    if (current_user.role or "").strip() in {"Company Admin", "Individual User"}:
        existing = db.query(Organization).filter(Organization.created_by == current_user.id).first()
        if existing:
            raise HTTPException(status_code=403, detail="This role can create only one organization")

    org = Organization(name=name, type=org_type, status="Active", created_by=current_user.id)
    db.add(org)
    db.commit()
    db.refresh(org)
    db.add(OrganizationMember(organization_id=org.id, user_id=current_user.id, role=(current_user.role or "Owner")))
    db.add(AuditLog(
        action="organization_created",
        actor_id=current_user.id,
        target_type="organization",
        target_id=org.id,
        email=org.name,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return {
        "id": org.id,
        "name": org.name,
        "type": org.type,
        "projects": 0,
        "members": 0,
        "status": org.status,
    }


@router.post("/projects", status_code=201)
def create_project(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = payload.get("name")
    org_id = payload.get("org_id")
    if not name or not org_id:
        raise HTTPException(status_code=400, detail="name and org_id are required")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.id not in get_visible_organization_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You cannot create projects in this organization")
    actor_role = "Super Admin" if (current_user.role or "").strip() == "Super Admin" else get_org_role(db, org, current_user)
    if actor_role not in CREATOR_ROLES:
        raise HTTPException(status_code=403, detail="Not allowed to create projects")
    project = Project(name=name, organization_id=org_id, status="Active", created_by=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    db.add(ProjectMember(project_id=project.id, user_id=current_user.id, role=get_org_role(db, org, current_user) or "Owner"))
    db.add(AuditLog(
        action="project_created",
        actor_id=current_user.id,
        target_type="project",
        target_id=project.id,
        email=project.name,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return {
        "id": project.id,
        "name": project.name,
        "org": org.name,
        "role": get_org_role(db, org, current_user) or "user",
        "members": 0,
        "status": project.status,
        "created_by": project.created_by,
    }


@router.post("/users/invite", status_code=201)
def invite_user(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email = payload.get("email")
    role = payload.get("role", "user")
    organization_ids = payload.get("organization_ids") or []
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if not isinstance(organization_ids, list) or any(not isinstance(org_id, int) for org_id in organization_ids):
        raise HTTPException(status_code=400, detail="organization_ids must be a list of integers")
    visible_org_ids = get_visible_organization_ids(db, current_user)
    selected_org_ids = list(dict.fromkeys(organization_ids))
    if visible_org_ids and not selected_org_ids:
        raise HTTPException(status_code=400, detail="organization_ids is required")
    if not set(selected_org_ids).issubset(visible_org_ids):
        raise HTTPException(status_code=403, detail="You cannot invite users into those organizations")
    if not get_manageable_roles_for_orgs(db, current_user, selected_org_ids):
        raise HTTPException(status_code=403, detail="Not allowed to invite users")
    if role not in get_manageable_roles_for_orgs(db, current_user, selected_org_ids):
        raise HTTPException(status_code=403, detail="You cannot invite this role")
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    new_user = User(email=email, hashed_password=None, full_name=payload.get("full_name"), role=role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # rate limit: no more than 5 invites per minute per actor (audit-based)
    one_minute_ago = datetime.utcnow() - timedelta(seconds=60)
    recent_invites = db.query(AuditLog).filter(
        AuditLog.actor_id == current_user.id,
        AuditLog.action == "user_invited",
        AuditLog.created_at >= one_minute_ago
    ).count()
    if recent_invites >= 5:
        raise HTTPException(status_code=429, detail="Invite rate limit reached, try again shortly")

    # token reuse guard: remove active tokens for this user
    db.query(InviteToken).filter(InviteToken.user_id == new_user.id, InviteToken.used_at.is_(None)).delete()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    invite = InviteToken(user_id=new_user.id, token=token, expires_at=expires_at)
    db.add(invite)
    if selected_org_ids:
        orgs = db.query(Organization).filter(Organization.id.in_(selected_org_ids)).all()
        for org in orgs:
            existing_membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == new_user.id,
            ).first()
            if not existing_membership:
                db.add(OrganizationMember(organization_id=org.id, user_id=new_user.id, role=role))
    db.add(AuditLog(
        action="user_invited",
        actor_id=current_user.id,
        target_type="user",
        target_id=new_user.id,
        email=new_user.email,
        created_at=datetime.utcnow(),
    ))
    db.commit()

    return {
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "status": "Invited",
        "invite_link": f"{FRONTEND_URL}/oauth/magic?token={token}",
        "expires_at": expires_at.isoformat(),
    }


@router.patch("/users/{user_id}/role")
def update_user_role(user_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role = payload.get("role")
    organization_ids = payload.get("organization_ids") or []
    if not role:
        raise HTTPException(status_code=400, detail="role is required")
    if not isinstance(organization_ids, list) or any(not isinstance(org_id, int) for org_id in organization_ids):
        raise HTTPException(status_code=400, detail="organization_ids must be a list of integers")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    visible_org_ids = get_visible_organization_ids(db, current_user)
    scoped_org_ids = list(dict.fromkeys(organization_ids))
    if scoped_org_ids and not set(scoped_org_ids).issubset(visible_org_ids):
        raise HTTPException(status_code=403, detail="You cannot assign this role in those organizations")
    if not has_admin_access_in_scope(db, current_user, set(scoped_org_ids or visible_org_ids)):
        raise HTTPException(status_code=403, detail="Admin role required")
    if role not in get_manageable_roles_for_orgs(db, current_user, scoped_org_ids or list(visible_org_ids)):
        raise HTTPException(status_code=403, detail="You cannot assign this role")
    for org_id in scoped_org_ids:
        membership = get_org_membership(db, org_id, user.id)
        if membership:
            membership.role = role
    user.role = role
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role, "status": "Active"}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    # detach audit references so FK doesn't block deletion
    db.query(AuditLog).filter(AuditLog.actor_id == user.id).update({"actor_id": None})
    # clean invite tokens and oauth links to avoid FK errors
    db.query(InviteToken).filter(InviteToken.user_id == user.id).delete()
    db.query(OAuthAccount).filter(OAuthAccount.user_id == user.id).delete()
    db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).delete()
    db.query(ProjectMember).filter(ProjectMember.user_id == user.id).delete()
    audit = AuditLog(
        action="user_deleted",
        actor_id=current_user.id,
        target_type="user",
        target_id=user.id,
        email=user.email,
        created_at=datetime.utcnow(),
    )
    db.add(audit)
    db.delete(user)
    db.commit()
    return Response(status_code=204)


@router.patch("/organizations/{org_id}")
def update_organization(org_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_role(current_user, {"Super Admin"}, "Only Super Admin can update organizations")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    name = payload.get("name")
    status_value = payload.get("status")
    org_type = payload.get("type")
    if name:
        org.name = name
    if status_value:
        org.status = status_value
    if org_type:
        org.type = org_type
    db.commit()
    db.refresh(org)
    db.add(AuditLog(
        action="organization_updated",
        actor_id=current_user.id,
        target_type="organization",
        target_id=org.id,
        email=org.name,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return org


@router.delete("/organizations/{org_id}", status_code=204)
def delete_organization(org_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_role(current_user, {"Super Admin"}, "Only Super Admin can delete organizations")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Clean dependent memberships before deleting projects/org
    project_ids = [p.id for p in org.projects]
    if project_ids:
        db.query(ProjectMember).filter(ProjectMember.project_id.in_(project_ids)).delete(synchronize_session=False)
        # Delete projects explicitly to avoid orphaned rows
        db.query(Project).filter(Project.id.in_(project_ids)).delete(synchronize_session=False)
    db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).delete(synchronize_session=False)
    db.add(AuditLog(
        action="organization_deleted",
        actor_id=current_user.id,
        target_type="organization",
        target_id=org.id,
        email=org.name,
        created_at=datetime.utcnow(),
    ))
    db.delete(org)
    db.commit()
    return Response(status_code=204)


@router.patch("/projects/{project_id}")
def update_project(project_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_role(current_user, {"Super Admin"}, "Only Super Admin can update projects")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    name = payload.get("name")
    status_value = payload.get("status")
    if name:
        project.name = name
    if status_value:
        project.status = status_value
    db.commit()
    db.refresh(project)
    db.add(AuditLog(
        action="project_updated",
        actor_id=current_user.id,
        target_type="project",
        target_id=project.id,
        email=project.name,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_role(current_user, {"Super Admin"}, "Only Super Admin can delete projects")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.query(ProjectMember).filter(ProjectMember.project_id == project.id).delete(synchronize_session=False)
    db.add(AuditLog(
        action="project_deleted",
        actor_id=current_user.id,
        target_type="project",
        target_id=project.id,
        email=project.name,
        created_at=datetime.utcnow(),
    ))
    db.delete(project)
    db.commit()
    return Response(status_code=204)


@router.get("/audit")
def list_audit_logs(
    action: str | None = Query(default=None, description="Filter by action"),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_role(current_user, {"Super Admin"}, "Only Super Admin can view audit logs")
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.limit(limit).all()
    return [
        {
          "id": log.id,
          "action": log.action,
          "actor_id": log.actor_id,
          "target_type": log.target_type,
          "target_id": log.target_id,
          "provider": log.provider,
          "email": log.email,
          "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/dashboard/activity")
def list_dashboard_activity(
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible_org_ids = get_visible_organization_ids(db, current_user)
    visible_user_ids = get_visible_user_ids(db, current_user, visible_org_ids)
    visible_project_ids = {
        project_id
        for (project_id,) in db.query(Project.id).filter(Project.organization_id.in_(visible_org_ids or {-1})).all()
    }

    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(max(limit * 8, 100)).all()
    activity = []
    for log in logs:
        if (current_user.role or "").strip() == "Super Admin":
            include = True
        elif log.actor_id == current_user.id:
            include = True
        elif log.target_type == "organization" and log.target_id in visible_org_ids:
            include = True
        elif log.target_type == "project" and log.target_id in visible_project_ids:
            include = True
        elif log.target_type == "user" and log.target_id in visible_user_ids:
            include = True
        else:
            include = False
        if not include:
            continue

        actor = db.query(User).filter(User.id == log.actor_id).first() if log.actor_id else None
        activity.append({
            "id": log.id,
            "action": log.action,
            "actor_id": log.actor_id,
            "actor_email": actor.email if actor else None,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "email": log.email,
            "created_at": log.created_at.isoformat(),
        })
        if len(activity) >= limit:
            break
    return activity
