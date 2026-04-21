from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class TimestampMixin:
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for purely OAuth users
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="user")  # Compatibility fallback during tenant-role migration

    oauth_accounts = relationship("OAuthAccount", back_populates="user")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(Integer, primary_key=True, index=True)
    oauth_name = Column(String, index=True, nullable=False)
    account_id = Column(String, index=True, nullable=False)
    account_email = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="oauth_accounts")


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    type = Column(String, nullable=False)  # Agency | Company
    status = Column(String, nullable=False, default="Active")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="organization", cascade="all, delete-orphan")
    owner = relationship("User", backref="organizations_created", foreign_keys=[created_by])


class Client(TimestampMixin, Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_clients_org_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    contact_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")

    organization = relationship("Organization", back_populates="clients")
    projects = relationship("Project", back_populates="client")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="Active")
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    deadline_datetime = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    organization = relationship("Organization", back_populates="projects")
    client = relationship("Client", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_tasks_project_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active")

    project = relationship("Project", back_populates="tasks")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)
    # actor can be null if the user was later deleted (preserve log without FK breaks)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_type = Column(String, nullable=False)
    target_id = Column(Integer, nullable=False)
    provider = Column(String, nullable=True)
    email = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class OrganizationMember(TimestampMixin, Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_organization_members_org_user"),
        CheckConstraint("(role != 'client') OR (client_id IS NOT NULL)", name="ck_organization_members_client_requires_client_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)


class ProjectMember(TimestampMixin, Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False, default="contributor")


class TimesheetEntry(TimestampMixin, Base):
    __tablename__ = "timesheet_entries"
    __table_args__ = (
        CheckConstraint("hours > 0", name="ck_timesheet_entries_positive_hours"),
    )

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    entry_date = Column(Date, nullable=False, index=True)
    hours = Column(Numeric(8, 2), nullable=False)
    description = Column(Text, nullable=True)
    billable = Column(Boolean, nullable=False, default=True)
    status = Column(String, nullable=False, default="draft", index=True)
    submitted_at = Column(DateTime, nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    status_history = relationship("TimesheetStatusHistory", back_populates="timesheet_entry", cascade="all, delete-orphan")
    invoice_links = relationship("InvoiceLineTimesheetEntry", back_populates="timesheet_entry", cascade="all, delete-orphan")


class TimesheetStatusHistory(Base):
    __tablename__ = "timesheet_status_history"

    id = Column(Integer, primary_key=True, index=True)
    timesheet_entry_id = Column(Integer, ForeignKey("timesheet_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reason = Column(Text, nullable=True)

    timesheet_entry = relationship("TimesheetEntry", back_populates="status_history")


class BillingRate(TimestampMixin, Base):
    __tablename__ = "billing_rates"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    role = Column(String, nullable=True, index=True)
    hourly_rate = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, nullable=False, default="USD")
    effective_from = Column(Date, nullable=False, index=True)
    effective_to = Column(Date, nullable=True, index=True)


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("org_id", "invoice_number", name="uq_invoices_org_invoice_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_number = Column(String, nullable=False)
    issue_date = Column(Date, nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    currency = Column(String, nullable=False, default="USD")
    status = Column(String, nullable=False, default="draft", index=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    voided_at = Column(DateTime, nullable=True)

    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    line_type = Column(String, nullable=False, default="time")
    description = Column(Text, nullable=False)
    hours = Column(Numeric(10, 2), nullable=True)
    unit_price = Column(Numeric(10, 2), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="lines")
    timesheet_links = relationship("InvoiceLineTimesheetEntry", back_populates="invoice_line", cascade="all, delete-orphan")


class InvoiceLineTimesheetEntry(Base):
    __tablename__ = "invoice_line_timesheet_entries"
    __table_args__ = (
        UniqueConstraint("invoice_line_id", "timesheet_entry_id", name="uq_invoice_line_timesheet_link"),
        UniqueConstraint("timesheet_entry_id", name="uq_invoice_line_timesheet_entry_once"),
    )

    id = Column(Integer, primary_key=True, index=True)
    invoice_line_id = Column(Integer, ForeignKey("invoice_lines.id", ondelete="CASCADE"), nullable=False, index=True)
    timesheet_entry_id = Column(Integer, ForeignKey("timesheet_entries.id", ondelete="CASCADE"), nullable=False, index=True)

    invoice_line = relationship("InvoiceLine", back_populates="timesheet_links")
    timesheet_entry = relationship("TimesheetEntry", back_populates="invoice_links")
