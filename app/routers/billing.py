from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from ..access import (
    ADMIN_ROLES,
    FINANCE_ROLES,
    INVOICE_STATUSES,
    ensure_any_org_role,
    ensure_date_order,
    get_current_user,
    get_org_membership,
    require_allowed_status,
    utcnow,
)
from ..database import get_db
from ..models import (
    AuditLog,
    BillingRate,
    Client,
    Invoice,
    InvoiceLine,
    InvoiceLineTimesheetEntry,
    Project,
    TimesheetEntry,
    User,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


class BillingRateCreate(BaseModel):
    org_id: int
    client_id: int | None = None
    project_id: int | None = None
    role: str | None = None
    hourly_rate: Decimal = Field(..., decimal_places=2)
    currency: str = "USD"
    effective_from: date
    effective_to: date | None = None


class BillingRateUpdate(BaseModel):
    hourly_rate: Decimal | None = Field(default=None, decimal_places=2)
    currency: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    role: str | None = None


class InvoiceGeneratePayload(BaseModel):
    org_id: int
    client_id: int
    period_start: date
    period_end: date
    issue_date: date
    currency: str = "USD"
    project_ids: list[int] | None = None
    grouping_mode: str = "project"
    notes: str | None = None


class InvoiceUpdatePayload(BaseModel):
    status: str | None = None
    notes: str | None = None


class InvoiceLineCreatePayload(BaseModel):
    description: str
    amount: Decimal = Field(..., decimal_places=2)
    line_type: str = "manual"
    hours: Decimal | None = Field(default=None, decimal_places=2)
    unit_price: Decimal | None = Field(default=None, decimal_places=2)
    project_id: int | None = None
    task_id: int | None = None


class InvoiceLineUpdatePayload(BaseModel):
    description: str | None = None
    amount: Decimal | None = Field(default=None, decimal_places=2)
    line_type: str | None = None
    hours: Decimal | None = Field(default=None, decimal_places=2)
    unit_price: Decimal | None = Field(default=None, decimal_places=2)


def serialize_rate(rate: BillingRate) -> dict:
    return {
        "id": rate.id,
        "org_id": rate.org_id,
        "client_id": rate.client_id,
        "project_id": rate.project_id,
        "role": rate.role,
        "hourly_rate": str(rate.hourly_rate),
        "currency": rate.currency,
        "effective_from": rate.effective_from.isoformat(),
        "effective_to": rate.effective_to.isoformat() if rate.effective_to else None,
        "created_at": rate.created_at.isoformat(),
        "updated_at": rate.updated_at.isoformat(),
    }


def serialize_invoice(invoice: Invoice) -> dict:
    return {
        "id": invoice.id,
        "org_id": invoice.org_id,
        "client_id": invoice.client_id,
        "invoice_number": invoice.invoice_number,
        "issue_date": invoice.issue_date.isoformat(),
        "period_start": invoice.period_start.isoformat(),
        "period_end": invoice.period_end.isoformat(),
        "currency": invoice.currency,
        "status": invoice.status,
        "total_amount": str(invoice.total_amount),
        "notes": invoice.notes,
        "sent_at": invoice.sent_at.isoformat() if invoice.sent_at else None,
        "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
        "voided_at": invoice.voided_at.isoformat() if invoice.voided_at else None,
        "lines": [
            {
                "id": line.id,
                "project_id": line.project_id,
                "task_id": line.task_id,
                "line_type": line.line_type,
                "description": line.description,
                "hours": str(line.hours) if line.hours is not None else None,
                "unit_price": str(line.unit_price) if line.unit_price is not None else None,
                "amount": str(line.amount),
                "timesheet_entry_ids": [link.timesheet_entry_id for link in line.timesheet_links],
            }
            for line in invoice.lines
        ],
        "created_at": invoice.created_at.isoformat(),
        "updated_at": invoice.updated_at.isoformat(),
    }


def recalculate_invoice_total(db: Session, invoice: Invoice):
    lines = db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice.id).all()
    invoice.total_amount = sum((line.amount for line in lines), Decimal("0.00"))


def render_invoice_html(invoice: Invoice, client: Client | None) -> str:
    rows = "".join(
        (
            "<tr>"
            f"<td>{line.description}</td>"
            f"<td>{line.hours if line.hours is not None else ''}</td>"
            f"<td>{line.unit_price if line.unit_price is not None else ''}</td>"
            f"<td>{line.amount}</td>"
            "</tr>"
        )
        for line in invoice.lines
    )
    notes = invoice.notes or ""
    client_name = client.name if client else "Unknown client"
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{invoice.invoice_number}</title>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 40px; color: #111827; }}
      header {{ display: flex; justify-content: space-between; margin-bottom: 32px; }}
      h1 {{ margin: 0; font-size: 28px; }}
      table {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
      th, td {{ border-bottom: 1px solid #e5e7eb; text-align: left; padding: 12px 8px; }}
      th {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }}
      .meta {{ color: #4b5563; line-height: 1.6; }}
      .total {{ margin-top: 20px; text-align: right; font-size: 20px; font-weight: 700; }}
      .notes {{ margin-top: 28px; white-space: pre-wrap; color: #374151; }}
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>Invoice {invoice.invoice_number}</h1>
        <div class="meta">
          <div>Status: {invoice.status}</div>
          <div>Issue date: {invoice.issue_date.isoformat()}</div>
          <div>Billing period: {invoice.period_start.isoformat()} to {invoice.period_end.isoformat()}</div>
        </div>
      </div>
      <div class="meta">
        <div>Client: {client_name}</div>
        <div>Currency: {invoice.currency}</div>
      </div>
    </header>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Hours</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
    <div class="total">Total: {invoice.total_amount} {invoice.currency}</div>
    <div class="notes">{notes}</div>
  </body>
</html>"""


def get_invoice_for_update(db: Session, invoice_id: int, current_user: User) -> Invoice:
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_any_org_role(db, invoice.org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES), "Not allowed to update invoices")
    return invoice


def ensure_draft_invoice(invoice: Invoice):
    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be modified")


def validate_rate_scope(db: Session, payload: BillingRateCreate):
    if payload.project_id is not None:
        project = db.query(Project).filter(Project.id == payload.project_id, Project.organization_id == payload.org_id).first()
        if not project:
            raise HTTPException(status_code=400, detail="project_id must belong to the organization")
        if payload.client_id is not None and project.client_id != payload.client_id:
            raise HTTPException(status_code=400, detail="project_id must belong to the selected client")
    if payload.client_id is not None:
        client = db.query(Client).filter(Client.id == payload.client_id, Client.org_id == payload.org_id).first()
        if not client:
            raise HTTPException(status_code=400, detail="client_id must belong to the organization")
    if payload.effective_to is not None:
        ensure_date_order(payload.effective_from, payload.effective_to, start_field="effective_from", end_field="effective_to")


def resolve_rate_for_entry(db: Session, entry: TimesheetEntry, *, currency: str) -> BillingRate:
    membership = get_org_membership(db, entry.org_id, entry.user_id)
    effective_role = membership.role if membership and membership.role else None
    rates = db.query(BillingRate).filter(
        BillingRate.org_id == entry.org_id,
        BillingRate.currency == currency,
        BillingRate.effective_from <= entry.entry_date,
    ).all()
    candidate_rates = []
    for rate in rates:
        if rate.effective_to and rate.effective_to < entry.entry_date:
            continue
        if rate.project_id is not None and rate.project_id != entry.project_id:
            continue
        if rate.client_id is not None and rate.client_id != entry.client_id:
            continue
        if rate.role is not None and rate.role != effective_role:
            continue
        specificity = (
            4 if rate.project_id is not None else
            3 if rate.client_id is not None else
            2 if rate.role is not None else
            1
        )
        candidate_rates.append((specificity, rate.effective_from, rate))
    if not candidate_rates:
        raise HTTPException(status_code=400, detail=f"No billing rate found for timesheet entry {entry.id}")
    candidate_rates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidate_rates[0][2]


@router.get("/rates")
def list_rates(
    org_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES), "Not allowed to view billing rates")
    rates = db.query(BillingRate).filter(BillingRate.org_id == org_id).order_by(BillingRate.effective_from.desc(), BillingRate.id.desc()).all()
    return [serialize_rate(rate) for rate in rates]


@router.post("/rates", status_code=201)
def create_rate(
    payload: BillingRateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, payload.org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES), "Not allowed to create billing rates")
    validate_rate_scope(db, payload)
    rate = BillingRate(
        org_id=payload.org_id,
        client_id=payload.client_id,
        project_id=payload.project_id,
        role=payload.role.strip() if payload.role else None,
        hourly_rate=payload.hourly_rate,
        currency=payload.currency.strip().upper(),
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )
    db.add(rate)
    db.flush()
    db.add(
        AuditLog(
            action="billing_rate_created",
            actor_id=current_user.id,
            target_type="billing_rate",
            target_id=rate.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(rate)
    return serialize_rate(rate)


@router.patch("/rates/{rate_id}")
def update_rate(
    rate_id: int,
    payload: BillingRateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rate = db.query(BillingRate).filter(BillingRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Billing rate not found")
    ensure_any_org_role(db, rate.org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES), "Not allowed to update billing rates")

    if payload.hourly_rate is not None:
        rate.hourly_rate = payload.hourly_rate
    if payload.currency:
        rate.currency = payload.currency.strip().upper()
    if payload.role is not None:
        rate.role = payload.role.strip() if payload.role else None
    effective_from = payload.effective_from or rate.effective_from
    effective_to = payload.effective_to if payload.effective_to is not None else rate.effective_to
    if effective_to is not None:
        ensure_date_order(effective_from, effective_to, start_field="effective_from", end_field="effective_to")
    rate.effective_from = effective_from
    rate.effective_to = effective_to
    rate.updated_at = utcnow()

    db.add(
        AuditLog(
            action="billing_rate_updated",
            actor_id=current_user.id,
            target_type="billing_rate",
            target_id=rate.id,
            email=current_user.email,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(rate)
    return serialize_rate(rate)


@router.get("/unbilled")
def list_unbilled_hours(
    org_id: int = Query(...),
    client_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES), "Not allowed to view unbilled hours")
    query = db.query(TimesheetEntry).filter(
        TimesheetEntry.org_id == org_id,
        TimesheetEntry.status == "approved",
        TimesheetEntry.billable.is_(True),
        ~TimesheetEntry.invoice_links.any(),
    )
    if client_id is not None:
        query = query.filter(TimesheetEntry.client_id == client_id)
    entries = query.order_by(TimesheetEntry.entry_date.asc()).all()
    by_client: dict[int | None, Decimal] = defaultdict(lambda: Decimal("0"))
    by_project: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for entry in entries:
        by_client[entry.client_id] += entry.hours
        by_project[entry.project_id] += entry.hours
    return {
        "entry_count": len(entries),
        "by_client": [{"client_id": client_id_key, "hours": str(hours)} for client_id_key, hours in sorted(by_client.items(), key=lambda item: item[0] or 0)],
        "by_project": [{"project_id": project_id, "hours": str(hours)} for project_id, hours in sorted(by_project.items())],
    }


@router.post("/invoices/generate", status_code=201)
def generate_invoice(
    payload: InvoiceGeneratePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, payload.org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES), "Not allowed to generate invoices")
    ensure_date_order(payload.period_start, payload.period_end, start_field="period_start", end_field="period_end")
    client = db.query(Client).filter(Client.id == payload.client_id, Client.org_id == payload.org_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    query = db.query(TimesheetEntry).filter(
        TimesheetEntry.org_id == payload.org_id,
        TimesheetEntry.client_id == payload.client_id,
        TimesheetEntry.entry_date >= payload.period_start,
        TimesheetEntry.entry_date <= payload.period_end,
        TimesheetEntry.status == "approved",
        TimesheetEntry.billable.is_(True),
        ~TimesheetEntry.invoice_links.any(),
    )
    if payload.project_ids:
        query = query.filter(TimesheetEntry.project_id.in_(payload.project_ids))
    entries = query.order_by(TimesheetEntry.project_id.asc(), TimesheetEntry.entry_date.asc(), TimesheetEntry.id.asc()).all()
    if not entries:
        raise HTTPException(status_code=400, detail="No approved billable timesheet entries found for invoice generation")

    if payload.grouping_mode not in {"project", "task"}:
        raise HTTPException(status_code=400, detail="grouping_mode must be either 'project' or 'task'")

    year = payload.issue_date.year
    org_invoice_count = db.query(Invoice).filter(Invoice.org_id == payload.org_id).count() + 1
    invoice_number = f"INV-{year}-{org_invoice_count:04d}"

    invoice = Invoice(
        org_id=payload.org_id,
        client_id=payload.client_id,
        invoice_number=invoice_number,
        issue_date=payload.issue_date,
        period_start=payload.period_start,
        period_end=payload.period_end,
        currency=payload.currency.strip().upper(),
        status="draft",
        total_amount=Decimal("0.00"),
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(invoice)
    db.flush()

    grouped_entries: dict[tuple[int | None, int | None], list[TimesheetEntry]] = defaultdict(list)
    for entry in entries:
        key = (entry.project_id, entry.task_id if payload.grouping_mode == "task" else None)
        grouped_entries[key].append(entry)

    total_amount = Decimal("0.00")
    for (project_id, task_id), grouped in grouped_entries.items():
        project = db.query(Project).filter(Project.id == project_id).first()
        rate = resolve_rate_for_entry(db, grouped[0], currency=invoice.currency)
        hours = sum((entry.hours for entry in grouped), Decimal("0"))
        amount = hours * Decimal(rate.hourly_rate)
        total_amount += amount
        description = f"{project.name if project else 'Project'}"
        if payload.grouping_mode == "task" and task_id is not None:
            description = f"{description} / task {task_id}"
        line = InvoiceLine(
            invoice_id=invoice.id,
            project_id=project_id,
            task_id=task_id,
            line_type="time",
            description=description,
            hours=hours,
            unit_price=rate.hourly_rate,
            amount=amount,
        )
        db.add(line)
        db.flush()
        for entry in grouped:
            db.add(InvoiceLineTimesheetEntry(invoice_line_id=line.id, timesheet_entry_id=entry.id))

    invoice.total_amount = total_amount
    db.add(
        AuditLog(
            action="invoice_generated",
            actor_id=current_user.id,
            target_type="invoice",
            target_id=invoice.id,
            email=invoice.invoice_number,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(invoice)
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice.id).first()
    return serialize_invoice(invoice)


@router.get("/invoices")
def list_invoices(
    org_id: int = Query(...),
    status: str | None = Query(default=None),
    client_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_any_org_role(db, org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES).union({"client"}), "Not allowed to view invoices")
    if status:
        require_allowed_status(status, INVOICE_STATUSES, field_name="status")
    if date_from and date_to:
        ensure_date_order(date_from, date_to, start_field="date_from", end_field="date_to")

    membership = get_org_membership(db, org_id, current_user.id)
    query = db.query(Invoice).filter(Invoice.org_id == org_id)
    if membership and membership.role == "client":
        query = query.filter(Invoice.client_id == membership.client_id)
    elif client_id is not None:
        query = query.filter(Invoice.client_id == client_id)
    if status:
        query = query.filter(Invoice.status == status)
    if date_from is not None:
        query = query.filter(Invoice.issue_date >= date_from)
    if date_to is not None:
        query = query.filter(Invoice.issue_date <= date_to)
    invoices = query.order_by(Invoice.issue_date.desc(), Invoice.id.desc()).all()
    return [serialize_invoice(invoice) for invoice in invoices]


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    _, membership, _ = ensure_any_org_role(db, invoice.org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES).union({"client"}), "Not allowed to view invoices")
    if membership and membership.role == "client" and membership.client_id != invoice.client_id:
        raise HTTPException(status_code=403, detail="Client users can only view their own invoices")
    return serialize_invoice(invoice)


@router.patch("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = get_invoice_for_update(db, invoice_id, current_user)

    if payload.notes is not None:
        invoice.notes = payload.notes.strip() if payload.notes else None
    if payload.status is not None:
        require_allowed_status(payload.status, INVOICE_STATUSES, field_name="status")
        if invoice.status == "void" and payload.status != "void":
            raise HTTPException(status_code=400, detail="Voided invoices cannot transition to another state")
        if payload.status == "sent":
            invoice.sent_at = utcnow()
        elif payload.status == "paid":
            invoice.paid_at = utcnow()
        elif payload.status == "void":
            invoice.voided_at = utcnow()
            if invoice.status == "draft":
                for line in invoice.lines:
                    db.query(InvoiceLineTimesheetEntry).filter(
                        InvoiceLineTimesheetEntry.invoice_line_id == line.id
                    ).delete(synchronize_session=False)
        invoice.status = payload.status
    recalculate_invoice_total(db, invoice)

    db.add(
        AuditLog(
            action="invoice_updated",
            actor_id=current_user.id,
            target_type="invoice",
            target_id=invoice.id,
            email=invoice.invoice_number,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(invoice)
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice.id).first()
    return serialize_invoice(invoice)


@router.post("/invoices/{invoice_id}/lines", status_code=201)
def add_invoice_line(
    invoice_id: int,
    payload: InvoiceLineCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = get_invoice_for_update(db, invoice_id, current_user)
    ensure_draft_invoice(invoice)
    line = InvoiceLine(
        invoice_id=invoice.id,
        project_id=payload.project_id,
        task_id=payload.task_id,
        line_type=payload.line_type.strip().lower(),
        description=payload.description.strip(),
        hours=payload.hours,
        unit_price=payload.unit_price,
        amount=payload.amount,
    )
    db.add(line)
    db.flush()
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice.id).first()
    recalculate_invoice_total(db, invoice)
    db.add(
        AuditLog(
            action="invoice_line_added",
            actor_id=current_user.id,
            target_type="invoice",
            target_id=invoice.id,
            email=invoice.invoice_number,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(invoice)
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice.id).first()
    return serialize_invoice(invoice)


@router.patch("/invoices/{invoice_id}/lines/{line_id}")
def update_invoice_line(
    invoice_id: int,
    line_id: int,
    payload: InvoiceLineUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = get_invoice_for_update(db, invoice_id, current_user)
    ensure_draft_invoice(invoice)
    line = db.query(InvoiceLine).filter(InvoiceLine.id == line_id, InvoiceLine.invoice_id == invoice.id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Invoice line not found")
    if payload.description is not None:
        line.description = payload.description.strip()
    if payload.amount is not None:
        line.amount = payload.amount
    if payload.line_type is not None:
        line.line_type = payload.line_type.strip().lower()
    if payload.hours is not None:
        line.hours = payload.hours
    if payload.unit_price is not None:
        line.unit_price = payload.unit_price
    recalculate_invoice_total(db, invoice)
    db.add(
        AuditLog(
            action="invoice_line_updated",
            actor_id=current_user.id,
            target_type="invoice",
            target_id=invoice.id,
            email=invoice.invoice_number,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(invoice)
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice.id).first()
    return serialize_invoice(invoice)


@router.delete("/invoices/{invoice_id}/lines/{line_id}", status_code=204)
def delete_invoice_line(
    invoice_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = get_invoice_for_update(db, invoice_id, current_user)
    ensure_draft_invoice(invoice)
    line = db.query(InvoiceLine).options(joinedload(InvoiceLine.timesheet_links)).filter(
        InvoiceLine.id == line_id,
        InvoiceLine.invoice_id == invoice.id,
    ).first()
    if not line:
        raise HTTPException(status_code=404, detail="Invoice line not found")
    db.query(InvoiceLineTimesheetEntry).filter(
        InvoiceLineTimesheetEntry.invoice_line_id == line.id
    ).delete(synchronize_session=False)
    db.delete(line)
    db.flush()
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice.id).first()
    recalculate_invoice_total(db, invoice)
    db.add(
        AuditLog(
            action="invoice_line_deleted",
            actor_id=current_user.id,
            target_type="invoice",
            target_id=invoice.id,
            email=invoice.invoice_number,
            created_at=utcnow(),
        )
    )
    db.commit()
    return Response(status_code=204)


@router.get("/invoices/{invoice_id}/render", response_class=HTMLResponse)
def render_invoice(
    invoice_id: int,
    format: str = Query(default="html"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if format != "html":
        raise HTTPException(status_code=400, detail="Only html rendering is currently supported")
    invoice = db.query(Invoice).options(joinedload(Invoice.lines).joinedload(InvoiceLine.timesheet_links)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    _, membership, _ = ensure_any_org_role(db, invoice.org_id, current_user, ADMIN_ROLES.union(FINANCE_ROLES).union({"client"}), "Not allowed to view invoices")
    if membership and membership.role == "client" and membership.client_id != invoice.client_id:
        raise HTTPException(status_code=403, detail="Client users can only view their own invoices")
    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    return HTMLResponse(render_invoice_html(invoice, client))
