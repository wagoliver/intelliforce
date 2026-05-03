"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { setSessionCookies } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email e senha são obrigatórios." };
  }

  try {
    const data = await auth.login({ email, password });
    await setSessionCookies(data.access_token, data.refresh_token);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.detail };
    return { error: "Erro inesperado ao autenticar." };
  }

  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password || !name) {
    return { error: "Preencha nome, email e senha." };
  }
  if (password.length < 8) {
    return { error: "Senha precisa de pelo menos 8 caracteres." };
  }

  try {
    const data = await auth.register({ email, password, name });
    await setSessionCookies(data.access_token, data.refresh_token);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.detail };
    return { error: "Erro inesperado ao registrar." };
  }

  redirect("/dashboard");
}
