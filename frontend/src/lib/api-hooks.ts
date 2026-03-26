"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
};

export type UserSummary = {
  id: number;
  email: string;
  role: string;
  org: string;
  status: string;
  invite_link?: string | null;
  invite_expires_at?: string | null;
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
    mutationFn: (payload: { name: string; org_id: number }) => api.post("/rbac/projects", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-activity"] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number; name?: string; status?: string }) =>
      api.patch(`/rbac/projects/${payload.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
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
    mutationFn: (payload: { email: string; role: string; full_name?: string; organization_ids: number[] }) =>
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
    mutationFn: (payload: { userId: number; role: string; organization_ids?: number[] }) =>
      api.patch(`/rbac/users/${payload.userId}/role`, { role: payload.role, organization_ids: payload.organization_ids ?? [] }),
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
