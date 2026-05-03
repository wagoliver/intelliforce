"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

export function LocaleSwitcher() {
  const t = useTranslations("language");
  const current = useLocale();
  const [pending, start] = useTransition();

  function change(locale: string) {
    start(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      window.location.reload();
    });
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      title={t("label")}
      style={{
        padding: "4px 8px",
        border: "1px solid var(--border, #ddd)",
        borderRadius: 6,
        background: "transparent",
        color: "inherit",
        fontSize: 12,
        cursor: pending ? "wait" : "pointer",
      }}
    >
      <option value="pt-BR">{t("pt-BR")}</option>
      <option value="en">{t("en")}</option>
    </select>
  );
}
