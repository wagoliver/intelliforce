"use client";

import { useTranslations } from "next-intl";
import { useFormState, useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("auth");
  return (
    <button type="submit" className="btn-primary btn-gradient w-full" disabled={pending}>
      {pending ? t("verifying") : t("sign_in")}
    </button>
  );
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});

  return (
    <main className="relative flex min-h-[100dvh] flex-col justify-center px-6 py-10">
      <div className="app-mesh" aria-hidden="true" />
      <div className="relative z-10 mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-gradient mb-2 font-display text-sm font-semibold uppercase tracking-widest">
            IntelliForce
          </div>
          <h1 className="font-display text-2xl font-semibold text-fg">{t("headline")}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t("sub")}</p>
        </div>

        <form action={formAction} className="panel card-glow flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="email">{t("work_email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              className="input"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="password">{t("password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </main>
  );
}
