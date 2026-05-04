// Helpers de sessão server-side: lê/escreve cookies httpOnly do token JWT.
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiFetchServer } from "@/lib/api/client.server";
import type { User } from "@/lib/api/types";

const COOKIE_NAME = "if_token";
const COOKIE_REFRESH = "if_refresh";

// Cookie só é "secure" se SECURE_COOKIES=true no env (precisa HTTPS na frente).
// Em dev/HTTP simples (incluindo IPs em rede local), deixar false pro browser aceitar.
const SECURE = process.env.SECURE_COOKIES === "true";

export async function setSessionCookies(access: string, refresh: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, access, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE,
    path: "/",
    maxAge: 60 * 60,
  });
  store.set(COOKIE_REFRESH, refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(COOKIE_REFRESH);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await apiFetchServer<User>("/auth/me");
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
