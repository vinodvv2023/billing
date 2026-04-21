"use client";

export type PortalMode = "client" | "employee" | "finance" | "manager" | "admin";

const ADMIN_ROLE_SET = ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin", "org_admin"];

export function resolvePortalModeForRole(role: string | null | undefined, isAdmin = false): PortalMode {
  if (role === "client") return "client";
  if (role === "employee") return "employee";
  if (role === "finance") return "finance";
  if (role === "project_manager") return "manager";
  if (isAdmin || (role ? ADMIN_ROLE_SET.includes(role) : false)) return "admin";
  return "employee";
}

export function defaultRouteForPortalMode(portalMode: PortalMode) {
  switch (portalMode) {
    case "client":
      return "/billing";
    case "employee":
      return "/timesheets";
    case "finance":
      return "/billing";
    case "manager":
      return "/timesheets";
    case "admin":
    default:
      return "/dashboard";
  }
}

export function defaultRouteForRoles(roles: string[] | null | undefined) {
  const primaryRole = roles?.[0] ?? null;
  return defaultRouteForPortalMode(resolvePortalModeForRole(primaryRole));
}

export function isAdminRole(role: string | null | undefined) {
  return role ? ADMIN_ROLE_SET.includes(role) : false;
}
