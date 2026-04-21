"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ClipboardList,
  FolderKanban,
  Grid,
  Home,
  LogOut,
  Settings,
  Share2,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import { useMe } from "@/lib/me";
import { PortalMode, defaultRouteForPortalMode, resolvePortalModeForRole } from "@/lib/role-routing";
import { useSession } from "@/lib/session";
import { useTenantScope } from "@/lib/tenant-scope";
import { Badge } from "./badge";
import { Button } from "./button";
import { Combobox } from "./combobox";
import { cn } from "./utils";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
  { href: "/clients", label: "Clients", icon: <BriefcaseBusiness className="h-4 w-4" /> },
  { href: "/timesheets", label: "Timesheets", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/billing", label: "Billing", icon: <CircleDollarSign className="h-4 w-4" /> },
  { href: "/organizations", label: "Organizations", icon: <Building2 className="h-4 w-4" /> },
  { href: "/projects", label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
  { href: "/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/settings/security", label: "Security", icon: <Shield className="h-4 w-4" /> },
];

const settingsItems: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: <Settings className="h-4 w-4" /> },
];

const pageMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/dashboard": {
    eyebrow: "Revenue operations",
    title: "Finance Command",
    description: "Track client delivery, pending approvals, and invoice readiness from one operating surface.",
  },
  "/clients": {
    eyebrow: "Accounts",
    title: "Clients",
    description: "Maintain client records, owners, and delivery relationships across the active workspace.",
  },
  "/timesheets": {
    eyebrow: "Execution",
    title: "Timesheets",
    description: "Log work, review submissions, and keep billable hours moving toward invoiceable state.",
  },
  "/billing": {
    eyebrow: "Revenue",
    title: "Billing",
    description: "Set rates, monitor unbilled work, and convert approved time into draft invoices.",
  },
  "/organizations": {
    eyebrow: "Structure",
    title: "Organizations",
    description: "Manage workspaces, ownership, and account boundaries without losing tenant clarity.",
  },
  "/projects": {
    eyebrow: "Delivery",
    title: "Projects",
    description: "Track delivery scopes, project ownership, and the client relationships attached to each effort.",
  },
  "/users": {
    eyebrow: "Identity",
    title: "Users",
    description: "Review member access, invitations, and who can touch client or finance-sensitive workflows.",
  },
  "/settings/security": {
    eyebrow: "Policy",
    title: "Security",
    description: "Adjust security controls and keep authentication policy aligned with your operating model.",
  },
  "/settings/profile": {
    eyebrow: "Preferences",
    title: "Profile",
    description: "Update your personal account context and working preferences.",
  },
  "/audit": {
    eyebrow: "Governance",
    title: "Audit",
    description: "Inspect permission changes and sensitive events with a full trace of recent activity.",
  },
  "/assignments": {
    eyebrow: "Operations",
    title: "Assignments",
    description: "Delegate access intentionally and keep role boundaries clear across organizations.",
  },
  "/access-matrix": {
    eyebrow: "Visibility",
    title: "Access Matrix",
    description: "Understand role coverage at a glance and spot gaps before they become support work.",
  },
};

const portalRoutePrefixes: Record<PortalMode, string[]> = {
  client: ["/dashboard", "/billing", "/settings/profile"],
  employee: ["/dashboard", "/timesheets", "/settings/profile"],
  finance: ["/dashboard", "/billing", "/clients", "/settings/profile"],
  manager: ["/dashboard", "/timesheets", "/projects", "/settings/profile"],
  admin: ["/dashboard", "/clients", "/timesheets", "/billing", "/organizations", "/projects", "/users", "/settings/security", "/settings/profile", "/audit", "/assignments", "/access-matrix"],
};

function getRoleNavigation(portalMode: PortalMode, includeAudit: boolean, includeAssignments: boolean) {
  switch (portalMode) {
    case "client":
      return [
        { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
        { href: "/billing", label: "Invoices", icon: <CircleDollarSign className="h-4 w-4" /> },
      ];
    case "employee":
      return [
        { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
        { href: "/timesheets", label: "Timesheets", icon: <ClipboardList className="h-4 w-4" /> },
      ];
    case "finance":
      return [
        { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
        { href: "/billing", label: "Billing", icon: <CircleDollarSign className="h-4 w-4" /> },
        { href: "/clients", label: "Clients", icon: <BriefcaseBusiness className="h-4 w-4" /> },
      ];
    case "manager":
      return [
        { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
        { href: "/timesheets", label: "Timesheets", icon: <ClipboardList className="h-4 w-4" /> },
        { href: "/projects", label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
      ];
    case "admin":
    default:
      return navItems
        .concat(includeAudit ? [{ href: "/audit", label: "Audit", icon: <Activity className="h-4 w-4" /> }] : [])
        .concat(includeAssignments ? [{ href: "/assignments", label: "Assignments", icon: <Share2 className="h-4 w-4" /> }] : [])
        .concat([{ href: "/access-matrix", label: "Access Matrix", icon: <Grid className="h-4 w-4" /> }]);
  }
}

function getPageMeta(pathname: string, portalMode: PortalMode) {
  if (pathname.startsWith("/dashboard")) {
    if (portalMode === "employee") {
      return {
        eyebrow: "Personal workload",
        title: "My Work",
        description: "Focus on logging time, tracking submissions, and keeping your delivery week current.",
      };
    }
    if (portalMode === "finance") {
      return {
        eyebrow: "Revenue desk",
        title: "Billing Command",
        description: "Watch approved work, active rate cards, and invoice status without delivery or admin noise.",
      };
    }
    if (portalMode === "manager") {
      return {
        eyebrow: "Delivery oversight",
        title: "Approval Desk",
        description: "Review submitted work, clear bottlenecks, and keep managed projects moving.",
      };
    }
    if (portalMode === "client") {
      return {
        eyebrow: "Client portal",
        title: "Invoice Visibility",
        description: "Review sent invoices and payment history in a restricted client-safe workspace.",
      };
    }
  }

  const matchedKey =
    Object.keys(pageMeta)
      .sort((a, b) => b.length - a.length)
      .find((key) => pathname.startsWith(key)) ?? "/dashboard";

  return pageMeta[matchedKey];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, roles } = useSession();
  const me = useMe();
  const { organizations, activeOrganizationId, setActiveOrganizationId, effectiveRole, isAdmin } = useTenantScope();
  const hasSuperAdminRole = roles.includes("Super Admin");
  const hasGlobalAdminRole = roles.some((role) =>
    ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"].includes(role)
  );
  const portalMode = resolvePortalModeForRole(effectiveRole, isAdmin);

  const organizationOptions = organizations.map((organization) => ({
    label: organization.name,
    value: String(organization.id),
  }));

  const navigation = getRoleNavigation(portalMode, hasSuperAdminRole, hasGlobalAdminRole || isAdmin);
  const allowedPrefixes = portalRoutePrefixes[portalMode];
  const defaultRoute = defaultRouteForPortalMode(portalMode);

  React.useEffect(() => {
    const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
    if (!isAllowed) {
      router.replace(defaultRoute);
    }
  }, [allowedPrefixes, defaultRoute, pathname, router]);

  const currentMeta = getPageMeta(pathname, portalMode);
  const activeOrganizationLabel =
    organizations.find((organization) => organization.id === activeOrganizationId)?.name ?? "Global scope";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-14rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-amber-400/12 blur-[140px]" />
        <div className="absolute right-[-16rem] top-[8rem] h-[34rem] w-[34rem] rounded-full bg-sky-400/10 blur-[160px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:px-6 lg:py-6">
        <aside className="hidden lg:flex lg:w-[300px] lg:shrink-0">
          <div className="sticky top-6 flex h-[calc(100vh-3rem)] w-full flex-col rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
            <div className="rounded-[22px] border border-amber-400/15 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.03))] p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="outline" className="border-amber-400/35 bg-amber-500/10 text-amber-100">
                  Amber
                </Badge>
                <span className="text-xs uppercase tracking-[0.24em] text-white/35">RBAC</span>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">Workspace console</p>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
                  {portalMode === "client"
                    ? "Client billing portal"
                    : portalMode === "employee"
                      ? "Personal delivery desk"
                      : portalMode === "finance"
                        ? "Finance workspace"
                        : portalMode === "manager"
                          ? "Project approval desk"
                          : "Operations control"}
                </h2>
                <p className="text-sm leading-6 text-white/62">
                  {portalMode === "client"
                    ? "A read-only client surface for invoice history, invoice detail, and account visibility."
                    : portalMode === "employee"
                      ? "A focused place to log time, monitor submissions, and stay current on assigned delivery work."
                      : portalMode === "finance"
                        ? "A revenue-focused surface for rates, invoices, and client billing readiness."
                        : portalMode === "manager"
                          ? "A scoped delivery surface for reviewing submissions and monitoring managed projects."
                          : "A shared control surface for clients, time capture, invoicing, and tenant administration."}
                </p>
              </div>
            </div>

            <nav className="mt-6 space-y-1.5">
              {navigation.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-[16px] border px-3.5 py-3 text-sm font-semibold",
                      active
                        ? "border-amber-400/30 bg-amber-500/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "border-transparent text-white/60 hover:border-white/8 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </span>
                    {active && <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-white/8 pt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/34">Settings</div>
              <div className="space-y-1.5">
                {settingsItems.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-[16px] border px-3.5 py-3 text-sm font-semibold",
                        active
                          ? "border-white/12 bg-white/[0.06] text-white"
                          : "border-transparent text-white/60 hover:border-white/8 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto rounded-[20px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Current scope</p>
              <div className="mt-3 text-sm font-semibold text-white">{activeOrganizationLabel}</div>
              <div className="mt-1 text-sm text-white/55">{effectiveRole}</div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-5 py-5 shadow-[var(--shadow-md)] backdrop-blur-xl lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="outline" className="border-white/12 bg-white/[0.04] text-white/78">
                    {currentMeta.eyebrow}
                  </Badge>
                  <Badge tone="outline" className="border-amber-400/30 bg-amber-500/10 text-amber-100">
                    {activeOrganizationLabel}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                    {currentMeta.title}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-white/62 sm:text-[15px]">
                    {currentMeta.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
                {organizations.length > 0 && (
                  <Combobox
                    label="Organization"
                    value={activeOrganizationId != null ? String(activeOrganizationId) : ""}
                    options={organizationOptions}
                    placeholder="Select organization"
                    searchPlaceholder="Search organization"
                    emptyText="No organizations found"
                    onChange={(nextValue) => setActiveOrganizationId(Number(nextValue) || null)}
                  />
                )}
                <Button variant="ghost" size="sm" onClick={logout} leftIcon={<LogOut className="h-4 w-4" />}>
                  Logout
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/8 pt-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                <Badge tone="outline" className="flex items-center gap-1 border-white/12 bg-white/[0.04]">
                  <UserCircle className="h-4 w-4" />
                  {me.email || "Unknown user"}
                </Badge>
                {(me.roles?.length || 0) === 0 ? (
                  <Badge tone="outline">No roles in token</Badge>
                ) : (
                  <>
                    {me.roles.map((role) => (
                      <Badge key={role} tone="outline" className="border-white/12 bg-white/[0.03]">
                        {role}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
              <div className="text-sm text-white/48">
                Active role <span className="font-medium text-white/80">{effectiveRole}</span>
              </div>
            </div>
          </header>

          <nav className="overflow-x-auto rounded-[20px] border border-white/8 bg-white/[0.03] p-2 shadow-[var(--shadow-sm)] backdrop-blur lg:hidden">
            <div className="flex min-w-max gap-2">
              {navigation.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-semibold",
                      active ? "bg-amber-500/12 text-white" : "text-white/60"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <main className="min-w-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-5 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
