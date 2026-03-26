import os
import tempfile
import unittest


DB_FD, DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Organization, OrganizationMember, User
from app.security import create_access_token, get_password_hash, get_roles_from_user


class RBACInviteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
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

    def create_org_with_owner(self, owner: User, name: str, org_type: str = "Company") -> Organization:
        db = SessionLocal()
        try:
            org = Organization(name=name, type=org_type, status="Active", created_by=owner.id)
            db.add(org)
            db.commit()
            db.refresh(org)
            db.add(OrganizationMember(organization_id=org.id, user_id=owner.id, role="Owner"))
            db.commit()
            db.refresh(org)
            db.expunge(org)
            return org
        finally:
            db.close()

    def test_agency_company_admin_can_invite_agency_user_into_selected_org(self):
        admin = self.create_user("agency-company-admin@example.com", "Agency Company Admin")
        org = self.create_org_with_owner(admin, "Managed Org")

        response = self.client.post(
            "/rbac/users/invite",
            json={
                "email": "agency-user@example.com",
                "role": "Agency User",
                "organization_ids": [org.id],
            },
            headers=self.make_auth_headers(admin),
        )

        self.assertEqual(response.status_code, 201, response.text)

        db = SessionLocal()
        try:
            invited_user = db.query(User).filter(User.email == "agency-user@example.com").first()
            self.assertIsNotNone(invited_user)
            membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == invited_user.id,
            ).first()
            self.assertIsNotNone(membership)
        finally:
            db.close()

    def test_company_admin_cannot_invite_agency_user(self):
        admin = self.create_user("company-admin@example.com", "Company Admin")
        org = self.create_org_with_owner(admin, "Client Org")

        response = self.client.post(
            "/rbac/users/invite",
            json={
                "email": "not-allowed@example.com",
                "role": "Agency User",
                "organization_ids": [org.id],
            },
            headers=self.make_auth_headers(admin),
        )

        self.assertEqual(response.status_code, 403, response.text)

    def test_visible_orgs_require_explicit_selection(self):
        admin = self.create_user("selector-admin@example.com", "Company Admin")
        self.create_org_with_owner(admin, "Selection Required Org")

        response = self.client.post(
            "/rbac/users/invite",
            json={
                "email": "missing-org-selection@example.com",
                "role": "Company User",
                "organization_ids": [],
            },
            headers=self.make_auth_headers(admin),
        )

        self.assertEqual(response.status_code, 400, response.text)


if __name__ == "__main__":
    unittest.main()
