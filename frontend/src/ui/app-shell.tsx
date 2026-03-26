"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./utils";
import { Button } from "./button";
import { Badge } from "./badge";
import { Shield, Grid, Building2, FolderKanban, Users, Settings, Home, LogOut, UserCircle, Activity, Share2 } from "lucide-react";
import { useSession } from "@/lib/session";
import { useMe } from "@/lib/me";
import { useTenantScope } from "@/lib/tenant-scope";
import { Combobox } from "@/ui/combobox";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
  { href: "/organizations", label: "Organizations", icon: <Building2 className="h-4 w-4" /> },
  { href: "/projects", label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
  { href: "/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/settings/security", label: "Security", icon: <Shield className="h-4 w-4" /> },
];

const settingsItems: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: <Settings className="h-4 w-4" /> },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, roles } = useSession();
  const me = useMe();
  const { organizations, activeOrganizationId, setActiveOrganizationId, effectiveRole, isAdmin } = useTenantScope();
  const hasSuperAdminRole = roles.includes("Super Admin");
  const hasGlobalAdminRole = roles.some((role) =>
    ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"].includes(role)
  );
  const organizationOptions = organizations.map((organization) => ({
    label: organization.name,
    value: String(organization.id),
  }));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col lg:gap-6">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Badge tone="outline" className="bg-amber-500/10 text-amber-100 border-amber-500/40">
              Amber
            </Badge>
            <span className="text-sm text-white/70">RBAC Console</span>
          </div>

          <nav className="space-y-1">
            {navItems
              .concat(hasSuperAdminRole ? [{ href: "/audit", label: "Audit", icon: <Activity className="h-4 w-4" /> }] : [])
              .concat(hasGlobalAdminRole || isAdmin ? [{ href: "/assignments", label: "Assignments", icon: <Share2 className="h-4 w-4" /> }] : [])
              .concat([{ href: "/access-matrix", label: "Access Matrix", icon: <Grid className="h-4 w-4" /> }])
              .map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-amber-500/15 text-white border border-amber-500/40"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Settings</div>
            <div className="space-y-1">
              {settingsItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
                      active
                        ? "bg-white/10 text-white border border-white/15"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-white/50">Role-based workspace</p>
              <h1 className="text-2xl font-bold text-white">Control Center</h1>
            </div>
          <div className="flex items-center gap-2">
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
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <span className="uppercase tracking-[0.2em] text-white/40">Profile</span>
          <Badge tone="outline" className="flex items-center gap-1">
            <UserCircle className="h-4 w-4" />
            {me.email || "Unknown user"}
          </Badge>
          {(me.roles?.length || 0) === 0 ? (
            <Badge tone="outline">No roles in token</Badge>
          ) : (
            <>
              {me.roles.map((r) => (
                <Badge key={r} tone="outline">
                  {r}
                </Badge>
              ))}
              <Badge tone="default">Active: {effectiveRole}</Badge>
            </>
          )}
        </div>

        <main className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[var(--shadow-md)] backdrop-blur">
          {children}
        </main>
        </div>
      </div>
    </div>
  );
}
