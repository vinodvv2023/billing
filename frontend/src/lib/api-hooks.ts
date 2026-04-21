"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type OrganizationSummary = {
  id: number;
  name: string;
  type: string;
  projects: number;
  members: number;
  status: string;
  created_by?: number | null;
  created_by_email?: string | null;
};

export type ProjectSummary = {
  id: number;
  name: string;
  org: string | null;
  role: string;
  members: number;
  status: string;
  created_by?: number | null;
  created_by_email?: string | null;
  description?: string | null;
  client_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  expected_outcome?: string | null;
  deadline_datetime?: string | null;
};

export type UserSummary = {
  id: number;
  email: string;
  role: string;
  org: string;
  status: string;
  invite_link?: string | null;
  invite_expires_at?: string | null;
  client_id?: number | null;
};

export type Profile = {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
  access_token?: string | null;
};

export type AuditEntry = {
  id: number;
  action: string;
  actor_id?: number | null;
  actor_email?: string | null;
  target_type: string;
  target_id: number;
  email?: string | null;
  created_at: string;
};

export type TenantMember = {
  user_id: number;
  email: string;
  role: string;
};

export type TenantProject = {
  id: number;
  name: string;
  members: TenantMember[];
};

export type TenantSummary = {
  id: number;
  name: string;
  members: TenantMember[];
  projects: TenantProject[];
};

export type ClientRecord = {
  id: number;
  org_id: number;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TaskRecord = {
  id: number;
  org_id: number;
  project_id: number;
  name: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TimesheetEntryRecord = {
  id: number;
  org_id: number;
  user_id: number;
  project_id: number;
  task_id?: number | null;
  client_id?: number | null;
  entry_date: string;
  hours: string;
  description?: string | null;
  billable: boolean;
  status: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TimesheetSummary = {
  org_id: number;
  date_from: string;
  date_to: string;
  total_hours: string;
  billable_hours: string;
  entry_count: number;
  project_totals: { project_id: number; hours: string }[];
};

export type BillingRateRecord = {
  id: number;
  org_id: number;
  client_id?: number | null;
  project_id?: number | null;
  role?: string | null;
  hourly_rate: string;
  currency: string;
  effective_from: string;
  effective_to?: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceLineRecord = {
  id: number;
  project_id?: number | null;
  task_id?: number | null;
  line_type: string;
  description: string;
  hours?: string | null;
  unit_price?: string | null;
  amount: string;
  timesheet_entry_ids: number[];
};

export type InvoiceRecord = {
  id: number;
  org_id: number;
  client_id: number;
  invoice_number: string;
  issue_date: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: string;
  total_amount: string;
  notes?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  voided_at?: string | null;
  lines: InvoiceLineRecord[];
  created_at: string;
  updated_at: string;
};

export type UnbilledSummary = {
  entry_count: number;
  by_client: { client_id?: number | null; hours: string }[];
  by_project: { project_id: number; hours: string }[];
};

function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.get<OrganizationSummary[]>("/rbac/organizations"),
    staleTime: 30_000,
    retry: 0,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectSummary[]>("/rbac/projects"),
    staleTime: 30_000,
    retry: 0,
  });
}

export function useUsers(orgId?: number | null) {
  return useQuery({
    queryKey: ["users", orgId ?? "all"],
    queryFn: () => api.get<UserSummary[]>(orgId ? `/rbac/users?org_id=${orgId}` : "/rbac/users"),
    staleTime: 30_000,
    retry: 0,
  });
}

export function useAuditLogs(action?: string) {
  return useQuery({
    queryKey: ["audit", action ?? "all"],
    queryFn: () => api.get<AuditEntry[]>(action ? `/rbac/audit?action=${encodeURIComponent(action)}` : "/rbac/audit"),
    staleTime: 15_000,
    retry: 0,
  });
}

export function useDashboardActivity() {
  return useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => api.get<AuditEntry[]>("/rbac/dashboard/activity"),
    staleTime: 15_000,
    retry: 0,
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<Profile>("/auth/me"),
    staleTime: 30_000,
    retry: 0,
  });
}

export function useTenantSummary() {
  return useQuery({
    queryKey: ["tenant-summary"],
    queryFn: () => api.get<TenantSummary[]>("/rbac/tenant-summary"),
    staleTime: 10_000,
  });
}

export function useClients(orgId?: number | null) {
  return useQuery({
    queryKey: ["clients", orgId ?? "none"],
    queryFn: () => api.get<ClientRecord[]>(`/clients${qs({ org_id: orgId })}`),
    enabled: Boolean(orgId),
    staleTime: 15_000,
  });
}

export function useTasks(projectId?: number | null) {
  return useQuery({
    queryKey: ["tasks", projectId ?? "none"],
    queryFn: () => api.get<TaskRecord[]>(`/clients/projects/${projectId}/tasks`),
    enabled: Boolean(projectId),
    staleTime: 15_000,
  });
}

export function useTimesheetEntries(params: {
  orgId?: number | null;
  status?: string;
  projectId?: number | null;
  userId?: number | null;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["timesheet-entries", params],
    queryFn: () =>
      api.get<TimesheetEntryRecord[]>(
        `/timesheets/entries${qs({
          org_id: params.orgId,
          status: params.status,
          project_id: params.projectId,
          user_id: params.userId,
          date_from: params.dateFrom,
          date_to: params.dateTo,
        })}`
      ),
    enabled: Boolean(params.orgId),
    staleTime: 10_000,
  });
}

export function useTimesheetApprovals(params: {
  orgId?: number | null;
  projectId?: number | null;
  userId?: number | null;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["timesheet-approvals", params],
    queryFn: () =>
      api.get<TimesheetEntryRecord[]>(
        `/timesheets/approvals${qs({
          org_id: params.orgId,
          project_id: params.projectId,
          user_id: params.userId,
          date_from: params.dateFrom,
          date_to: params.dateTo,
        })}`
      ),
    enabled: Boolean(params.orgId),
    staleTime: 10_000,
  });
}

export function useTimesheetSummary(params: { orgId?: number | null; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ["timesheet-summary", params],
    queryFn: () =>
      api.get<TimesheetSummary>(
        `/timesheets/summary${qs({ org_id: params.orgId, date_from: params.dateFrom, date_to: params.dateTo })}`
      ),
    enabled: Boolean(params.orgId && params.dateFrom && params.dateTo),
    staleTime: 10_000,
  });
}

export function useBillingRates(orgId?: number | null) {
  return useQuery({
    queryKey: ["billing-rates", orgId ?? "none"],
    queryFn: () => api.get<BillingRateRecord[]>(`/billing/rates${qs({ org_id: orgId })}`),
    enabled: Boolean(orgId),
    staleTime: 15_000,
  });
}

export function useUnbilledSummary(orgId?: number | null, clientId?: number | null) {
  return useQuery({
    queryKey: ["billing-unbilled", orgId ?? "none", clientId ?? "all"],
    queryFn: () => api.get<UnbilledSummary>(`/billing/unbilled${qs({ org_id: orgId, client_id: clientId })}`),
    enabled: Boolean(orgId),
    staleTime: 10_000,
  });
}

export function useInvoices(params: {
  orgId?: number | null;
  status?: string;
  clientId?: number | null;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () =>
      api.get<InvoiceRecord[]>(
        `/billing/invoices${qs({
          org_id: params.orgId,
          status: params.status,
          client_id: params.clientId,
          date_from: params.dateFrom,
          date_to: params.dateTo,
        })}`
      ),
    enabled: Boolean(params.orgId),
    staleTime: 10_000,
  });
}

export function useInvoice(invoiceId?: number | null) {
  return useQuery({
    queryKey: ["invoice", invoiceId ?? "none"],
    queryFn: () => api.get<InvoiceRecord>(`/billing/invoices/${invoiceId}`),
    enabled: Boolean(invoiceId),
    staleTime: 10_000,
  });
}

function invalidateBilling(qc: ReturnType<typeof useQueryClient>, orgId?: number | null) {
  qc.invalidateQueries({ queryKey: ["billing-rates"] });
  qc.invalidateQueries({ queryKey: ["billing-unbilled"] });
  qc.invalidateQueries({ queryKey: ["invoices"] });
  qc.invalidateQueries({ queryKey: ["invoice"] });
  qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
  if (orgId != null) {
    qc.invalidateQueries({ queryKey: ["clients", orgId] });
    qc.invalidateQueries({ queryKey: ["timesheet-entries"] });
    qc.invalidateQueries({ queryKey: ["timesheet-summary"] });
    qc.invalidateQueries({ queryKey: ["timesheet-approvals"] });
  }
}

export function useAssignProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { projectId: number; userId: number }) =>
      api.post(`/rbac/projects/${payload.projectId}/assign`, { user_id: payload.userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-summary"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUnassignProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { projectId: number; userId: number }) =>
      api.delete(`/rbac/projects/${payload.projectId}/assignments/${payload.userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-summary"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; type: string }) => api.post("/rbac/organizations", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number; name?: string; type?: string; status?: string }) =>
      api.patch(`/rbac/organizations/${payload.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number }) => api.delete(`/rbac/organizations/${payload.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      org_id: number;
      client_id?: number | null;
      description?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      expected_outcome?: string | null;
      deadline_datetime?: string | null;
      status?: string;
    }) => api.post("/rbac/projects", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: number;
      name?: string;
      status?: string;
      client_id?: number | null;
      description?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      expected_outcome?: string | null;
      deadline_datetime?: string | null;
    }) =>
      api.patch(`/rbac/projects/${payload.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number }) => api.delete(`/rbac/projects/${payload.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; role: string; full_name?: string; organization_ids: number[]; client_id?: number | null }) =>
      api.post<UserSummary>("/rbac/users/invite", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["tenant-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: number; role: string; organization_ids?: number[]; client_id?: number | null }) =>
      api.patch(`/rbac/users/${payload.userId}/role`, {
        role: payload.role,
        organization_ids: payload.organization_ids ?? [],
        client_id: payload.client_id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["tenant-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: number }) => api.delete(`/rbac/users/${payload.userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["tenant-summary"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; full_name?: string }) => api.patch<Profile>("/auth/me", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-profile"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { org_id: number; name: string; contact_name?: string; contact_email?: string; status?: string }) =>
      api.post<ClientRecord>("/clients", payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients", data.org_id] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { clientId: number; orgId: number; name?: string; contact_name?: string; contact_email?: string; status?: string }) =>
      api.patch<ClientRecord>(`/clients/${payload.clientId}`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients", data.org_id] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { clientId: number; orgId: number }) => api.delete(`/clients/${payload.clientId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["clients", variables.orgId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useCreateTimesheetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      project_id: number;
      task_id?: number | null;
      entry_date: string;
      hours: string;
      description?: string;
      billable: boolean;
      client_id?: number | null;
    }) => api.post<TimesheetEntryRecord>("/timesheets/entries", payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["timesheet-entries"] });
      qc.invalidateQueries({ queryKey: ["timesheet-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
      qc.invalidateQueries({ queryKey: ["clients", data.org_id] });
    },
  });
}

export function useSubmitTimesheetEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => api.post<TimesheetEntryRecord>(`/timesheets/entries/${entryId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet-entries"] });
      qc.invalidateQueries({ queryKey: ["timesheet-summary"] });
      qc.invalidateQueries({ queryKey: ["timesheet-approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useBulkApproveTimesheets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entry_ids: number[] }) => api.post("/timesheets/entries/bulk-approve", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet-entries"] });
      qc.invalidateQueries({ queryKey: ["timesheet-summary"] });
      qc.invalidateQueries({ queryKey: ["timesheet-approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
      qc.invalidateQueries({ queryKey: ["billing-unbilled"] });
    },
  });
}

export function useBulkRejectTimesheets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entry_ids: number[]; reason?: string }) => api.post("/timesheets/entries/bulk-reject", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet-entries"] });
      qc.invalidateQueries({ queryKey: ["timesheet-summary"] });
      qc.invalidateQueries({ queryKey: ["timesheet-approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useCreateBillingRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      org_id: number;
      client_id?: number | null;
      project_id?: number | null;
      role?: string | null;
      hourly_rate: string;
      currency: string;
      effective_from: string;
      effective_to?: string | null;
    }) => api.post<BillingRateRecord>("/billing/rates", payload),
    onSuccess: (data) => invalidateBilling(qc, data.org_id),
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      org_id: number;
      client_id: number;
      period_start: string;
      period_end: string;
      issue_date: string;
      currency: string;
      grouping_mode: string;
      project_ids?: number[];
      notes?: string;
    }) => api.post<InvoiceRecord>("/billing/invoices/generate", payload),
    onSuccess: (data) => invalidateBilling(qc, data.org_id),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { invoiceId: number; status?: string; notes?: string }) =>
      api.patch<InvoiceRecord>(`/billing/invoices/${payload.invoiceId}`, { status: payload.status, notes: payload.notes }),
    onSuccess: (data) => invalidateBilling(qc, data.org_id),
  });
}

export function useAddInvoiceLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      invoiceId: number;
      description: string;
      amount: string;
      line_type?: string;
      hours?: string | null;
      unit_price?: string | null;
      project_id?: number | null;
      task_id?: number | null;
    }) =>
      api.post<InvoiceRecord>(`/billing/invoices/${payload.invoiceId}/lines`, {
        description: payload.description,
        amount: payload.amount,
        line_type: payload.line_type ?? "manual",
        hours: payload.hours,
        unit_price: payload.unit_price,
        project_id: payload.project_id,
        task_id: payload.task_id,
      }),
    onSuccess: (data) => invalidateBilling(qc, data.org_id),
  });
}
