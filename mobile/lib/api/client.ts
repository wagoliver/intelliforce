// COPIADO DE web/lib/api/client.ts — manter em sincronia
// Cliente HTTP universal — funciona em Server e Client Components.
//
// Roteamento:
//   - Server-side: usa API_URL_INTERNAL (http://api:8000) e token vem do cookie
//     via wrapper em client.server.ts (que NÃO é importado aqui).
//   - Client-side (browser): usa /api/proxy/... — Next route que injeta cookie.

const isServer = typeof window === "undefined";

const SERVER_API_URL = process.env.API_URL_INTERNAL ?? "http://api:8000";
const BROWSER_API_URL = "/api/proxy";

export const API_URL = isServer ? SERVER_API_URL : BROWSER_API_URL;

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
  json?: unknown;
}

export async function apiFetch<T>(
  path: string,
  { token, json, headers, ...init }: FetchOptions = {}
): Promise<T> {
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : init.body,
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch { /* default */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
