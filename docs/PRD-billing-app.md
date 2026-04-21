Here’s a structured PRD you can refine and drop into Notion/Confluence. I’ll assume:

- Existing OAuth/OIDC + RBAC backend from `vinodvv2023/RBAC`.
- Backend: Python 3.11 (likely FastAPI/Flask/Django).
- Frontend: React.
- Primary DB: Neon serverless Postgres (for autoscaling, branching, and cost-efficient dev/prod). [neon](https://neon.com/docs/introduction/serverless)

***

## 1. Product Overview

### 1.1 Vision

Build an internal-first, multi-tenant Timesheet and Billing system that:

- Lets employees log time against projects with clear expectations and deadlines.
- Lets managers track progress and approve time.
- Lets finance generate client invoices directly from approved timesheets.
- Provides clients with secure, RBAC-controlled access to invoices via a portal.
- Reuses the existing OAuth and RBAC stack and uses Neon as the primary Postgres database backend. [neon](https://neon.com/docs/introduction)

### 1.2 Modules

- Timesheet module (internal users).
- Billing module (finance/internal).
- Client portal (external users).
- Admin module (tenant configuration, user/role management leveraging existing RBAC).

***

## 2. Goals and Non‑Goals

### 2.1 Goals (V1)

- Single sign-on via existing OAuth/OIDC.
- Tenant-aware RBAC controlling access to timesheets, projects, billing, and client portal views.
- Employees can log, edit, and submit working hours against projects with descriptions, billable flag, and linkage to expected outcomes and deadlines.
- Managers can review and approve/reject timesheets.
- Finance can configure billing rates and generate invoices from approved, billable time.
- Clients can log in and securely view their invoices and basic billing history.
- Data stored in Neon Postgres with environment separation (dev/stage/prod) and usage-based scaling. [learn.microsoft](https://learn.microsoft.com/en-us/azure/partner-solutions/neon/overview)

### 2.2 Non‑Goals (Initial Version)

- No payments/Stripe integration (view-only invoices initially).
- No complex project accounting (e.g., revenue recognition, multi-currency FX).
- No full-featured reporting/BI layer beyond basic timesheets and invoice summaries.
- No mobile-native app (web UI should be responsive enough for mobile browsers).

***

## 3. Personas and Roles

### 3.1 Personas

- **Employee / Individual Contributor**
  - Logs time daily/weekly.
  - Needs clarity on what’s expected and by when.
- **Project Manager**
  - Defines project scope, expected outcomes, and deadlines.
  - Approves/rejects timesheets for their projects.
- **Finance / Billing Specialist**
  - Maintains billing rates.
  - Generates invoices from approved time.
  - Monitors unbilled hours and outstanding invoices.
- **Org Admin**
  - Manages tenants, users, and role assignments (via existing RBAC UI/API).
- **Client User**
  - External user tied to a specific client entity.
  - Views invoices (and optionally summarized time) for their organization.

### 3.2 Roles (RBAC)

Roles are tenant-scoped (i.e., `(user, tenant, role)`):

- `employee`
- `project_manager`
- `finance`
- `org_admin`
- `client`

Permissions:

- `employee`: CRUD own draft timesheets, submit them.
- `project_manager`: view/approve/reject timesheets on projects they manage, view project progress.
- `finance`: view approved billable time, manage rates, create and manage invoices.
- `org_admin`: manage users/roles, tenant settings.
- `client`: view invoices (and allowed summaries) for their `client_id` within a tenant.

***

## 4. Functional Requirements

### 4.1 Timesheet Module

#### 4.1.1 Project Management

- Create/edit projects:
  - Fields: `name`, `description`, `client_id`, `start_date`, `end_date`, `expected_outcome`, `deadline_datetime`, `status` (active/archived).
- Assign users to projects with project-level roles (e.g., contributor, manager).
- Only `project_manager` and `org_admin` can create/update projects.

#### 4.1.2 Time Entry

- Employees can:
  - Select project (and optional task) from their assigned projects.
  - Enter `date`, `hours (decimal)`, `description`, `billable` flag.
  - Save as `draft` or `submit` for approval.
- Validation:
  - Hours per day per user cannot exceed configurable limit (e.g., 24).
  - Project must be active and assigned to user.
- Editing:
  - Draft entries: full edit/delete allowed by employee.
  - Submitted/approved:
    - Submitted: employee can retract back to draft if not yet reviewed.
    - Approved: read-only for employee.

#### 4.1.3 Timesheet Status & Workflow

- Statuses:
  - `draft`
  - `submitted`
  - `approved`
  - `rejected`
  - (optional) `locked` (post-billing or month-close).
- Workflow:
  - `draft` → `submitted` (by employee).
  - `submitted` → `approved` or `rejected` (by project_manager).
  - `approved` → `locked` (by finance/org_admin when billing or month closes).
- Each state transition recorded with `changed_by`, `changed_at`, and `reason` for rejections.

#### 4.1.4 Timesheet Views

- Employee views:
  - Daily and weekly views showing:
    - Projects, hours, status; filter by date range and project.
  - Summary: total hours per week, per project, and billable vs non-billable.
- Manager views:
  - Pending approvals list: filter by project, user, period.
  - Ability to approve/reject in bulk or individually.
- Org-level views:
  - Basic reporting: total hours by project/user/client/time range.

### 4.2 Billing Module

#### 4.2.1 Billing Rates

- Define billing rates with precedence:
  - Rate per project.
  - Rate per client.
  - Rate per role (e.g., Senior, Junior).
  - Default tenant-wide rate.
- Each rate: `org_id`, `client_id?`, `project_id?`, `role?`, `hourly_rate`, `currency`, `effective_from`, `effective_to`.
- `finance` and `org_admin` may create/edit rates.

#### 4.2.2 Invoice Generation from Timesheets

- Finance user can:
  - Select `client`, date range, and optional projects.
  - System fetches timesheet entries where:
    - `status = approved`
    - `billable = true`
    - `client_id = selected client`
    - Not yet invoiced (no `invoice_line_id` or `billing_exported_at`).
- Grouping modes:
  - By project.
  - By task.
  - By day (optional).
- For each group:
  - Resolve applicable rate according to precedence rules.
  - Compute quantity (hours), unit price, and line amount.
- Create invoice:
  - `invoices`: `invoice_number`, `org_id`, `client_id`, `issue_date`, `period_start`, `period_end`, `currency`, `status` (draft/sent/paid/void), `total_amount`, `notes`.
  - `invoice_lines`: `description`, `project_id`, `task_id?`, `hours`, `unit_price`, `amount`, reference to set of timesheet entries.
- Mark referenced timesheet entries as invoiced (link via `invoice_line_id` or a join table).

#### 4.2.3 Invoice Lifecycle

- Status transitions:
  - `draft` → `sent` (when shared with client).
  - `sent` → `paid` (manual update in V1).
  - `sent` → `void` (if invoice cancelled).
- Actions:
  - Edit draft invoices.
  - Generate PDF/HTML view from invoice data.
  - Resend invoice (by email or downloadable link).

#### 4.2.4 Internal Billing Views

- Finance dashboard:
  - Unbilled hours by client and project.
  - Draft invoices list.
  - Overdue invoices (sent but not marked paid after configurable term).
- Invoice list view:
  - Filter by client, status, date range.
- Invoice detail view:
  - Show header, lines, linked time entries, and audit trail.

### 4.3 Client Portal

- Authentication:
  - Client users authenticate via same OAuth system but with `client` role and `client_id` associated.
- Permissions:
  - Can only see invoices where `client_id = their client_id` and `org_id` matches.
- Views:
  - Invoice list:
    - Filter by status and date range.
  - Invoice detail:
    - Display basic line items and totals.
    - Download PDF/HTML.
- Optional (later):
  - Summarized time reports (e.g., hours by project and period) without exposing full internal descriptions.

### 4.4 Admin & RBAC Integration

- Reuse existing RBAC app to:
  - Assign roles (`employee`, `project_manager`, `finance`, `org_admin`, `client`) per tenant.
- Minimal additional UI:
  - Project membership management: assign users to projects with project-specific roles.
- APIs:
  - `/me` endpoint returning effective roles and org context.
  - Authorization middleware using RBAC policies for all Timesheet/Billing endpoints.

***

## 5. Data Model (Conceptual)

### 5.1 Core Entities

- `Organization`
- `User`
- `UserOrgRole` (existing)
- `Client`
- `Project`
- `Task` (optional but recommended for granularity)
- `TimesheetEntry`
- `BillingRate`
- `Invoice`
- `InvoiceLine`
- `ProjectMember` (linking user ↔ project with project-level role)

All entities have `org_id` for tenant scoping.

***

## 6. Non‑Functional Requirements

### 6.1 Performance and Scale

- Initially support up to:
  - 1000 users per tenant.
  - 100 tenants.
  - 100k timesheet entries/month.
- Typical latencies:
  - < 200 ms for common timesheet operations under normal load.
- Use Neon’s serverless autoscaling to handle traffic bursts without manual capacity planning. [neon](https://neon.com/docs/introduction/serverless)

### 6.2 Availability & Environments

- Environments:
  - `dev`, `staging`, `production` – each with separate Neon branches or projects.
- Neon provides instant database provisioning and branching, making it easy to spin up test branches and restore points. [learn.microsoft](https://learn.microsoft.com/en-us/azure/partner-solutions/neon/overview)
- Target availability for prod API: 99.5% (V1).

### 6.3 Security

- OAuth/OIDC for authentication (existing).
- RBAC enforced server-side for every operation; frontend role checks are advisory only.
- Tenant isolation:
  - All data queries filtered by `org_id`.
  - DB indexes on `(org_id, ...)` for timesheet and invoice queries.
- Audit logs:
  - Log key actions: login, role changes, project assignments, timesheet approvals, invoice generation and status changes.

### 6.4 Privacy & Compliance (Initial)

- Store minimum personal data necessary (names, emails).
- Ensure logs and backups are within chosen data region per Neon capabilities.
- (Later) Evaluate compliance requirements if exposed to external clients beyond controlled environments.

***

## 7. Technical Architecture

### 7.1 Backend

- Python 3.11.
- Web framework: FastAPI (or your existing framework).
- DB: Neon serverless Postgres (standard Postgres wire protocol; existing Python Postgres drivers supported). [github](https://github.com/neondatabase/neon)
- Auth:
  - Existing OAuth/OIDC and RBAC service as a shared module or separate service.
  - Backend middleware validates JWT and resolves `user_id`, `org_id`, roles.

### 7.2 Frontend

- React app with modular structure:
  - `auth`, `timesheets`, `projects`, `billing`, `clients`.
- Use React Query or equivalent for data fetching and caching.
- Role-aware navigation; hide features not available to current user.

### 7.3 Deployment & DevOps

- Local:
  - React dev server + Python API + Neon (remote) or local Postgres.
- Cloud:
  - Containerized Python backend.
  - React static assets on CDN/host.
  - Neon as managed serverless Postgres with appropriate branching (e.g., preview branches per feature if desired). [neon](https://neon.com/docs/introduction)

***

## 8. Dependencies and Assumptions

- Existing GitHub repo `vinodvv2023/RBAC` provides:
  - OAuth/OIDC integration.
  - Role and permission model.
  - Basic admin UI for roles.
- Neon account available with:
  - At least one project for dev and one for prod.
  - Connection strings per environment.

Assumptions:

- Single-tenant per user session (user chooses org if they belong to multiple).
- Invoice delivery (email) uses an existing or later-configured email service.

***

## 9. Release Plan / Milestones

### Milestone 1 – Timesheet MVP

- Core entities: `Organization`, `Project`, `TimesheetEntry`, `ProjectMember`.
- Employee flows: create/edit `draft`, submit.
- Manager flows: approve/reject.
- Basic reporting: hours by user/project/date range.
- Backend + React screens wired to Neon DB.

### Milestone 2 – Billing MVP

- Entities: `Client`, `BillingRate`, `Invoice`, `InvoiceLine`.
- Billing rate management.
- Invoice generation from approved billable time.
- Internal invoice list/detail UI.

### Milestone 3 – Client Portal

- `client` role and onboarding flow.
- Client invoice list/detail pages.
- Hardened access checks per `client_id`.

### Milestone 4 – Hardening & Enhancements

- Comprehensive audit logging.
- Performance tuning and DB indexing.
- Advanced reports (unbilled hours, utilization).
- Optional: Neon branching workflows for per-feature preview environments. [neon](https://neon.com/docs/introduction/serverless)

***

Great, let’s evolve this into a PRD with explicit **epics, user stories, and acceptance criteria** you can drop straight into issues / tickets.

I’ll build on what we already defined; I won’t repeat the whole PRD, just add the “implementation-facing” layer.

***

## 1. Epics

1. Timesheet Core
2. Timesheet Approval & Progress Tracking
3. Billing & Rates
4. Invoice Generation & Lifecycle
5. Client Portal
6. Admin & RBAC Integration
7. Neon DB & Environments

User stories follow the classic `As a [persona], I want [goal], so that [benefit]` pattern. [atlassian](https://www.atlassian.com/agile/project-management/user-stories)

***

## 2. Epic: Timesheet Core

### Story TS-1 – Create and manage projects

**As a** project manager  
**I want** to create and update projects with client, expected outcome, and deadline  
**So that** the team has clear scope and timelines.

**Acceptance Criteria**

- Given I have `project_manager` or `org_admin` role, when I open the “New Project” form:
  - I can enter: name, description, client, start date, end date, expected outcome, deadline date and time, and status.
- On save:
  - The project is stored with `org_id` = my current tenant.
  - Only users assigned to this project (via `ProjectMember`) see it in their project list.
- When a project is archived:
  - It is no longer selectable in new time entries.
  - Existing time entries remain visible and linked.

***

### Story TS-2 – Log time to a project

**As an** employee  
**I want** to log time against projects I’m assigned to  
**So that** my work is tracked for progress and billing.

**Acceptance Criteria**

- Given I have `employee` role, when I open the timesheet screen:
  - I see a list of projects I’m assigned to.
- For a given date:
  - I can create a time entry with: project, optional task, date, hours (decimal), description, billable (yes/no).
- Validation:
  - Hours for a single day cannot exceed a configured max (config parameter).
  - I cannot select a project I’m not assigned to, or that’s archived.
- On save:
  - Entry is created as `status = draft`, `org_id = my org`, `user_id = me`.

***

### Story TS-3 – Edit and delete draft time entries

**As an** employee  
**I want** to edit or delete my draft time entries  
**So that** I can correct mistakes before submission.

**Acceptance Criteria**

- Draft entries:
  - I can change any field (project, hours, description, billable, date).
  - I can delete a draft entry entirely.
- Submitted or approved entries:
  - I cannot edit or delete them (except through dedicated flows defined below).
- All operations are scoped to my own entries and current tenant.

***

### Story TS-4 – Weekly timesheet view

**As an** employee  
**I want** a weekly view of my time entries  
**So that** I can see and adjust my week at a glance.

**Acceptance Criteria**

- When I select a week:
  - I see each day as a column and my entries as rows grouped by project.
  - Totals per day and per project are displayed.
- I can:
  - Add a new entry from the weekly view.
  - Click an entry to edit it (if `draft`).
- Performance:
  - Weekly view loads within acceptable latency for up to N entries (e.g., 200 entries) for that week.

***

## 3. Epic: Timesheet Approval & Progress Tracking

### Story TA-1 – Submit timesheet for approval

**As an** employee  
**I want** to submit my timesheet for a period  
**So that** my manager can approve it.

**Acceptance Criteria**

- From the weekly view:
  - I can press “Submit week” which:
    - Sets all `draft` entries in that week to `submitted`.
- After submission:
  - I can no longer modify those entries unless the manager rejects them or I explicitly “retract” if allowed.

***

### Story TA-2 – Manager approval queue

**As a** project manager  
**I want** to see all submitted time for my projects  
**So that** I can approve or reject it.

**Acceptance Criteria**

- Given I have `project_manager` role:
  - I can open an “Approvals” screen.
- Filter options:
  - By project, by employee, by week/date range.
- For each submitted entry:
  - I see: employee, project, date, hours, description, billable flag, status.
- Actions:
  - Approve selected entries → `status = approved`, `approved_by`, `approved_at` set.
  - Reject selected entries → `status = rejected`, with optional rejection note.
- Rejected entries:
  - Reappear as editable for the employee.
  - Show rejection reason in employee view.

***

### Story TA-3 – Project progress vs expectations

**As a** project manager  
**I want** to see logged hours and status against expected outcome and deadline  
**So that** I can track progress and risks.

**Acceptance Criteria**

- Project detail view:
  - Shows expected outcome and deadline.
  - Shows total hours logged by team, broken down by billable/non-billable.
  - Highlights if current date is approaching/past deadline with significant remaining work (simple heuristics in V1).
- Data is read-only and derived from timesheet entries and project metadata.

***

## 4. Epic: Billing & Rates

### Story BR-1 – Configure billing rates

**As a** finance user  
**I want** to configure hourly rates per client, project, and role  
**So that** invoices reflect agreed pricing.

**Acceptance Criteria**

- Given I have `finance` or `org_admin` role:
  - I can create rate entries specifying combination of: client, project, role (any may be null), hourly_rate, currency, effective_from, effective_to.
- Rate resolution:
  - Given a timesheet entry with `client`, `project`, `user role`:
    - System picks the most specific matching rate (project > client > role > default).
- I can:
  - Edit and deactivate rates (by setting `effective_to`).
  - View historical and active rates per client/project.

***

## 5. Epic: Invoice Generation & Lifecycle

### Story IN-1 – Generate invoice from approved time

**As a** finance user  
**I want** to generate an invoice from approved, billable time  
**So that** I can bill clients accurately and quickly.

**Acceptance Criteria**

- Given I have `finance` role:
  - I can choose a client and date range, and optional projects.
- System fetches:
  - Timesheet entries where:
    - `status = approved`
    - `billable = true`
    - `client_id = selected client`
    - Not already associated with an invoice.
- I can choose grouping mode:
  - By project (default), or by task (if tasks exist).
- For each group:
  - System calculates hours sum and resolves hourly rate.
  - Creates invoice lines with description, hours, unit price, and amount.
- On confirm:
  - An `invoice` record is created with `status = draft`.
  - Lines are stored.
  - Timesheet entries are marked with reference to invoice line (or export marker).

***

### Story IN-2 – Edit and finalize draft invoices

**As a** finance user  
**I want** to adjust draft invoices  
**So that** I can correct descriptions, prices, or add manual lines.

**Acceptance Criteria**

- For `status = draft` invoices:
  - I can edit header fields: client, dates, notes.
  - I can edit line descriptions, hours, unit price.
  - I can add new manual lines not tied to time entries (e.g., expenses).
  - I can remove a line:
    - If linked to time entries, those entries become “un-invoiced” again.
- Upon setting status to `sent`:
  - Invoice becomes read-only except for payment-related fields (e.g., `paid_at`).

***

### Story IN-3 – Invoice list and detail for internal users

**As a** finance user  
**I want** to browse invoices by client and status  
**So that** I can track billing and follow up.

**Acceptance Criteria**

- List view:
  - Filters: client, status, date range.
  - Columns: invoice number, client, issue date, period, status, total amount.
- Detail view:
  - Shows header, lines, linked timesheet entry references, and audit trail.
- Only users with `finance` or `org_admin` roles can access invoices UI/API.

***

## 6. Epic: Client Portal

### Story CP-1 – Client login and scoping

**As a** client user  
**I want** to log in and see only my organization’s invoices  
**So that** my data is secure and separated.

**Acceptance Criteria**

- Client users authenticate via existing OAuth path but have `client` role and `client_id` field.
- After login:
  - Backend resolves `org_id` + `client_id` from token/DB.
- Any client portal API (e.g., `/client/invoices`) must:
  - Filter by `org_id` and `client_id`.
  - Return 403 if user lacks `client` role or tries to access another client’s invoice.

***

### Story CP-2 – Client invoice list and detail

**As a** client user  
**I want** to view my invoices and download them  
**So that** I can manage payments and records.

**Acceptance Criteria**

- Invoice list:
  - Filters: status, date range.
  - Shows: invoice number, issue date, due/term, total, status.
- Detail view:
  - Shows header, line items (aggregated enough to be client-friendly), total.
- Download:
  - I can download PDF/HTML representation of the invoice.
- No internal-only fields (internal notes, internal time entry IDs) appear in client views.

***

## 7. Epic: Admin & RBAC Integration

### Story AD-1 – Use existing RBAC for roles and permissions

**As an** org admin  
**I want** to manage user roles via the existing RBAC system  
**So that** I have one place to control access.

**Acceptance Criteria**

- Timesheet/Billing services:
  - Use existing RBAC DB / APIs to resolve role assignments for `(user, org)`.
- For each API endpoint:
  - Required roles are defined (e.g., `employee`, `project_manager`, `finance`, `client`, `org_admin`).
  - Middleware checks roles and tenant before entering handler.
- No separate role management UI is created in Timesheet/Billing; it relies on existing RBAC admin capabilities.

***

## 8. Epic: Neon DB & Environments

### Story DB-1 – Use Neon as primary DB

**As a** developer  
**I want** to use Neon serverless Postgres  
**So that** I get autoscaling, branching, and simple environment management.

**Acceptance Criteria**

- Application config:
  - Uses Neon Postgres connection URLs for `dev`, `staging`, and `prod` environments.
- Migrations:
  - Schema migrations run successfully against Neon (CI/CD pipeline or manual).
- DB design:
  - All core tables include `org_id` for tenant scoping.
  - Indexes added for key patterns (e.g., `timesheet_entries (org_id, project_id, date, status)`, `invoices (org_id, client_id, status)`).
- Optionally:
  - Feature branches can be mapped to Neon database branches for isolated testing. [neon](https://neon.com/docs/introduction/serverless)

***

This gives you a PRD-level breakdown that’s ready to turn into Jira issues / GitHub issues:

- Epics = Jira Epics.
- Each story = Jira Story with acceptance criteria.
- Technical tasks (e.g., “Implement FastAPI route X” or “Add Postgres migration Y”) can be derived straight from these.

