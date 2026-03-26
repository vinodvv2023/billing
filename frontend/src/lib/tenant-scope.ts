"use client";

import { useMemo } from "react";
import { useOrganizations, useTenantSummary } from "./api-hooks";
import { useSession } from "./session";

const ADMIN_ROLES = ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"];
const LEGACY_MEMBERSHIP_ROLES = ["Owner", "Member"];

export function useTenantScope() {
  const { roles, userId, activeOrganizationId, setActiveOrganizationId } = useSession();
  const orgQuery = useOrganizations();
  const tenantQuery = useTenantSummary();

  const organizations = orgQuery.data ?? [];
  const orgIds = organizations.map((org) => org.id);
  const resolvedActiveOrganizationId =
    activeOrganizationId && orgIds.includes(activeOrganizationId)
      ? activeOrganizationId
      : organizations[0]?.id ?? null;

  const activeTenant = useMemo(
    () => (tenantQuery.data ?? []).find((tenant) => tenant.id === resolvedActiveOrganizationId) ?? null,
    [tenantQuery.data, resolvedActiveOrganizationId]
  );

  const effectiveRole = useMemo(() => {
    if (roles.includes("Super Admin")) return "Super Admin";
    if (!activeTenant || userId == null) return roles[0] ?? "user";
    const membership = activeTenant.members.find((member) => member.user_id === userId);
    if (membership?.role && !LEGACY_MEMBERSHIP_ROLES.includes(membership.role)) {
      return membership.role;
    }
    return roles[0] ?? "user";
  }, [activeTenant, roles, userId]);

  const isAdmin = ADMIN_ROLES.includes(effectiveRole);

  return {
    organizations,
    activeTenant,
    activeOrganizationId: resolvedActiveOrganizationId,
    setActiveOrganizationId,
    effectiveRole,
    isAdmin,
    isLoading: orgQuery.isLoading || tenantQuery.isLoading,
  };
}
