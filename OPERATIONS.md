# BillingApp Operations Guide

## Purpose

BillingApp is a tenant-scoped operations platform for:

- organizations and projects
- internal user onboarding and role-based access
- client onboarding
- timesheet capture and approvals
- billing rate management
- invoice generation
- client invoice visibility through a restricted portal

The tenant boundary is the organization. Most operational actions are done inside a selected organization.

## Core Roles

### Legacy administrative roles

- `Super Admin`
  - platform-wide access
- `Agency Admin`
  - broad admin access across allowed organizations
- `Agency Company Admin`
  - scoped admin for allowed organizations
- `Company Admin`
  - company-scoped admin
- `Agency User`
  - legacy non-admin user
- `Company User`
  - legacy non-admin user
- `Individual User`
  - limited creator role

### Operational roles

- `employee`
  - creates and submits timesheets
- `project_manager`
  - reviews and approves submitted timesheets
- `finance`
  - manages billing rates and invoice lifecycle
- `org_admin`
  - tenant-scoped operational admin
- `client`
  - read-only client portal user

## Recommended Operational Flows

### 1. Set up an organization

1. Sign in with an admin-capable role.
2. Open `Organizations`.
3. Create the organization.
4. Switch the active organization in the app header if needed.

### 2. Create a project

1. Open `Projects`.
2. Create the project under the selected organization.
3. Optionally link the project to a client account.
4. Save the project.

## Internal User Onboarding

### Invite an internal user

1. Open `Users`.
2. Select the correct organization context.
3. Enter the user email.
4. Choose the intended role.
5. Submit the invite.
6. Share the generated magic link.

### Associate an internal user with a project

1. Open `Assignments`.
2. Select the organization and project.
3. Choose the internal user.
4. Save the assignment.

Without project assignment, timesheet access may be incomplete even if the user belongs to the organization.

## Client Onboarding

### Create a client account

1. Open `Clients`.
2. Create the client record inside the selected organization.
3. Use a unique client name within that organization.

Important:
- multiple clients are allowed in the same organization
- the client name must be unique within that organization
- adding another contact to the same client does not require creating another client record

### Invite a client user

1. Open `Users`.
2. Choose role `client`.
3. Select the organization.
4. Select the existing client account from the client dropdown.
5. Submit the invite.
6. Share the generated magic link.

### Add another client contact to the same client

Example: `northstar` already exists and you want to add Jamie.

1. Open `Users`.
2. Choose role `client`.
3. Select the same organization.
4. Select the existing `northstar` client account.
5. Invite `jamie@...`.

Do not create another `northstar` client record for this case. The additional person should be attached to the existing client account.

### How client access to projects works

Client users are not assigned to projects through the `Assignments` screen the way internal users are.

Client visibility is derived from:

- the client membership link
- the organization
- project and invoice records that point to that same `client_id`

That means a client sees invoices related to their client account, not an internal project-member view.

## Timesheet Operations

### Who can create timesheets

- `employee`
- `project_manager`
- some admin roles depending on scope

`client` users cannot create timesheets.

Legacy roles such as `Agency User` are not enough by themselves if the user must work with timesheets. They should also hold a timesheet-capable operational role such as `employee`.

### Timesheet prerequisites

Before a user can log time:

1. the user must belong to the organization
2. the user must have a timesheet-capable role
3. the user should be assigned to the project
4. the project should be active

### Create a timesheet entry

1. Open `Timesheets`.
2. Select the project.
3. Optionally select a task if tasks exist for that project.
4. Enter date, hours, and description.
5. Save draft or submit.

### Approval flow

1. User submits the entry.
2. `project_manager` or allowed admin reviews it.
3. Entry is approved or rejected.
4. Approved billable entries become invoice candidates.

## Task Operations

Backend task support exists today.

Available backend capabilities:

- list project tasks
- create a task for a project
- update a task for a project

Current UI status:

- the timesheet page can consume tasks in the project dropdown flow
- there is no dedicated frontend screen yet to create or manage project tasks

Operational implication:

- if you need project task CRUD from the UI, that still needs to be built
- right now, tasks are supported in the backend but not exposed as a full project task-management experience in the frontend

## Billing Operations

### Create a billing rate

1. Open `Billing`.
2. Select the organization.
3. Choose optional client and optional project scope.
4. Enter rate, currency, and effective date.
5. Save the rate.

Rate precedence is intended to work from more specific to less specific, for example project-scoped before broader client-scoped defaults.

### Generate an invoice

1. Ensure approved billable timesheet entries exist.
2. Open `Billing`.
3. Choose the client and billing period.
4. Generate a draft invoice.
5. Review line items and totals.

### Send an invoice to client view

1. Open the draft invoice.
2. Review it.
3. Mark it as sent.

Client users should only see client-safe invoices and should not be allowed to change invoice status.

## Client Portal Expectations

Client users should only see a restricted experience, primarily:

- dashboard summary
- invoice list
- invoice detail / preview

Client users should not see internal admin modules such as:

- timesheets
- assignments
- organizations
- users
- internal client admin screens
- audit tools
- internal billing controls

## Common Troubleshooting

### User gets `403 Forbidden` on timesheets

Check:

1. the user is not a `client`
2. the user has a timesheet-capable operational role such as `employee`
3. the user is assigned to the project
4. the request is being made in the correct organization scope

### Client invite says client account is required

This means role `client` was selected, but no existing client record was chosen for the invite.

Fix:

1. create the client in `Clients` first
2. return to `Users`
3. choose role `client`
4. select that client in the dropdown

### Client creation fails with duplicate message

This means a client with the same name already exists in that organization.

Use:

- the existing client record if you are adding another contact for the same client
- a different unique client name if you are creating a truly separate client account

### Client cannot see invoice

Check:

1. invoice is not still `draft`
2. invoice belongs to the same organization
3. invoice points to the same `client_id` as the logged-in client user

## Environment and Run

### Backend

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Start both

```powershell
.\run.bat
```

## Required Configuration

Create a root `.env` file. Typical minimum settings:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SECRET_KEY=replace-with-a-real-secret
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_COOKIE_MODE=false
```

## Current Known Gaps

- project task CRUD is supported in the backend but not yet exposed through a dedicated frontend task-management screen
- client membership is scoped through client account linkage, not internal project assignment
- some role combinations still depend on correct tenant scope selection in the UI
