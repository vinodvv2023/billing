-- Consolidated migration for recent RBAC/Audit changes
-- Apply on Postgres. Safe to run multiple times (idempotent where possible).

BEGIN;

-- 1) Ensure audit_logs table exists with richer context
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    action      VARCHAR NOT NULL,
    actor_id    INTEGER NULL,
    target_type VARCHAR NOT NULL,
    target_id   INTEGER NOT NULL,
    provider    VARCHAR NULL,
    email       VARCHAR NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Relax actor FK to allow deleting users while keeping logs
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE audit_logs ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3) Ensure provider/email columns exist (older tables may be missing them)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS provider VARCHAR;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS email VARCHAR;

-- 4) Add projects.created_by to track ownership
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE projects
  ADD CONSTRAINT projects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id);

-- 5) Invite tokens for magic links
CREATE TABLE IF NOT EXISTS invite_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) Membership tables (owner + future collaborators)
CREATE TABLE IF NOT EXISTS organization_members (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR NULL
);

CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR NULL
);

-- 7) (Optional) If organizations.created_by was added earlier, keep as-is.
-- Nothing to do here unless your env missed it; included for reference:
-- ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by INTEGER;
-- ALTER TABLE organizations ADD CONSTRAINT IF NOT EXISTS organizations_created_by_fkey
--   FOREIGN KEY (created_by) REFERENCES users(id);

COMMIT;

-- Run notes:
--   psql -f 2026-03-25_consolidated.sql
--   Restart the FastAPI app so SQLAlchemy metadata matches DB schema.
