import os
import tempfile
import unittest
from datetime import date
from decimal import Decimal


DB_FD, DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"

from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import (
    Client,
    Invoice,
    InvoiceLine,
    InvoiceLineTimesheetEntry,
    Organization,
    OrganizationMember,
    Project,
    ProjectMember,
    TimesheetEntry,
    User,
)
from app.security import create_access_token, get_password_hash, get_roles_from_user


class TimesheetBillingSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        engine.dispose()
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def make_auth_headers(self, user: User) -> dict[str, str]:
        token = create_access_token(
            data={"sub": user.email, "roles": get_roles_from_user(user), "uid": user.id}
        )
        return {"Authorization": f"Bearer {token}"}

    def create_user(self, email: str, role: str = "user") -> User:
        db = SessionLocal()
        try:
            user = User(email=email, hashed_password=get_password_hash("Password123!"), role=role)
            db.add(user)
            db.commit()
            db.refresh(user)
            db.expunge(user)
            return user
        finally:
            db.close()

    def create_org(self, owner: User, name: str = "Example Org") -> Organization:
        db = SessionLocal()
        try:
            org = Organization(name=name, type="Company", status="Active", created_by=owner.id)
            db.add(org)
            db.commit()
            db.refresh(org)
            db.expunge(org)
            return org
        finally:
            db.close()

    def test_project_allows_existing_minimal_data(self):
        db = SessionLocal()
        try:
            owner = User(email="owner@example.com", hashed_password=get_password_hash("Password123!"), role="Company Admin")
            db.add(owner)
            db.commit()
            db.refresh(owner)

            org = Organization(name="Legacy Org", type="Company", status="Active", created_by=owner.id)
            db.add(org)
            db.commit()
            db.refresh(org)

            project = Project(name="Legacy Project", organization_id=org.id, status="Active", created_by=owner.id)
            db.add(project)
            db.commit()
            db.refresh(project)

            self.assertEqual(project.name, "Legacy Project")
            self.assertIsNone(project.description)
            self.assertIsNone(project.client_id)
        finally:
            db.close()

    def test_organization_members_require_unique_user_per_org(self):
        db = SessionLocal()
        try:
            user = User(email="member@example.com", hashed_password=get_password_hash("Password123!"), role="employee")
            db.add(user)
            db.commit()
            db.refresh(user)

            org = Organization(name="Org Membership", type="Company", status="Active", created_by=user.id)
            db.add(org)
            db.commit()
            db.refresh(org)

            db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="employee"))
            db.commit()

            db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="finance"))
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()

    def test_project_members_require_unique_user_per_project(self):
        db = SessionLocal()
        try:
            user = User(email="project-member@example.com", hashed_password=get_password_hash("Password123!"), role="employee")
            db.add(user)
            db.commit()
            db.refresh(user)

            org = Organization(name="Project Membership", type="Company", status="Active", created_by=user.id)
            db.add(org)
            db.commit()
            db.refresh(org)

            project = Project(name="Scoped Project", organization_id=org.id, status="Active", created_by=user.id)
            db.add(project)
            db.commit()
            db.refresh(project)

            db.add(ProjectMember(project_id=project.id, user_id=user.id, role="contributor"))
            db.commit()

            db.add(ProjectMember(project_id=project.id, user_id=user.id, role="manager"))
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()

    def test_client_membership_requires_client_id(self):
        db = SessionLocal()
        try:
            user = User(email="client-user@example.com", hashed_password=get_password_hash("Password123!"), role="client")
            db.add(user)
            db.commit()
            db.refresh(user)

            org = Organization(name="Client Constraint Org", type="Company", status="Active", created_by=user.id)
            db.add(org)
            db.commit()
            db.refresh(org)

            db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="client"))
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()

    def test_timesheet_entry_can_only_be_linked_to_one_invoice_line(self):
        db = SessionLocal()
        try:
            user = User(email="billing@example.com", hashed_password=get_password_hash("Password123!"), role="finance")
            db.add(user)
            db.commit()
            db.refresh(user)

            org = Organization(name="Billing Org", type="Company", status="Active", created_by=user.id)
            db.add(org)
            db.commit()
            db.refresh(org)

            client = Client(org_id=org.id, name="Client A")
            db.add(client)
            db.commit()
            db.refresh(client)

            project = Project(
                name="Billable Project",
                organization_id=org.id,
                client_id=client.id,
                status="Active",
                created_by=user.id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            entry = TimesheetEntry(
                org_id=org.id,
                user_id=user.id,
                project_id=project.id,
                client_id=client.id,
                entry_date=date(2026, 4, 20),
                hours=Decimal("8.00"),
                description="Approved work",
                billable=True,
                status="approved",
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)

            invoice = Invoice(
                org_id=org.id,
                client_id=client.id,
                invoice_number="INV-1001",
                issue_date=date(2026, 4, 20),
                period_start=date(2026, 4, 1),
                period_end=date(2026, 4, 30),
                currency="USD",
                status="draft",
                total_amount=Decimal("800.00"),
            )
            db.add(invoice)
            db.commit()
            db.refresh(invoice)

            line_one = InvoiceLine(
                invoice_id=invoice.id,
                project_id=project.id,
                line_type="time",
                description="April work",
                hours=Decimal("8.00"),
                unit_price=Decimal("100.00"),
                amount=Decimal("800.00"),
            )
            line_two = InvoiceLine(
                invoice_id=invoice.id,
                project_id=project.id,
                line_type="time",
                description="Duplicate work",
                hours=Decimal("8.00"),
                unit_price=Decimal("100.00"),
                amount=Decimal("800.00"),
            )
            db.add_all([line_one, line_two])
            db.commit()
            db.refresh(line_one)
            db.refresh(line_two)

            db.add(InvoiceLineTimesheetEntry(invoice_line_id=line_one.id, timesheet_entry_id=entry.id))
            db.commit()

            db.add(InvoiceLineTimesheetEntry(invoice_line_id=line_two.id, timesheet_entry_id=entry.id))
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()

    def test_me_returns_tenant_context_and_client_scope(self):
        user = self.create_user("scoped-user@example.com", role="user")
        org = self.create_org(user, "Scoped Org")
        client_id = None

        db = SessionLocal()
        try:
            client = Client(org_id=org.id, name="Portal Client")
            db.add(client)
            db.commit()
            db.refresh(client)
            client_id = client.id

            membership = OrganizationMember(
                organization_id=org.id,
                user_id=user.id,
                role="client",
                client_id=client_id,
            )
            db.add(membership)
            db.commit()
        finally:
            db.close()

        response = self.client.get(
            f"/auth/me?org_id={org.id}",
            headers=self.make_auth_headers(user),
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["role"], "user")
        self.assertEqual(payload["effective_role"], "client")
        self.assertEqual(payload["active_org_id"], org.id)
        self.assertEqual(payload["client_id"], client_id)


if __name__ == "__main__":
    unittest.main()
