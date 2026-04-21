"use client";

import { ClientPortalRedirect } from "@/components/client-portal-redirect";
import { useTenantScope } from "@/lib/tenant-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";

const capabilities = [
  "Create company",
  "Create project",
  "Assign company",
  "Assign project",
  "Invite user",
  "Archive user",
];

const roles = [
  "Super Admin",
  "Agency Admin",
  "Agency Company Admin",
  "Agency User",
  "Company Admin",
  "Company User",
  "Individual User",
];

const matrix: Record<string, boolean[]> = {
  "Super Admin": [true, true, true, true, true, true],
  "Agency Admin": [true, true, true, true, true, true],
  "Agency Company Admin": [true, true, true, true, true, true],
  "Agency User": [false, false, false, true, false, false],
  "Company Admin": [true, true, true, true, true, true],
  "Company User": [false, false, false, true, false, false],
  // Individual User can create a single company and projects inside it, but cannot invite/assign others.
  "Individual User": [true, true, false, true, false, false],
};

export default function AccessMatrixPage() {
  const { effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return (
      <ClientPortalRedirect
        title="Redirecting to invoices"
        description="The access matrix is an internal governance view. Client logins are redirected to the invoice portal."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Access Matrix</h2>
          <p className="text-sm text-white/60">Role-to-capability mapping per requirements.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="min-w-full border-collapse text-sm text-white/80">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">Role</th>
                {capabilities.map((cap) => (
                  <th key={cap} className="px-4 py-3 text-left text-white/60">
                    {cap}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role} className="border-t border-white/10">
                  <td className="px-4 py-3 font-semibold text-white">{role}</td>
                  {capabilities.map((cap, idx) => (
                    <td key={cap} className="px-4 py-3">
                      {matrix[role][idx] ? (
                        <Badge tone="success">Allowed</Badge>
                      ) : (
                        <Badge tone="outline">No</Badge>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
