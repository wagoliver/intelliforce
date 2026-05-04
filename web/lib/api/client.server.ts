// Wrapper server-only que injeta token do cookie httpOnly.
// Use em Server Components / Server Actions.
import "server-only";

import { cookies } from "next/headers";

import { apiFetch } from "./client";

export async function apiFetchServer<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const store = await cookies();
  const token = store.get("if_token")?.value;
  return apiFetch<T>(path, { ...init, token });
}
