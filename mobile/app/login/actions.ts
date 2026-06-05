// Baseado em web/app/login/actions.ts — adaptado p/ useFormState (prevState, formData).
"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { setSessionCookies } from "@/lib/auth/session";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email e senha são obrigatórios." };
  }

  try {
    const data = await auth.login({ email, password });
    await setSessionCookies(data.access_token, data.refresh_token);
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: typeof err.detail === "string" ? err.detail : "Falha no login." };
    }
    return { error: "Erro inesperado ao autenticar." };
  }

  // redirect lança NEXT_REDIRECT — propaga corretamente pelo useFormState.
  redirect("/dashboard");
}
