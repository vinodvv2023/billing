import os
import tempfile
import unittest


DB_FD, DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Organization, OrganizationMember, Project, User
from app.security import create_access_token, get_password_hash, get_roles_from_user


class RBACCrudPermissionTests(unittest.TestCase):
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

    def create_user(self, email: str, role: str) -> User:
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

    def create_workspace(self, creator: User, membership_role: str | None = None):
        db = SessionLocal()
        try:
            org = Organization(name=f"Org-{creator.email}", type="Company", status="Active", created_by=creator.id)
            db.add(org)
            db.commit()
            db.refresh(org)
            db.add(
                OrganizationMember(
                    organization_id=org.id,
                    user_id=creator.id,
                    role=membership_role or creator.role,
                )
            )
            db.commit()
            project = Project(name="Workspace Project", organization_id=org.id, status="Active", created_by=creator.id)
            db.add(project)
            db.commit()
            db.refresh(project)
            return {"org_id": org.id, "project_id": project.id}
        finally:
            db.close()

    def test_agency_admin_can_update_and_delete_organization(self):
        user = self.create_user("agency-admin@example.com", "Agency Admin")
        workspace = self.create_workspace(user)

        update_response = self.client.patch(
            f"/rbac/organizations/{workspace['org_id']}",
            json={"name": "Updated Agency Org", "status": "Inactive"},
            headers=self.auth_headers(user),
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(update_response.json()["name"], "Updated Agency Org")

        delete_response = self.client.delete(
            f"/rbac/organizations/{workspace['org_id']}",
            headers=self.auth_headers(user),
        )
        self.assertEqual(delete_response.status_code, 204, delete_response.text)

    def test_company_admin_can_update_and_delete_project(self):
        user = self.create_user("company-admin@example.com", "Company Admin")
        workspace = self.create_workspace(user)

        update_response = self.client.patch(
            f"/rbac/projects/{workspace['project_id']}",
            json={"name": "Updated Project", "status": "Inactive"},
            headers=self.auth_headers(user),
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(update_response.json()["name"], "Updated Project")

        delete_response = self.client.delete(
            f"/rbac/projects/{workspace['project_id']}",
            headers=self.auth_headers(user),
        )
        self.assertEqual(delete_response.status_code, 204, delete_response.text)

    def test_org_admin_can_update_and_delete_scoped_org_and_project(self):
        owner = self.create_user("owner@example.com", "Company Admin")
        workspace = self.create_workspace(owner, membership_role="Company Admin")
        org_admin = self.create_user("org-admin@example.com", "user")

        db = SessionLocal()
        try:
            db.add(
                OrganizationMember(
                    organization_id=workspace["org_id"],
                    user_id=org_admin.id,
                    role="org_admin",
                )
            )
            db.commit()
        finally:
            db.close()

        project_update = self.client.patch(
            f"/rbac/projects/{workspace['project_id']}",
            json={"name": "Scoped Project Update", "status": "Inactive"},
            headers=self.auth_headers(org_admin),
        )
        self.assertEqual(project_update.status_code, 200, project_update.text)
        self.assertEqual(project_update.json()["name"], "Scoped Project Update")

        org_update = self.client.patch(
            f"/rbac/organizations/{workspace['org_id']}",
            json={"name": "Scoped Org Update", "status": "Inactive"},
            headers=self.auth_headers(org_admin),
        )
        self.assertEqual(org_update.status_code, 200, org_update.text)
        self.assertEqual(org_update.json()["name"], "Scoped Org Update")


if __name__ == "__main__":
    unittest.main()
