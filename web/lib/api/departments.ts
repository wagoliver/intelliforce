import { apiFetch } from "./client";
import type { UUID } from "./types";

export interface ActivityOut {
  id: UUID;
  squad_id: UUID;
  name: string;
  display_name: string;
  skill_code: string;
  target_agent_count: number;
  position: number;
  default_agent_id: UUID | null;
  schedule: string | null;
  next_run: string | null;
  agent_count: number;
  active_count: number;
  idle_count: number;
  offline_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface SquadOut {
  id: UUID;
  department_id: UUID;
  name: string;
  display_name: string;
  position: number;
  activities: ActivityOut[];
  created_at: string;
  updated_at: string;
}

export interface PersonOut {
  id: UUID;
  name: string;
  email: string;
  role: string;
}

export interface DepartmentOut {
  id: UUID;
  name: string;
  display_name: string;
  objective: string;
  owner_user_id: UUID | null;
  owner: PersonOut | null;
  monthly_cost_budget_usd: string;
  health: string;
  squads: SquadOut[];
  total_agents: number;
  next_run: string | null;
  created_at: string;
  updated_at: string;
}

export const departments = {
  list: () => apiFetch<DepartmentOut[]>("/departments"),
  get: (id: UUID) => apiFetch<DepartmentOut>(`/departments/${id}`),
  create: (data: any) =>
    apiFetch<DepartmentOut>("/departments", { method: "POST", json: data }),
  update: (id: UUID, data: any) =>
    apiFetch<DepartmentOut>(`/departments/${id}`, { method: "PATCH", json: data }),
  remove: (id: UUID) =>
    apiFetch<void>(`/departments/${id}`, { method: "DELETE" }),

  // Squads
  createSquad: (deptId: UUID, data: any) =>
    apiFetch<SquadOut>(`/departments/${deptId}/squads`, { method: "POST", json: data }),
  updateSquad: (deptId: UUID, squadId: UUID, data: any) =>
    apiFetch<SquadOut>(`/departments/${deptId}/squads/${squadId}`, { method: "PATCH", json: data }),
  removeSquad: (deptId: UUID, squadId: UUID) =>
    apiFetch<void>(`/departments/${deptId}/squads/${squadId}`, { method: "DELETE" }),

  // Activities
  createActivity: (deptId: UUID, squadId: UUID, data: any) =>
    apiFetch<ActivityOut>(`/departments/${deptId}/squads/${squadId}/activities`, { method: "POST", json: data }),
  updateActivity: (deptId: UUID, squadId: UUID, activityId: UUID, data: any) =>
    apiFetch<ActivityOut>(`/departments/${deptId}/squads/${squadId}/activities/${activityId}`, { method: "PATCH", json: data }),
  removeActivity: (deptId: UUID, squadId: UUID, activityId: UUID) =>
    apiFetch<void>(`/departments/${deptId}/squads/${squadId}/activities/${activityId}`, { method: "DELETE" }),
};

export const people = {
  list: () => apiFetch<PersonOut[]>("/people"),
};
