# RBAC System Guide

This project is a FastAPI + Next.js application with tenant-aware RBAC layered on top of local auth, OAuth login, organizations, projects, invitations, and project assignments.

## Stack

- Backend: FastAPI, SQLAlchemy
- Frontend: Next.js App Router, React Query
- Database: PostgreSQL in production, SQLite works for tests/local fallback

## Install

### Backend

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend docs:

- `http://127.0.0.1:8000/docs`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend app:

- `http://localhost:3000`

### One-click local run

You can also start both apps with:

```powershell
.\run.bat
```

## Environment

Root `.env` should contain at least:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SECRET_KEY=your-secret
FRONTEND_URL=http://localhost:3000
```

OAuth providers are optional. Add provider client ids and secrets only for the providers you want to enable.

## How RBAC Is Implemented

RBAC in this project is built around four core entities:

- `users`
- `organizations`
- `projects`
- membership tables:
  - `organization_members`
  - `project_members`

The important idea is:

- a `user` is the person
- an `organization` is the tenant/workspace boundary
- a `role` is what the user can do in that tenant
- a `project assignment` is the project-level association inside that tenant

### Main backend router

Most RBAC behavior lives in:

- `app/routers/rbac.py`

It handles:

- organization listing and creation
- project listing and creation
- user invites
- scoped role updates
- tenant summary
- project assignment and unassignment
- audit access
- dashboard activity

### Main frontend areas

The RBAC UI is in:

- `frontend/src/app/(app)/organizations`
- `frontend/src/app/(app)/projects`
- `frontend/src/app/(app)/users`
- `frontend/src/app/(app)/assignments`
- `frontend/src/app/(app)/access-matrix`

Shared UI/session logic is in:

- `frontend/src/lib/session.tsx`
- `frontend/src/lib/tenant-scope.ts`
- `frontend/src/lib/api-hooks.ts`

## Roles

This project currently uses these roles:

- `Super Admin`
- `Agency Admin`
- `Agency Company Admin`
- `Agency User`
- `Company Admin`
- `Company User`
- `Individual User`

### Role intent

`Super Admin`

- full platform access
- can view audit
- can manage all modules and roles

`Agency Admin`

- can create agency/company organizations
- can create projects
- can invite `Agency Company Admin` and `Agency User`
- can assign eligible users to projects in visible organizations

`Agency Company Admin`

- can create agency/company organizations in allowed scope
- can create projects
- can invite `Agency User`
- can assign eligible users to projects in visible organizations

`Agency User`

- view/participant role
- no admin creation flows

`Company Admin`

- can create one company organization
- can create projects in allowed scope
- can invite `Company User`
- can assign eligible company users to projects

`Company User`

- view/participant role
- no admin creation flows

`Individual User`

- limited creator path
- can create a single company and projects in that scope

## How Tenants Work Here

In this project, a tenant is effectively an `organization`.

Examples:

- a company org
- an agency org

Everything important is scoped to that organization:

- visible members
- scoped role checks
- visible projects
- project assignments

### Active tenant

The frontend keeps an active organization in session state:

- `activeOrganizationId`

That drives:

- organization-scoped user listing
- assignment screen scope
- effective role resolution in the current workspace

### Effective role

The app resolves the active role from organization membership first, with compatibility fallback to the global user role.

This matters because the same person can appear in different org scopes and project scopes.

### Legacy membership labels

Older rows may contain labels like:

- `Owner`
- `Member`

The current implementation normalizes these legacy labels back to the user’s actual RBAC role so admin screens and assignment behavior still work.

## Invitation Flow

Admins invite users from:

- `http://localhost:3000/users`

Invite flow:

1. Admin enters email, role, and target organizations.
2. Backend creates the user in pending state.
3. Backend creates an invite token.
4. Backend adds scoped organization membership rows.
5. User accepts the magic link and becomes active.

Relevant endpoints:

- `POST /rbac/users/invite`
- `GET /auth/magic/validate`
- `POST /auth/magic/accept`

## Assignment Flow

Assignments are managed from:

- `http://localhost:3000/assignments`

Behavior:

1. Admin selects an organization scope.
2. Admin sees projects inside that organization.
3. Admin searches/selects an eligible member.
4. Backend creates or removes `project_members` rows.

Relevant endpoints:

- `GET /rbac/tenant-summary`
- `POST /rbac/projects/{project_id}/assign`
- `DELETE /rbac/projects/{project_id}/assignments/{user_id}`

## Profile and Session

Profile management is available at:

- `http://localhost:3000/settings/profile`

Relevant endpoints:

- `GET /auth/me`
- `PATCH /auth/me`

The profile save flow can return a refreshed token so updated email/full-name values are reflected in the UI immediately.

## Audit and Dashboard

Audit is limited to:

- `Super Admin`

Dashboard data is live and sourced from:

- organizations
- projects
- users
- audit-derived activity feed

Relevant endpoint:

- `GET /rbac/dashboard/activity`

## Important Design Notes

- Organization is the tenant boundary.
- Project membership is separate from organization membership.
- Inviting a user does not automatically assign them to every project.
- Assignments are explicit.
- Frontend visibility and backend authorization both participate in enforcement.
- Backend enforcement is the source of truth.

## Useful Local URLs

- App: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`
- Organizations: `http://localhost:3000/organizations`
- Projects: `http://localhost:3000/projects`
- Users: `http://localhost:3000/users`
- Assignments: `http://localhost:3000/assignments`
- Access Matrix: `http://localhost:3000/access-matrix`
- Profile: `http://localhost:3000/settings/profile`
- API docs: `http://127.0.0.1:8000/docs`

## If You Extend This RBAC Further

Recommended next steps:

- migrate all remaining auth checks fully to organization-scoped roles
- add DB migrations for any legacy membership role cleanup
- add backend tests for invites, assignments, and scoped role updates
- add keyboard navigation to all combobox interactions
