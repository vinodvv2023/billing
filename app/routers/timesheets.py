from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..access import (
    ADMIN_ROLES,
    FINANCE_ROLES,
    PROJECT_MANAGER_ROLES,
    TIMESHEET_STATUSES,
    ensure_any_org_role,
    ensure_date_order,
    ensure_project_access,
    ensure_timesheet_entry_access,
    get_current_user,
    require_allowed_status,
    resolve_client_for_project,
    utcnow,
    validate_hours,
    validate_project_is_active,
)
from ..database import get_db
from ..models import AuditLog, Project, ProjectMember, Task, TimesheetEntry, TimesheetStatusHistory, User

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])


class TimesheetEntryCreate(BaseModel):
    project_id: int
    task_id: int | None = None
    entry_date: date
    hours: Decimal = Field(..., decimal_places=2)
    description: str | None = None
    billable: bool = True
    client_id: int | None = None


class TimesheetEntryUpdate(BaseModel):
    task_id: int | None = None
    entry_date: date | None = None
    hours: Decimal | None = Field(default=None, decimal_places=2)
    description: str | None = None
    billable: bool | None = None
    client_id: int | None = None


class RejectionPayload(BaseModel):
    reason: str | None = None


class BulkDecisionPayload(BaseModel):
    entry_ids: list[int] = Field(..., min_length=1)
    reason: str | None = None


def serialize_entry(entry: TimesheetEntry) -> dict:
    return {
        "id": entry.id,
        "org_id": entry.org_id,
        "user_id": entry.user_id,
        "project_id": entry.project_id,
        "task_id": entry.task_id,
        "client_id": entry.client_id,
        "entry_date": entry.entry_date.isoformat(),
        "hours": str(entry.hours),
        "description": entry.description,
        "billable": entry.billable,
        "status": entry.status,
        "submitted_at": entry.submitted_at.isoformat() if entry.submitted_at else None,
        "approved_at": entry.approved_at.isoformat() if entry.approved_at else None,
        "rejected_at": entry.rejected_at.isoformat() if entry.rejected_at else None,
        "rejection_reason": entry.rejection_reason,
        "locked_at": entry.locked_at.isoformat() if entry.locked_at else None,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
    }


def add_status_history(db: Session, entry: TimesheetEntry, *, from_status: str | None, to_status: str, changed_by: int, reason: str | None = None):
    db.add(
        TimesheetStatusHistory(
            timesheet_entry_id=entry.id,
            from_status=from_status,
            to_status=to_status,
            changed_by=changed_by,
            changed_at=utcnow(),
            reason=reason,
        )
    )


def validate_task_scope(db: Session, project: Project, task_id: int | None) -> int | None:
    if task_id is None:
        return None
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project.id).first()
    if not task:
        raise HTTPException(status_code=400, detail="task_id must belong to the selected project")
    return task.id


def ensure_daily_limit(db: Session, *, org_id: int, user_id: int, entry_date: date, hours: Decimal, exclude_entry_id: int | None = None):
    query = db.query(func.coalesce(func.sum(TimesheetEntry.hours), 0)).filter(
        TimesheetEntry.org_id == org_id,
        TimesheetEntry.user_id == user_id,
        TimesheetEntry.entry_date == entry_date,
    )
    if exclude_entry_id is not None:
        query = query.filter(TimesheetEntry.id != exclude_entry_id)
    total = Decimal(query.scalar() or 0)
    if total + hours > Decimal("24.00"):
        raise HTTPException(status_code=400, detail="Daily hours cannot exceed 24")


def ensure_can_review_entry(role: str, project_membership: ProjectMember | None):
    if role in ADMIN_ROLES:
        return
    if role in PROJECT_MANAGER_ROLES and project_membership and project_membership.role == "manager":
        return
    raise HTTPException(status_code=403, detail="Only project managers for the project or admins can review entries")


@router.get("/entries")
def list_entries(
    org_id: int = Query(...),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    project_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, membership, role = ensure_any_org_role(
        db,
        org_id,
        current_user,
        ADMIN_ROLES.union(FINANCE_ROLES).union(PROJECT_MANAGER_ROLES).union({"employee"}),
        "Not allowed to view timesheets",
    )
    if date_from and date_to:
        ensure_date_order(date_from, date_to, start_field="date_from", end_field="date_to")
    if status:
        require_allowed_status(status, TIMESHEET_STATUSES, field_name="status")

    query = db.query(TimesheetEntry).filter(TimesheetEntry.org_id == org_id)
    if role not in ADMIN_ROLES.union(FINANCE_ROLES).union(PROJECT_MANAGER_ROLES):
        query = query.filter(TimesheetEntry.user_id == current_user.id)
    elif user_id is not None:
        query = query.filter(TimesheetEntry.user_id == user_id)
    if project_id is not None:
        query = query.filter(TimesheetEntry.project_id == project_id)
    if date_from is not None:
        query = query.filter(TimesheetEntry.entry_date >= date_from)
    if date_to is not None:
        query = query.filter(TimesheetEntry.entry_date <= date_to)
    if status is not None:
        query = query.filter(TimesheetEntry.status == status)

    entries = query.order_by(TimesheetEntry.entry_date.desc(), TimesheetEntry.id.desc()).all()
    return [serialize_entry(entry) for entry in entries]


@router.get("/approvals")
def approval_queue(
    org_id: int = Query(...),
    project_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, _, role = ensure_any_org_role(
        db,
        org_id,
        current_user,
        ADMIN_ROLES.union(PROJECT_MANAGER_ROLES),
        "Only project managers or admins can view approvals",
    )
    if date_from and date_to:
        ensure_date_order(date_from, date_to, start_field="date_from", end_field="date_to")

    query = db.query(TimesheetEntry).filter(
        TimesheetEntry.org_id == org_id,
        TimesheetEntry.status == "submitted",
    )
    if project_id is not None:
        query = query.filter(TimesheetEntry.project_id == project_id)
    if user_id is not None:
        query = query.filter(TimesheetEntry.user_id == user_id)
    if date_from is not None:
        query = query.filter(TimesheetEntry.entry_date >= date_from)
    if date_to is not None:
        query = query.filter(TimesheetEntry.entry_date <= date_to)

    if role not in ADMIN_ROLES:
        managed_project_ids = {
            project_id
            for (project_id,) in db.query(ProjectMember.project_id).filter(
                ProjectMember.user_id == current_user.id,
                ProjectMember.role == "manager",
            ).all()
        }
        query = query.filter(TimesheetEntry.project_id.in_(managed_project_ids or {-1}))

    entries = query.order_by(TimesheetEntry.entry_date.asc(), TimesheetEntry.id.asc()).all()
    return [serialize_entry(entry) for entry in entries]


@router.get("/summary")
def timesheet_summary(
    org_id: int = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, _, role = ensure_any_org_role(
        db,
        org_id,
        current_user,
        ADMIN_ROLES.union(FINANCE_ROLES).union(PROJECT_MANAGER_ROLES).union({"employee"}),
        "Not allowed to view summary",
    )
    ensure_date_order(date_from, date_to, start_field="date_from", end_field="date_to")
    query = db.query(TimesheetEntry).filter(
        TimesheetEntry.org_id == org_id,
        TimesheetEntry.entry_date >= date_from,
        TimesheetEntry.entry_date <= date_to,
    )
    if role not in ADMIN_ROLES.union(FINANCE_ROLES).union(PROJECT_MANAGER_ROLES):
        query = query.filter(TimesheetEntry.user_id == current_user.id)
    entries = query.all()
    total_hours = sum((entry.hours for entry in entries), Decimal("0"))
    total_billable_hours = sum((entry.hours for entry in entries if entry.billable), Decimal("0"))
    project_totals: dict[int, Decimal] = {}
    for entry in entries:
        project_totals[entry.project_id] = project_totals.get(entry.project_id, Decimal("0")) + entry.hours
    return {
        "org_id": org_id,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_hours": str(total_hours),
        "billable_hours": str(total_billable_hours),
        "entry_count": len(entries),
        "project_totals": [{"project_id": project_id, "hours": str(hours)} for project_id, hours in sorted(project_totals.items())],
    }


@router.post("/entries", status_code=201)
def create_entry(
    payload: TimesheetEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project, organization, _, role, _ = ensure_project_access(db, payload.project_id, current_user)
    if role not in ADMIN_ROLES.union(FINANCE_ROLES).union(PROJECT_MANAGER_ROLES).union({"employee"}):
        raise HTTPException(status_code=403, detail="Not allowed to create timesheet entries")
    validate_project_is_active(project)
    validate_hours(payload.hours)
    ensure_daily_limit(db, org_id=organization.id, user_id=current_user.id, entry_date=payload.entry_date, hours=payload.hours)

    task_id = validate_task_scope(db, project, payload.task_id)
    client_id = resolve_client_for_project(db, project, payload.client_id)

    entry = TimesheetEntry(
        org_id=organization.id,
        user_id=current_user.id,
        project_id=project.id,
        task_id=task_id,
        client_id=client_id,
        entry_date=payload.entry_date,
        hours=payload.hours,
        description=payload.description.strip() if payload.description else None,
        billable=payload.billable,
        status="draft",
    )
    db.add(entry)
    db.flush()
    add_status_history(db, entry, from_status=None, to_status="draft", changed_by=current_user.id)
    db.add(
        AuditLog(
            action="timesheet_created",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(entry)
    return serialize_entry(entry)


@router.patch("/entries/{entry_id}")
def update_entry(
    entry_id: int,
    payload: TimesheetEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _, _, role, _ = ensure_timesheet_entry_access(db, entry_id, current_user)
    if entry.user_id != current_user.id and role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only the owner or an admin can edit the entry")
    if entry.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=400, detail="Only draft or rejected entries can be edited")

    project = db.query(Project).filter(Project.id == entry.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    next_date = payload.entry_date or entry.entry_date
    next_hours = payload.hours if payload.hours is not None else entry.hours
    validate_hours(next_hours)
    ensure_daily_limit(db, org_id=entry.org_id, user_id=entry.user_id, entry_date=next_date, hours=next_hours, exclude_entry_id=entry.id)

    if payload.task_id is not None:
        entry.task_id = validate_task_scope(db, project, payload.task_id)
    if payload.entry_date is not None:
        entry.entry_date = payload.entry_date
    if payload.hours is not None:
        entry.hours = payload.hours
    if payload.description is not None:
        entry.description = payload.description.strip() if payload.description else None
    if payload.billable is not None:
        entry.billable = payload.billable
    if payload.client_id is not None:
        entry.client_id = resolve_client_for_project(db, project, payload.client_id)
    entry.updated_at = utcnow()

    db.add(
        AuditLog(
            action="timesheet_updated",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(entry)
    return serialize_entry(entry)


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _, _, role, _ = ensure_timesheet_entry_access(db, entry_id, current_user)
    if entry.user_id != current_user.id and role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only the owner or an admin can delete the entry")
    if entry.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft entries can be deleted")

    db.add(
        AuditLog(
            action="timesheet_deleted",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.delete(entry)
    db.commit()
    return Response(status_code=204)


@router.post("/entries/{entry_id}/submit")
def submit_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _, _, _, _ = ensure_timesheet_entry_access(db, entry_id, current_user)
    if entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the entry owner can submit it")
    if entry.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=400, detail="Only draft or rejected entries can be submitted")

    previous_status = entry.status
    entry.status = "submitted"
    entry.submitted_at = utcnow()
    entry.submitted_by = current_user.id
    entry.rejected_at = None
    entry.rejected_by = None
    entry.rejection_reason = None
    add_status_history(db, entry, from_status=previous_status, to_status="submitted", changed_by=current_user.id)
    db.add(
        AuditLog(
            action="timesheet_submitted",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(entry)
    return serialize_entry(entry)


@router.post("/entries/{entry_id}/retract")
def retract_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _, _, _, _ = ensure_timesheet_entry_access(db, entry_id, current_user)
    if entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the entry owner can retract it")
    if entry.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted entries can be retracted")

    entry.status = "draft"
    add_status_history(db, entry, from_status="submitted", to_status="draft", changed_by=current_user.id)
    db.add(
        AuditLog(
            action="timesheet_retracted",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(entry)
    return serialize_entry(entry)


@router.post("/entries/{entry_id}/approve")
def approve_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _, _, role, project_membership = ensure_timesheet_entry_access(db, entry_id, current_user)
    ensure_can_review_entry(role, project_membership)
    if entry.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted entries can be approved")

    entry.status = "approved"
    entry.approved_at = utcnow()
    entry.approved_by = current_user.id
    add_status_history(db, entry, from_status="submitted", to_status="approved", changed_by=current_user.id)
    db.add(
        AuditLog(
            action="timesheet_approved",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(entry)
    return serialize_entry(entry)


@router.post("/entries/{entry_id}/reject")
def reject_entry(
    entry_id: int,
    payload: RejectionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _, _, role, project_membership = ensure_timesheet_entry_access(db, entry_id, current_user)
    ensure_can_review_entry(role, project_membership)
    if entry.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted entries can be rejected")

    reason = payload.reason.strip() if payload.reason else None
    entry.status = "rejected"
    entry.rejected_at = utcnow()
    entry.rejected_by = current_user.id
    entry.rejection_reason = reason
    add_status_history(db, entry, from_status="submitted", to_status="rejected", changed_by=current_user.id, reason=reason)
    db.add(
        AuditLog(
            action="timesheet_rejected",
            actor_id=current_user.id,
            target_type="timesheet_entry",
            target_id=entry.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(entry)
    return serialize_entry(entry)


@router.post("/entries/bulk-approve")
def bulk_approve_entries(
    payload: BulkDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_entries: list[TimesheetEntry] = []
    reviewed_at = utcnow()
    for entry_id in payload.entry_ids:
        entry, _, _, role, project_membership = ensure_timesheet_entry_access(db, entry_id, current_user)
        ensure_can_review_entry(role, project_membership)
        if entry.status != "submitted":
            raise HTTPException(status_code=400, detail=f"Timesheet entry {entry.id} is not submitted")
        entry.status = "approved"
        entry.approved_at = reviewed_at
        entry.approved_by = current_user.id
        add_status_history(db, entry, from_status="submitted", to_status="approved", changed_by=current_user.id)
        db.add(
            AuditLog(
                action="timesheet_approved",
                actor_id=current_user.id,
                target_type="timesheet_entry",
                target_id=entry.id,
                email=current_user.email,
                created_at=reviewed_at,
            )
        )
        updated_entries.append(entry)

    db.commit()
    for entry in updated_entries:
        db.refresh(entry)
    return {"count": len(updated_entries), "entries": [serialize_entry(entry) for entry in updated_entries]}


@router.post("/entries/bulk-reject")
def bulk_reject_entries(
    payload: BulkDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_entries: list[TimesheetEntry] = []
    reviewed_at = utcnow()
    reason = payload.reason.strip() if payload.reason else None
    for entry_id in payload.entry_ids:
        entry, _, _, role, project_membership = ensure_timesheet_entry_access(db, entry_id, current_user)
        ensure_can_review_entry(role, project_membership)
        if entry.status != "submitted":
            raise HTTPException(status_code=400, detail=f"Timesheet entry {entry.id} is not submitted")
        entry.status = "rejected"
        entry.rejected_at = reviewed_at
        entry.rejected_by = current_user.id
        entry.rejection_reason = reason
        add_status_history(db, entry, from_status="submitted", to_status="rejected", changed_by=current_user.id, reason=reason)
        db.add(
            AuditLog(
                action="timesheet_rejected",
                actor_id=current_user.id,
                target_type="timesheet_entry",
                target_id=entry.id,
                email=current_user.email,
                created_at=reviewed_at,
            )
        )
        updated_entries.append(entry)

    db.commit()
    for entry in updated_entries:
        db.refresh(entry)
    return {"count": len(updated_entries), "entries": [serialize_entry(entry) for entry in updated_entries]}
