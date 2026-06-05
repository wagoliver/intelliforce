// COPIADO DE web/lib/api/types.ts — manter em sincronia
// Tipos do contrato com a API IntelliForce.

export type UUID = string;

export interface User {
  id: UUID;
  email: string;
  name: string;
  role: "admin" | "user" | "auditor";
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string | { msg: string; loc?: string[] }[];
}
