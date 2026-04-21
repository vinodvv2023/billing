from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Client, Organization, OrganizationMember, Project, ProjectMember, TimesheetEntry, User
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

ADMIN_ROLES = {"Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin", "org_admin"}
FINANCE_ROLES = {"finance"}
PROJECT_MANAGER_ROLES = {"project_manager"}
EMPLOYEE_ROLES = {"employee"}
CLIENT_ROLES = {"client"}
TIMESHEET_STATUSES = {"draft", "submitted", "approved", "rejected", "locked"}
INVOICE_STATUSES = {"draft", "sent", "paid", "void"}
PROJECT_STATUSES = {"active", "archived", "Active", "Archived"}


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
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


def get_org_membership(db: Session, organization_id: int, user_id: int) -> OrganizationMember | None:
    return db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id,
    ).first()


def get_effective_role(user: User, membership: OrganizationMember | None) -> str:
    if membership and membership.role:
        return membership.role
    return user.role or "user"


def ensure_organization_access(db: Session, organization_id: int, user: User) -> tuple[Organization, OrganizationMember | None, str]:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if (user.role or "").strip() == "Super Admin":
        return organization, get_org_membership(db, organization.id, user.id), "Super Admin"

    membership = get_org_membership(db, organization.id, user.id)
    if organization.created_by != user.id and not membership:
        raise HTTPException(status_code=403, detail="You cannot access this organization")
    return organization, membership, get_effective_role(user, membership)


def ensure_any_org_role(db: Session, organization_id: int, user: User, allowed_roles: set[str], detail: str) -> tuple[Organization, OrganizationMember | None, str]:
    organization, membership, role = ensure_organization_access(db, organization_id, user)
    if role not in allowed_roles:
        raise HTTPException(status_code=403, detail=detail)
    return organization, membership, role


def ensure_project_access(db: Session, project_id: int, user: User) -> tuple[Project, Organization, OrganizationMember | None, str, ProjectMember | None]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    organization, membership, org_role = ensure_organization_access(db, project.organization_id, user)
    project_membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user.id,
    ).first()
    if org_role == "client":
        raise HTTPException(status_code=403, detail="Client users cannot access internal project workflows")
    if org_role in ADMIN_ROLES or org_role in FINANCE_ROLES or org_role in PROJECT_MANAGER_ROLES:
        return project, organization, membership, org_role, project_membership
    if project.created_by == user.id or project_membership:
        return project, organization, membership, org_role, project_membership
    raise HTTPException(status_code=403, detail="You cannot access this project")


def ensure_timesheet_entry_access(
    db: Session,
    entry_id: int,
    user: User,
) -> tuple[TimesheetEntry, Organization, OrganizationMember | None, str, ProjectMember | None]:
    entry = db.query(TimesheetEntry).filter(TimesheetEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timesheet entry not found")
    project, organization, membership, role, project_membership = ensure_project_access(db, entry.project_id, user)
    if role not in ADMIN_ROLES.union(FINANCE_ROLES).union(PROJECT_MANAGER_ROLES) and entry.user_id != user.id:
        raise HTTPException(status_code=403, detail="You cannot access this timesheet entry")
    return entry, organization, membership, role, project_membership


def validate_project_is_active(project: Project):
    if (project.status or "").lower() == "archived":
        raise HTTPException(status_code=400, detail="Archived projects cannot accept new time entries")


def validate_hours(hours: Decimal):
    if hours <= 0 or hours > Decimal("24.00"):
        raise HTTPException(status_code=400, detail="hours must be greater than 0 and less than or equal to 24")


def resolve_client_for_project(db: Session, project: Project, client_id: int | None) -> int | None:
    if client_id is None:
        return project.client_id
    client = db.query(Client).filter(Client.id == client_id, Client.org_id == project.organization_id).first()
    if not client:
        raise HTTPException(status_code=400, detail="client_id must belong to the project organization")
    return client.id


def require_allowed_status(value: str, allowed: set[str], *, field_name: str):
    if value not in allowed:
        raise HTTPException(status_code=400, detail=f"{field_name} must be one of: {', '.join(sorted(allowed))}")


def ensure_date_order(start: date, end: date, *, start_field: str, end_field: str):
    if start > end:
        raise HTTPException(status_code=400, detail=f"{start_field} must be on or before {end_field}")


def utcnow() -> datetime:
    return datetime.utcnow()
