from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..access import ADMIN_ROLES, ensure_any_org_role, get_current_user, utcnow
from ..database import get_db
from ..models import AuditLog, Client, Project, Task, User

router = APIRouter(prefix="/clients", tags=["Clients"])


class ClientCreate(BaseModel):
    org_id: int
    name: str
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    status: str = "active"


class ClientUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    status: str | None = None


class TaskCreate(BaseModel):
    project_id: int
    name: str
    description: str | None = None
    status: str = "active"


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None


def serialize_client(client: Client) -> dict:
    return {
        "id": client.id,
        "org_id": client.org_id,
        "name": client.name,
        "contact_name": client.contact_name,
        "contact_email": client.contact_email,
        "status": client.status,
        "created_at": client.created_at.isoformat(),
        "updated_at": client.updated_at.isoformat(),
    }


def serialize_task(task: Task) -> dict:
    return {
        "id": task.id,
        "org_id": task.org_id,
        "project_id": task.project_id,
        "name": task.name,
        "description": task.description,
        "status": task.status,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }


@router.get("")
def list_clients(
    org_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, org_id, current_user, ADMIN_ROLES.union({"finance", "project_manager", "employee", "client"}), "Not allowed to view clients")
    clients = db.query(Client).filter(Client.org_id == org_id).order_by(Client.name.asc()).all()
    return [serialize_client(client) for client in clients]


@router.post("", status_code=201)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, payload.org_id, current_user, ADMIN_ROLES.union({"finance"}), "Not allowed to create clients")
    existing = db.query(Client).filter(Client.org_id == payload.org_id, Client.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Client already exists in this organization")

    client = Client(
        org_id=payload.org_id,
        name=payload.name.strip(),
        contact_name=payload.contact_name.strip() if payload.contact_name else None,
        contact_email=str(payload.contact_email) if payload.contact_email else None,
        status=payload.status.strip().lower(),
    )
    db.add(client)
    db.flush()
    db.add(
        AuditLog(
            action="client_created",
            actor_id=current_user.id,
            target_type="client",
            target_id=client.id,
            email=client.name,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(client)
    return serialize_client(client)


@router.patch("/{client_id}")
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    ensure_any_org_role(db, client.org_id, current_user, ADMIN_ROLES.union({"finance"}), "Not allowed to update clients")

    if payload.name:
        client.name = payload.name.strip()
    if payload.contact_name is not None:
        client.contact_name = payload.contact_name.strip() if payload.contact_name else None
    if payload.contact_email is not None:
        client.contact_email = str(payload.contact_email) if payload.contact_email else None
    if payload.status:
        client.status = payload.status.strip().lower()
    client.updated_at = utcnow()

    db.add(
        AuditLog(
            action="client_updated",
            actor_id=current_user.id,
            target_type="client",
            target_id=client.id,
            email=client.name,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(client)
    return serialize_client(client)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    ensure_any_org_role(db, client.org_id, current_user, ADMIN_ROLES.union({"finance"}), "Only admin or finance roles can delete clients")
    project_links = db.query(Project).filter(Project.client_id == client.id).count()
    if project_links > 0:
        raise HTTPException(status_code=400, detail="Client cannot be deleted while projects reference it")

    db.add(
        AuditLog(
            action="client_deleted",
            actor_id=current_user.id,
            target_type="client",
            target_id=client.id,
            email=client.name,
            created_at=utcnow(),
        )
    )
    db.delete(client)
    db.commit()
    return Response(status_code=204)


@router.get("/projects/{project_id}/tasks")
def list_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_any_org_role(db, project.organization_id, current_user, ADMIN_ROLES.union({"finance", "project_manager", "employee"}), "Not allowed to view tasks")
    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.name.asc()).all()
    return [serialize_task(task) for task in tasks]


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.project_id != project_id:
        raise HTTPException(status_code=400, detail="project_id in path and body must match")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_any_org_role(db, project.organization_id, current_user, ADMIN_ROLES.union({"project_manager"}), "Not allowed to create tasks")

    task = Task(
        org_id=project.organization_id,
        project_id=project.id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        status=payload.status.strip().lower(),
    )
    db.add(task)
    db.flush()
    db.add(
        AuditLog(
            action="task_created",
            actor_id=current_user.id,
            target_type="task",
            target_id=task.id,
            email=task.name,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@router.patch("/projects/{project_id}/tasks/{task_id}")
def update_task(
    project_id: int,
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    ensure_any_org_role(db, task.org_id, current_user, ADMIN_ROLES.union({"project_manager"}), "Not allowed to update tasks")

    if payload.name:
        task.name = payload.name.strip()
    if payload.description is not None:
        task.description = payload.description.strip() if payload.description else None
    if payload.status:
        task.status = payload.status.strip().lower()
    task.updated_at = utcnow()

    db.add(
        AuditLog(
            action="task_updated",
            actor_id=current_user.id,
            target_type="task",
            target_id=task.id,
            email=task.name,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(task)
    return serialize_task(task)
