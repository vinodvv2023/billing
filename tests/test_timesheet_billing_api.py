import os
import tempfile
import unittest
from datetime import date


DB_FD, DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import BillingRate, Client, Invoice, Organization, OrganizationMember, Project, ProjectMember, User
from app.security import create_access_token, get_password_hash, get_roles_from_user


class TimesheetBillingApiTests(unittest.TestCase):
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

    def auth_headers(self, user: User) -> dict[str, str]:
        token = create_access_token(
            data={"sub": user.email, "roles": get_roles_from_user(user), "uid": user.id}
        )
        return {"Authorization": f"Bearer {token}"}

    def seed_user(self, email: str, role: str = "user") -> User:
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

    def seed_workspace(self):
        admin = self.seed_user("admin@example.com", role="Company Admin")
        employee = self.seed_user("employee@example.com", role="user")
        manager = self.seed_user("manager@example.com", role="user")
        finance = self.seed_user("finance@example.com", role="user")
        client_user = self.seed_user("portal@example.com", role="user")

        db = SessionLocal()
        try:
            org = Organization(name="Acme Org", type="Company", status="Active", created_by=admin.id)
            db.add(org)
            db.commit()
            db.refresh(org)

            client = Client(org_id=org.id, name="Client One")
            db.add(client)
            db.commit()
            db.refresh(client)

            project = Project(
                name="Website Revamp",
                organization_id=org.id,
                client_id=client.id,
                status="Active",
                created_by=admin.id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            db.add_all(
                [
                    OrganizationMember(organization_id=org.id, user_id=admin.id, role="org_admin"),
                    OrganizationMember(organization_id=org.id, user_id=employee.id, role="employee"),
                    OrganizationMember(organization_id=org.id, user_id=manager.id, role="project_manager"),
                    OrganizationMember(organization_id=org.id, user_id=finance.id, role="finance"),
                    OrganizationMember(organization_id=org.id, user_id=client_user.id, role="client", client_id=client.id),
                    ProjectMember(project_id=project.id, user_id=employee.id, role="contributor"),
                    ProjectMember(project_id=project.id, user_id=manager.id, role="manager"),
                ]
            )
            db.add(
                BillingRate(
                    org_id=org.id,
                    client_id=client.id,
                    project_id=project.id,
                    hourly_rate="125.00",
                    currency="USD",
                    effective_from=date(2026, 1, 1),
                )
            )
            db.commit()
            return {
                "admin": admin,
                "employee": employee,
                "manager": manager,
                "finance": finance,
                "client_user": client_user,
                "org_id": org.id,
                "client_id": client.id,
                "project_id": project.id,
            }
        finally:
            db.close()

    def test_timesheet_submit_approve_and_invoice_generate(self):
        workspace = self.seed_workspace()
        employee = workspace["employee"]
        manager = workspace["manager"]
        finance = workspace["finance"]

        create_response = self.client.post(
            "/timesheets/entries",
            json={
                "project_id": workspace["project_id"],
                "entry_date": "2026-04-20",
                "hours": "8.00",
                "description": "Homepage implementation",
                "billable": True,
            },
            headers=self.auth_headers(employee),
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)
        entry_id = create_response.json()["id"]

        submit_response = self.client.post(
            f"/timesheets/entries/{entry_id}/submit",
            headers=self.auth_headers(employee),
        )
        self.assertEqual(submit_response.status_code, 200, submit_response.text)
        self.assertEqual(submit_response.json()["status"], "submitted")

        approve_response = self.client.post(
            f"/timesheets/entries/{entry_id}/approve",
            headers=self.auth_headers(manager),
        )
        self.assertEqual(approve_response.status_code, 200, approve_response.text)
        self.assertEqual(approve_response.json()["status"], "approved")

        generate_response = self.client.post(
            "/billing/invoices/generate",
            json={
                "org_id": workspace["org_id"],
                "client_id": workspace["client_id"],
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "issue_date": "2026-05-01",
                "currency": "USD",
                "grouping_mode": "project",
            },
            headers=self.auth_headers(finance),
        )
        self.assertEqual(generate_response.status_code, 201, generate_response.text)
        payload = generate_response.json()
        self.assertEqual(payload["client_id"], workspace["client_id"])
        self.assertEqual(payload["status"], "draft")
        self.assertEqual(payload["total_amount"], "1000.00")
        self.assertEqual(payload["lines"][0]["timesheet_entry_ids"], [entry_id])

    def test_client_user_can_only_see_own_invoices(self):
        workspace = self.seed_workspace()
        employee = workspace["employee"]
        manager = workspace["manager"]
        finance = workspace["finance"]
        client_user = workspace["client_user"]

        db = SessionLocal()
        try:
            second_client = Client(org_id=workspace["org_id"], name="Client Two")
            db.add(second_client)
            db.commit()
            db.refresh(second_client)
            db.add(
                Invoice(
                    org_id=workspace["org_id"],
                    client_id=second_client.id,
                    invoice_number="INV-2026-0009",
                    issue_date=date(2026, 5, 3),
                    period_start=date(2026, 4, 1),
                    period_end=date(2026, 4, 30),
                    currency="USD",
                    status="sent",
                    total_amount="500.00",
                )
            )
            db.commit()
        finally:
            db.close()

        entry_response = self.client.post(
            "/timesheets/entries",
            json={
                "project_id": workspace["project_id"],
                "entry_date": "2026-04-22",
                "hours": "4.00",
                "description": "Client portal fix",
                "billable": True,
            },
            headers=self.auth_headers(employee),
        )
        entry_id = entry_response.json()["id"]
        self.client.post(f"/timesheets/entries/{entry_id}/submit", headers=self.auth_headers(employee))
        self.client.post(f"/timesheets/entries/{entry_id}/approve", headers=self.auth_headers(manager))

        generate_response = self.client.post(
            "/billing/invoices/generate",
            json={
                "org_id": workspace["org_id"],
                "client_id": workspace["client_id"],
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "issue_date": "2026-05-01",
                "currency": "USD",
                "grouping_mode": "project",
            },
            headers=self.auth_headers(finance),
        )
        self.assertEqual(generate_response.status_code, 201, generate_response.text)

        own_invoices = self.client.get(
            f"/billing/invoices?org_id={workspace['org_id']}",
            headers=self.auth_headers(client_user),
        )
        self.assertEqual(own_invoices.status_code, 200, own_invoices.text)
        payload = own_invoices.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["client_id"], workspace["client_id"])

    def test_project_rate_precedence_beats_client_rate(self):
        workspace = self.seed_workspace()
        employee = workspace["employee"]
        manager = workspace["manager"]
        finance = workspace["finance"]
        db = SessionLocal()
        try:
            db.add(
                BillingRate(
                    org_id=workspace["org_id"],
                    client_id=workspace["client_id"],
                    hourly_rate="90.00",
                    currency="USD",
                    effective_from=date(2026, 1, 1),
                )
            )
            db.commit()
        finally:
            db.close()

        create_response = self.client.post(
            "/timesheets/entries",
            json={
                "project_id": workspace["project_id"],
                "entry_date": "2026-04-25",
                "hours": "2.00",
                "description": "Design QA",
                "billable": True,
            },
            headers=self.auth_headers(employee),
        )
        entry_id = create_response.json()["id"]
        self.client.post(f"/timesheets/entries/{entry_id}/submit", headers=self.auth_headers(employee))
        self.client.post(f"/timesheets/entries/{entry_id}/approve", headers=self.auth_headers(manager))

        generate_response = self.client.post(
            "/billing/invoices/generate",
            json={
                "org_id": workspace["org_id"],
                "client_id": workspace["client_id"],
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "issue_date": "2026-05-02",
                "currency": "USD",
                "grouping_mode": "project",
            },
            headers=self.auth_headers(finance),
        )
        self.assertEqual(generate_response.status_code, 201, generate_response.text)
        payload = generate_response.json()
        self.assertEqual(payload["lines"][0]["unit_price"], "125.00")

    def test_project_manager_approval_queue_only_shows_managed_submissions(self):
        workspace = self.seed_workspace()
        employee = workspace["employee"]
        manager = workspace["manager"]

        create_response = self.client.post(
            "/timesheets/entries",
            json={
                "project_id": workspace["project_id"],
                "entry_date": "2026-04-26",
                "hours": "3.00",
                "description": "Managed queue item",
                "billable": True,
            },
            headers=self.auth_headers(employee),
        )
        entry_id = create_response.json()["id"]
        self.client.post(f"/timesheets/entries/{entry_id}/submit", headers=self.auth_headers(employee))

        queue_response = self.client.get(
            f"/timesheets/approvals?org_id={workspace['org_id']}",
            headers=self.auth_headers(manager),
        )
        self.assertEqual(queue_response.status_code, 200, queue_response.text)
        payload = queue_response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], entry_id)
        self.assertEqual(payload[0]["status"], "submitted")

    def test_draft_invoice_supports_manual_line_add_update_delete(self):
        workspace = self.seed_workspace()
        employee = workspace["employee"]
        manager = workspace["manager"]
        finance = workspace["finance"]

        create_response = self.client.post(
            "/timesheets/entries",
            json={
                "project_id": workspace["project_id"],
                "entry_date": "2026-04-27",
                "hours": "1.00",
                "description": "Base invoice work",
                "billable": True,
            },
            headers=self.auth_headers(employee),
        )
        entry_id = create_response.json()["id"]
        self.client.post(f"/timesheets/entries/{entry_id}/submit", headers=self.auth_headers(employee))
        self.client.post(f"/timesheets/entries/{entry_id}/approve", headers=self.auth_headers(manager))

        generate_response = self.client.post(
            "/billing/invoices/generate",
            json={
                "org_id": workspace["org_id"],
                "client_id": workspace["client_id"],
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "issue_date": "2026-05-04",
                "currency": "USD",
                "grouping_mode": "project",
            },
            headers=self.auth_headers(finance),
        )
        self.assertEqual(generate_response.status_code, 201, generate_response.text)
        invoice = generate_response.json()
        invoice_id = invoice["id"]
        self.assertEqual(invoice["total_amount"], "125.00")

        add_line = self.client.post(
            f"/billing/invoices/{invoice_id}/lines",
            json={
                "description": "Manual expense",
                "amount": "50.00",
                "line_type": "manual",
            },
            headers=self.auth_headers(finance),
        )
        self.assertEqual(add_line.status_code, 201, add_line.text)
        invoice = add_line.json()
        self.assertEqual(invoice["total_amount"], "175.00")
        manual_line = next(line for line in invoice["lines"] if line["line_type"] == "manual")

        update_line = self.client.patch(
            f"/billing/invoices/{invoice_id}/lines/{manual_line['id']}",
            json={"amount": "75.00", "description": "Updated manual expense"},
            headers=self.auth_headers(finance),
        )
        self.assertEqual(update_line.status_code, 200, update_line.text)
        invoice = update_line.json()
        self.assertEqual(invoice["total_amount"], "200.00")

        delete_line = self.client.delete(
            f"/billing/invoices/{invoice_id}/lines/{manual_line['id']}",
            headers=self.auth_headers(finance),
        )
        self.assertEqual(delete_line.status_code, 204, delete_line.text)

        invoice_after_delete = self.client.get(
            f"/billing/invoices/{invoice_id}",
            headers=self.auth_headers(finance),
        )
        self.assertEqual(invoice_after_delete.status_code, 200, invoice_after_delete.text)
        invoice = invoice_after_delete.json()
        self.assertEqual(invoice["total_amount"], "125.00")
        self.assertEqual(len(invoice["lines"]), 1)

    def test_bulk_review_endpoints_and_invoice_render(self):
        workspace = self.seed_workspace()
        employee = workspace["employee"]
        manager = workspace["manager"]
        finance = workspace["finance"]
        client_user = workspace["client_user"]

        entry_ids = []
        for day in ("2026-04-28", "2026-04-29"):
            create_response = self.client.post(
                "/timesheets/entries",
                json={
                    "project_id": workspace["project_id"],
                    "entry_date": day,
                    "hours": "2.00",
                    "description": f"Work for {day}",
                    "billable": True,
                },
                headers=self.auth_headers(employee),
            )
            self.assertEqual(create_response.status_code, 201, create_response.text)
            entry_id = create_response.json()["id"]
            entry_ids.append(entry_id)
            submit_response = self.client.post(
                f"/timesheets/entries/{entry_id}/submit",
                headers=self.auth_headers(employee),
            )
            self.assertEqual(submit_response.status_code, 200, submit_response.text)

        bulk_approve = self.client.post(
            "/timesheets/entries/bulk-approve",
            json={"entry_ids": entry_ids},
            headers=self.auth_headers(manager),
        )
        self.assertEqual(bulk_approve.status_code, 200, bulk_approve.text)
        self.assertEqual(bulk_approve.json()["count"], 2)
        self.assertTrue(all(entry["status"] == "approved" for entry in bulk_approve.json()["entries"]))

        generate_response = self.client.post(
            "/billing/invoices/generate",
            json={
                "org_id": workspace["org_id"],
                "client_id": workspace["client_id"],
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "issue_date": "2026-05-05",
                "currency": "USD",
                "grouping_mode": "project",
            },
            headers=self.auth_headers(finance),
        )
        self.assertEqual(generate_response.status_code, 201, generate_response.text)
        invoice_id = generate_response.json()["id"]

        render_response = self.client.get(
            f"/billing/invoices/{invoice_id}/render",
            headers=self.auth_headers(client_user),
        )
        self.assertEqual(render_response.status_code, 200, render_response.text)
        self.assertIn("text/html", render_response.headers["content-type"])
        self.assertIn("Invoice", render_response.text)
        self.assertIn("Client One", render_response.text)


if __name__ == "__main__":
    unittest.main()
