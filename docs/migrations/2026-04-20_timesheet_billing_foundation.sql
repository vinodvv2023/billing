BEGIN;

-- Bootstrap legacy OAuth/RBAC schema so this migration works on a fresh database too.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  hashed_password VARCHAR NULL,
  full_name VARCHAR NULL,
  role VARCHAR NOT NULL DEFAULT 'user'
);
CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id SERIAL PRIMARY KEY,
  oauth_name VARCHAR NOT NULL,
  account_id VARCHAR NOT NULL,
  account_email VARCHAR NOT NULL,
  user_id INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_oauth_accounts_id ON oauth_accounts (id);
CREATE INDEX IF NOT EXISTS ix_oauth_accounts_oauth_name ON oauth_accounts (oauth_name);
CREATE INDEX IF NOT EXISTS ix_oauth_accounts_account_id ON oauth_accounts (account_id);

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  type VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'Active',
  created_by INTEGER NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_organizations_id ON organizations (id);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'Active',
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  created_by INTEGER NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_projects_id ON projects (id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR NOT NULL,
  actor_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR NOT NULL,
  target_id INTEGER NOT NULL,
  provider VARCHAR NULL,
  email VARCHAR NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_id ON audit_logs (id);

CREATE TABLE IF NOT EXISTS invite_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_invite_tokens_id ON invite_tokens (id);
CREATE INDEX IF NOT EXISTS ix_invite_tokens_token ON invite_tokens (token);

CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR NULL
);
CREATE INDEX IF NOT EXISTS ix_organization_members_id ON organization_members (id);

CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR NULL
);
CREATE INDEX IF NOT EXISTS ix_project_members_id ON project_members (id);

-- Phase 1: harden current RBAC tables for tenant-scoped business modules
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS client_id INTEGER NULL;
UPDATE organization_members
SET role = COALESCE(NULLIF(role, ''), 'member')
WHERE role IS NULL OR role = '';
ALTER TABLE organization_members
  ALTER COLUMN role SET NOT NULL;
ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS uq_organization_members_org_user;
ALTER TABLE organization_members
  ADD CONSTRAINT uq_organization_members_org_user UNIQUE (organization_id, user_id);

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE project_members
SET role = COALESCE(NULLIF(role, ''), 'contributor')
WHERE role IS NULL OR role = '';
ALTER TABLE project_members
  ALTER COLUMN role SET NOT NULL;
ALTER TABLE project_members
  DROP CONSTRAINT IF EXISTS uq_project_members_project_user;
ALTER TABLE project_members
  ADD CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id);

-- Phase 2: tenant business entities
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  contact_name VARCHAR NULL,
  contact_email VARCHAR NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_clients_org_name UNIQUE (org_id, name)
);

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_client_id_fkey;
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS ck_organization_members_client_requires_client_id;
ALTER TABLE organization_members
  ADD CONSTRAINT ck_organization_members_client_requires_client_id
  CHECK ((role <> 'client') OR (client_id IS NOT NULL));

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_id INTEGER NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date DATE NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS end_date DATE NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS expected_outcome TEXT NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deadline_datetime TIMESTAMPTZ NULL;
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_client_id_fkey;
ALTER TABLE projects
  ADD CONSTRAINT projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tasks_project_name UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  task_id INTEGER NULL REFERENCES tasks(id) ON DELETE SET NULL,
  client_id INTEGER NULL REFERENCES clients(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  hours NUMERIC(8, 2) NOT NULL,
  description TEXT NULL,
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ NULL,
  submitted_by INTEGER NULL REFERENCES users(id),
  approved_at TIMESTAMPTZ NULL,
  approved_by INTEGER NULL REFERENCES users(id),
  rejected_at TIMESTAMPTZ NULL,
  rejected_by INTEGER NULL REFERENCES users(id),
  rejection_reason TEXT NULL,
  locked_at TIMESTAMPTZ NULL,
  locked_by INTEGER NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_timesheet_entries_positive_hours CHECK (hours > 0)
);

CREATE TABLE IF NOT EXISTS timesheet_status_history (
  id SERIAL PRIMARY KEY,
  timesheet_entry_id INTEGER NOT NULL REFERENCES timesheet_entries(id) ON DELETE CASCADE,
  from_status VARCHAR NULL,
  to_status VARCHAR NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_timesheet_entries_org_user_entry_date
  ON timesheet_entries (org_id, user_id, entry_date);
CREATE INDEX IF NOT EXISTS ix_timesheet_entries_org_project_entry_date
  ON timesheet_entries (org_id, project_id, entry_date);
CREATE INDEX IF NOT EXISTS ix_timesheet_entries_org_status_billable
  ON timesheet_entries (org_id, status, billable);

-- Phase 3: billing
CREATE TABLE IF NOT EXISTS billing_rates (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id INTEGER NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id INTEGER NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR NULL,
  hourly_rate NUMERIC(10, 2) NOT NULL,
  currency VARCHAR NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number VARCHAR NOT NULL,
  issue_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency VARCHAR NOT NULL DEFAULT 'USD',
  status VARCHAR NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  voided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoices_org_invoice_number UNIQUE (org_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id INTEGER NULL REFERENCES projects(id) ON DELETE SET NULL,
  task_id INTEGER NULL REFERENCES tasks(id) ON DELETE SET NULL,
  line_type VARCHAR NOT NULL DEFAULT 'time',
  description TEXT NOT NULL,
  hours NUMERIC(10, 2) NULL,
  unit_price NUMERIC(10, 2) NULL,
  amount NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_line_timesheet_entries (
  id SERIAL PRIMARY KEY,
  invoice_line_id INTEGER NOT NULL REFERENCES invoice_lines(id) ON DELETE CASCADE,
  timesheet_entry_id INTEGER NOT NULL REFERENCES timesheet_entries(id) ON DELETE CASCADE,
  CONSTRAINT uq_invoice_line_timesheet_link UNIQUE (invoice_line_id, timesheet_entry_id),
  CONSTRAINT uq_invoice_line_timesheet_entry_once UNIQUE (timesheet_entry_id)
);

CREATE INDEX IF NOT EXISTS ix_billing_rates_lookup
  ON billing_rates (org_id, client_id, project_id, role, effective_from);
CREATE INDEX IF NOT EXISTS ix_invoices_org_client_status_issue_date
  ON invoices (org_id, client_id, status, issue_date);
CREATE INDEX IF NOT EXISTS ix_invoice_lines_invoice_id
  ON invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_line_timesheet_entries_timesheet_entry_id
  ON invoice_line_timesheet_entries (timesheet_entry_id);
CREATE INDEX IF NOT EXISTS ix_invoice_line_timesheet_entries_invoice_line_id
  ON invoice_line_timesheet_entries (invoice_line_id);

COMMIT;
