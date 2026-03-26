# OAuth RBAC Frontend Modernization Plan

## Summary
- Modernize the Next.js auth UI to Linear/Stripe-level quality while preserving existing FastAPI auth (local + OAuth) and adding RBAC surfaces for the six roles defined in `docs/rbac_requirement.md`.
- Introduce a small design system (tokens + primitives) for consistency, responsiveness, accessibility, and performance.
- Add role-aware app shell with flows for organizations, projects, users, and access-matrix visualization; keep backend APIs untouched and configurable via env.

## Architecture & System Design
- **Design system**: CSS variables + Tailwind tokens for color, spacing, typography, radii, shadows, motion. Primitives in `frontend/src/ui` (`Button`, `Input`, `Select`, `Badge`, `Card`, `Tabs`, `Dialog`, `Toast`, `Skeleton`, `DataTable`).
- **Layout**: `AppShell` (topbar, sidebar, workspace switcher), `PageHeader`, `EmptyState`, `ErrorBoundary`, `LoadingOverlay`.
- **Auth**: `AuthProvider` + `useSession` + `SecureRoute`; token storage via pluggable strategy (default: localStorage; prod-ready: HttpOnly cookie handshake). `/signin` for login/register/OAuth, `/oauth/callback` with toast + redirect, `/logout` route to clear session.
- **RBAC domain**: shared models (`Organization` with type: agency/company, `Project`, `User`, `Membership` with role enums, `Invitation`). Hooks `usePermissions`, guards `RequireRole/Permission`.
- **Data layer**: TanStack Query + Zod schema validation; API clients per resource (`auth`, `organizations`, `projects`, `users`, `invites`, `rbac/policies`). API base URL from `NEXT_PUBLIC_API_URL`.
- **Routing (App Router)**: `/dashboard`, `/organizations`, `/projects`, `/users`, `/access-matrix`, `/settings/profile`, `/settings/security`; landing `/` remains marketing/login CTA.

## UI/UX Workstreams
- **Auth screens**: inline validation, password strength hints, rate-limit messages, skeleton states, OAuth provider grid, magic-link placeholder, and error toasts instead of `alert`.
- **Callback UX**: branded “Finishing sign-in…” screen with retry, telemetry, and automatic redirect.
- **Role-centric shell**: workspace badge (Agency/Company), quick filters by role, contextual empty/error states, invite flows, assignment chips, bulk actions in tables.
- **Access Matrix**: visual grid for the six roles vs capabilities (create company/project/user, assign, archive) derived from `rbac_requirement.md`.
- **Accessibility**: semantic landmarks, focus outlines, aria labels/descriptions, reduced-motion fallback, high-contrast friendly palette, skip-to-content.
- **Performance**: suspense boundaries, lazy-load heavy tables, static SVG icons, memoized lists, `prefetch` for primary routes.
- **SEO/AEO**: per-page metadata, structured FAQ for auth/RBAC, descriptive copy blocks for answer engines.

## Data & Security Considerations
- Do not change backend auth or APIs; only consume them. Keep `.env_example.txt` updated with `NEXT_PUBLIC_API_URL` and optional `COOKIE_MODE=true`.
- Token handling abstraction to switch between localStorage and HttpOnly cookie mode; add CSRF token header when cookie mode enabled.
- Preserve OAuth provider list; surface friendly provider labels/icons; handle missing email (e.g., Twitter) by synthesizing fallback as currently done.

## Incremental Delivery Plan
1) **Foundation**: add tokens/primitives, global styles, metadata config, env-based API client.
2) **Auth overhaul**: new `/signin`, `AuthProvider`, callback screen, toast system.
3) **Shell & navigation**: `AppShell`, sidebar/topbar, workspace switcher, placeholders for main routes.
4) **RBAC surfaces**: organizations/projects/users list + CRUD UI wired to existing/placeholder endpoints; permission guards; access-matrix view.
5) **States & polish**: loading/empty/error/skeletons, keyboard navigation, reduced-motion, responsive tuning, AEO content.
6) **Hardening**: e2e smoke (Playwright) for auth/guards, lint/accessibility pass (axe), perf budget checks.

## Testing Plan (frontend)
- Unit: primitive components, hooks (`useSession`, `usePermissions`).
- Integration: auth flows (login/register, OAuth redirect handling), guard routing, data table filters.
- E2E (Playwright): sign-in (local + mocked OAuth), protected route access per role, invite/assign flows, access-matrix visibility.
- Accessibility: axe + keyboard traps, focus order; visual regression on key pages.

## Assumptions
- Backend endpoints for RBAC entities will be added or proxied; schema alignment will follow the role rules in `rbac_requirement.md`.
- Multi-tenancy is single-database with org scoping (adjust if per-tenant DB is required).
- Using existing `.venv`; Node/Tailwind stack already installed in `frontend`.
