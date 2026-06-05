"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Alterna claro/escuro: muda a classe .dark na hora e persiste no cookie. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    fetch("/api/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next ? "dark" : "light" }),
    }).catch(() => {
      /* persistência best-effort */
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Tema claro" : "Tema escuro"}
      className="grid h-10 w-10 place-items-center rounded-lg text-fg-subtle hover:bg-bg-subtle hover:text-fg"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
