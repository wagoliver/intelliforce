// Adaptado de web/lib/api/departments.ts (somente leitura no mobile v1).
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
};
