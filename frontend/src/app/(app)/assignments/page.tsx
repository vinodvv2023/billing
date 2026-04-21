"use client";

import { ClientPortalRedirect } from "@/components/client-portal-redirect";
import { useTenantScope } from "@/lib/tenant-scope";
import { AssignmentsPage } from "../_components/assignments-page";

export default function AssignmentsRoutePage() {
  const { effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return (
      <ClientPortalRedirect
        title="Redirecting to invoices"
        description="Assignments are an internal access-management workflow. Client logins are redirected to the invoice portal."
      />
    );
  }
  return <AssignmentsPage />;
}
