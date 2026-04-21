# BillingApp

BillingApp is a multi-tenant internal operations and client-portal application built on top of OAuth/local authentication and tenant-aware RBAC.

It combines:
- user authentication and invitations
- organization and project management
- role-based access control
- client onboarding
- timesheet capture and approvals
- billing rates
- invoice generation
- a restricted client invoice portal

This README is the operator guide for the current application behavior.

## 1. What the app does

### Purpose of the app

The app is designed for organizations that need to manage delivery work and turn approved effort into client invoices while keeping access tightly controlled.

In practical terms, the app allows you to:
- create organizations and projects
- invite internal users and client users
- assign users to projects
- capture billable time
- approve or reject submitted time
- define billing rates
- generate invoices from approved billable time
- let clients log in and view only their own invoice information

### Main modules

- Authentication
  - local email/password
  - OAuth/OIDC providers
  - magic-link invite acceptance
- RBAC and tenancy
  - organizations are the tenant boundary
  - project membership is separate from organization membership
- Client management
  - client records belong to an organization
  - client users are linked to a specific client record
- Timesheets
  - internal users log time against projects
  - managers/admins review and approve
- Billing
  - finance/admin roles define rates and create invoices
- Client portal
  - client users get a limited read-only invoice experience

## 2. RBAC roles and what each role is

The app currently uses two role families:

### Legacy organizational roles

These are the original admin and member roles used across the RBAC system:

- `Super Admin`
  - full platform access
  - can manage all organizations, projects, users, audit, billing, and assignments
- `Agency Admin`
  - high-level admin within agency-style usage
  - can create/manage organizations and projects in scope
  - can invite users in allowed scope
- `Agency Company Admin`
  - scoped admin role below Agency Admin
  - can manage organizations/projects in allowed scope
  - can invite allowed subordinate users
- `Agency User`
  - legacy participant role
  - not sufficient by itself for the newer timesheet workflow
- `Company Admin`
  - company-scoped admin role
  - can manage organizations/projects in allowed scope
  - can invite allowed users
- `Company User`
  - legacy participant role
- `Individual User`
  - limited creator role for simpler scenarios

### Modern operational roles

These are the roles used by the newer timesheet and billing modules:

- `employee`
  - internal contributor
  - can log and submit their own timesheets
- `project_manager`
  - can review submitted timesheets for projects they manage
  - can approve/reject time
- `finance`
  - can manage billing rates
  - can generate invoices
  - can update invoice lifecycle state
- `org_admin`
  - tenant-scoped admin role
  - can manage operational setup inside the org
- `client`
  - external/client portal role
  - can only view client-safe invoice information for their linked client

### Important note about roles

Timesheets and billing are built around the modern operational roles.

That means:
- `Agency User` alone is not the same thing as `employee`
- `Company User` alone is not the same thing as `employee`

If someone must enter timesheets, they should have a role such as:
- `employee`
- or `project_manager`

and they should be associated with the relevant project.

## 3. Workflow for each user type

### Super Admin

Typical workflow:
- sign in
- create or manage organizations
- create or manage projects
- invite admins, internal users, and clients
- review audit
- oversee billing setup and invoice flow

### Agency Admin / Agency Company Admin / Company Admin / org_admin

Typical workflow:
- sign in
- select the active organization
- create or edit projects
- create clients
- invite internal users and client users
- assign internal users to projects
- monitor timesheets and approvals depending on role
- manage billing/invoices if role allows it

### Employee

Typical workflow:
- sign in
- go to `Timesheets`
- choose project/task/date/hours/notes
- save draft
- submit entry
- wait for approval or rejection

### Project Manager

Typical workflow:
- sign in
- go to `Timesheets`
- open the approval queue
- review submitted entries in managed project scope
- approve or reject entries

### Finance

Typical workflow:
- sign in
- go to `Billing`
- create billing rates
- review unbilled approved hours
- generate draft invoice
- review invoice
- mark invoice sent
- later mark invoice paid

### Client

Typical workflow:
- receive magic-link invite
- accept invite and log in
- see client portal navigation only
- view invoice list
- open invoice detail
- open printable invoice view if needed

Client users should not see or use:
- timesheets
- projects
- clients admin page
- organizations
- users
- assignments
- audit
- internal billing controls

## 4. How to invite users and clients

### How to invite an internal user

1. Sign in with an admin-capable role.
2. Go to `Users`.
3. Select the target organization in the app header.
4. In the `Invite User` card:
   - enter email
   - choose the correct role
   - choose the organization
5. Click `Invite`.
6. The app creates a magic link.
7. The latest invite link is shown in the UI and copied to the clipboard.
8. The invited user opens the link, sets a password, and joins.

### How to invite a client

A client user cannot be invited as a free-floating user. They must be linked to a real client record.

Required flow:

1. Go to `Clients`.
2. Create the client record first.
3. Go to `Users`.
4. Choose role `client`.
5. Choose the organization.
6. Choose the `Client account` from the dropdown.
7. Click `Invite`.

What happens:
- the invite is created
- the user is linked to the selected organization
- the membership is linked to the selected `client_id`
- the user receives client-portal access, not internal workspace access

### How to invite an additional client user for the same org and same client

If the organization already has a client record, for example `northstar`, and you want to add another contact such as Jamie:

1. Do not create another client record if Jamie belongs to the same client account.
2. Go to `Users`.
3. Choose role `client`.
4. Choose the same organization.
5. Choose the same existing client account, for example `northstar`.
6. Click `Invite`.

That creates another client user tied to the same client record.

### How to create an additional client for the same org

You can have multiple client records in the same organization.

The only rule is:
- client names must be unique within the same organization

Examples:
- allowed in same org:
  - `Northstar`
  - `Acme`
  - `Contoso`
- not allowed in same org:
  - `Northstar`
  - another `Northstar`

If you truly need two separate client records for one company, use distinct names such as:
- `Northstar - US`
- `Northstar - Advisory`
- `Northstar - Division B`

## 5. Timesheets

### Who can work on timesheets

Internal users only.

In practice:
- `employee` can log and submit timesheets
- `project_manager` can review and approve
- admin roles can see more depending on scope
- `client` cannot use timesheets

Legacy roles like `Agency User` or `Company User` are not enough on their own for the new timesheet workflow unless they are also given a modern operational role such as `employee`.

### Prerequisites before a user can log time

1. The user must belong to the organization.
2. The user must have a timesheet-capable role such as `employee`.
3. The user should be associated with the project through `Assignments`.
4. The project should be active.

### How to create a timesheet

1. Sign in as an internal timesheet-capable user.
2. Go to `Timesheets`.
3. In `Log new entry`:
   - select project
   - select date
   - enter hours
   - optionally select task
   - optionally use the project default client
   - enter description
4. Click `Save draft`.
5. The entry appears in the current period list.

### How to submit a timesheet

1. In `Current period entries`, find the draft entry.
2. Click `Submit`.

### Who approves timesheets

Primary approvers:
- `project_manager`

Also allowed depending on scope:
- `org_admin`
- higher admin roles

### How approval works

1. Project manager/admin opens `Timesheets`.
2. Reviews the `Approval queue`.
3. Approves or rejects entries.
4. Approved billable entries become eligible for invoice generation.

## 6. How to create a billing rate

Roles that typically do this:
- `finance`
- `org_admin`
- admin roles with billing access

Steps:

1. Go to `Billing`.
2. In `Billing rate`:
   - optionally select client
   - optionally select project
   - optionally set a role
   - set hourly rate
   - set currency
   - set effective date
3. Click `Save rate`.

Interpretation:
- if project is set, the rate is project-scoped
- if only client is set, it is client-scoped
- if neither is set, it behaves as a broader fallback

## 7. How to generate an invoice

Roles that typically do this:
- `finance`
- `org_admin`
- admin roles with billing access

Steps:

1. Ensure there are approved, billable timesheet entries.
2. Go to `Billing`.
3. In `Generate invoice`:
   - choose client
   - choose period start
   - choose period end
   - choose issue date
   - choose grouping mode
   - optionally add internal notes
4. Click `Generate draft invoice`.
5. The draft invoice appears in the invoice list.

## 8. How to send to client view

The client portal is intended to be read-only.

Flow:

1. Internal finance/admin user generates draft invoice.
2. Internal finance/admin user opens the invoice.
3. Internal finance/admin user clicks `Mark sent`.
4. Client user logs in.
5. Client sees only non-draft client-visible invoices in the portal.

Important:
- client users cannot mark invoices sent
- client users cannot change invoice status
- client users cannot see internal billing controls

## 9. Views and user experience flow

### Internal workspace flow

Internal users see the full app shell depending on role:
- Dashboard
- Clients
- Timesheets
- Billing
- Organizations
- Projects
- Users
- Assignments
- Audit/access tools depending on privilege

### Client portal flow

Client users see a restricted portal:
- Dashboard
- Invoices

They are redirected away from internal-only routes back to the invoice portal.

### Invoice preview behavior

Current behavior:
- clicking an invoice opens an in-place modal preview
- from the modal, users can open a printable full document route
- internal users get operational actions in the modal
- client users get read-only invoice preview in the modal

## 10. Installation, configuration, and running the app

## Prerequisites

- Python 3.11+
- Node.js and npm
- PostgreSQL or Neon Postgres
- optional OAuth app credentials if you want third-party login providers

## Backend installation

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend API docs:
- `http://127.0.0.1:8000/docs`

## Frontend installation

```powershell
cd frontend
npm install
npm run dev
```

Frontend app:
- `http://localhost:3000`

## Run both services together

You can start both backend and frontend with:

```powershell
.\run.bat
```

The current `run.bat`:
- starts backend on `127.0.0.1:8000`
- starts frontend on `localhost:3000`
- uses `.venv\Scripts\python.exe` if available
- uses the direct Node/npm path on Windows to avoid broken npm shim issues

## Environment configuration

Create a root `.env` file. You can use `.env_example.txt` as a starting point.

### Required backend variables

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SECRET_KEY=replace-with-a-real-secret
FRONTEND_URL=http://localhost:3000
```

### Frontend environment variables

The frontend reads:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_COOKIE_MODE=false
```

Notes:
- `NEXT_PUBLIC_API_URL` should point to the backend base URL
- `NEXT_PUBLIC_COOKIE_MODE` defaults to `false`

### Optional OAuth provider variables

Add only the providers you actually want to enable. The app supports multiple providers including:
- Google
- Apple
- Microsoft
- Facebook
- Twitter/X
- GitHub
- GitLab
- Discord
- Reddit
- Instagram
- Amazon
- Dropbox
- LinkedIn

Examples:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
```

OAuth callback pattern:
- `http://localhost:8000/auth/{provider}/callback`

Example:
- `http://localhost:8000/auth/github/callback`

## Database notes

- Production is intended for PostgreSQL/Neon
- tests can run with SQLite
- the repository includes SQL migration files under `docs/migrations`

## Suggested first-time setup sequence

1. Create `.env`
2. Install backend dependencies
3. Install frontend dependencies
4. Start backend
5. Start frontend
6. Run DB migration if needed
7. Open the app
8. Create organization
9. Create project
10. Create client
11. Invite internal users
12. Invite client users

## Quick operational checklist

If timesheet entry does not work:
- confirm the user is not a `client`
- confirm the user has a modern timesheet role such as `employee`
- confirm the user is assigned to the project

If client invite does not work:
- confirm a client record exists first
- confirm role is `client`
- confirm a client account is selected during invite

If client cannot see invoice:
- confirm invoice is not still `draft`
- confirm the client user is linked to the correct `client_id`
- confirm the project and invoice belong to that same client

## Useful URLs

- App: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`
- Clients: `http://localhost:3000/clients`
- Timesheets: `http://localhost:3000/timesheets`
- Billing: `http://localhost:3000/billing`
- Organizations: `http://localhost:3000/organizations`
- Projects: `http://localhost:3000/projects`
- Users: `http://localhost:3000/users`
- Assignments: `http://localhost:3000/assignments`
- Access Matrix: `http://localhost:3000/access-matrix`
- API docs: `http://127.0.0.1:8000/docs`

## Notes

- Client users belong to a client record, not directly to project membership.
- A project is associated to a client through `projects.client_id`.
- Client visibility is derived from matching `client_id` within the selected organization.
- Internal timesheet and billing flows are intentionally separated from the client portal.
