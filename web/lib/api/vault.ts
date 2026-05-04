import { apiFetch } from "./client";

export type Secret = {
  id: string;
  slug: string;
  description: string;
  field_keys: string[];           // nomes dos campos (cleartext)
  tags: string[];
  created_by_user_id: string;
  created_at: string;
  last_accessed_at: string | null;
};

/** Resposta de leitura de 1 campo específico. */
export type SecretFieldValue = {
  slug: string;
  field: string;
  value: string;
};

/** Resposta de leitura de todos os campos. */
export type SecretAllValues = {
  slug: string;
  fields: Record<string, string>;
};

export type SecretAccessLogEntry = {
  id: string;
  secret_id: string | null;
  secret_slug: string;
  accessed_by_user_id: string | null;
  accessed_by_skill: string | null;
  accessed_by_task_id: string | null;
  action: "create" | "read" | "delete" | string;
  field_accessed: string | null;   // qual campo foi acessado (NULL = todos)
  accessed_at: string;
  ip_address: string | null;
};

export type SecretCreateField = {
  key: string;
  value: string;
};

export type SecretCreate = {
  slug: string;
  description?: string;
  fields: SecretCreateField[];      // mín 1, máx 32
  tags?: string[];
};

export const vault = {
  list: () => apiFetch<Secret[]>("/secrets"),
  create: (data: SecretCreate) =>
    apiFetch<Secret>("/secrets", { method: "POST", json: data }),
  /** Lê 1 campo do secret (mais granular pro audit). */
  revealField: (slug: string, field: string) =>
    apiFetch<SecretFieldValue>(
      `/secrets/${encodeURIComponent(slug)}/value?field=${encodeURIComponent(field)}`,
    ),
  /** Lê todos os campos de uma vez (UI reveal modal). */
  revealAll: (slug: string) =>
    apiFetch<SecretAllValues>(`/secrets/${encodeURIComponent(slug)}/values`),
  remove: (slug: string) =>
    apiFetch<void>(`/secrets/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  audit: (slug: string, limit = 100) =>
    apiFetch<SecretAccessLogEntry[]>(
      `/secrets/${encodeURIComponent(slug)}/audit?limit=${limit}`,
    ),
};
