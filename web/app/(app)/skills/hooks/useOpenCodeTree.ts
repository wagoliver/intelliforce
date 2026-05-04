"use client";

import { useCallback, useEffect, useState } from "react";

export type OpenCodeFile = {
  kind: "skill" | "agent" | "command";
  slug: string;
  name: string | null;
  description: string | null;
};

export type OpenCodeScript = {
  kind: "script";
  skill_slug: string;
  filename: string;
  slug: string;          // composto "<skill>/<filename>"
  size_bytes: number;
};

export type OpenCodeTree = {
  skills: OpenCodeFile[];
  agents: OpenCodeFile[];
  commands: OpenCodeFile[];
  scripts: OpenCodeScript[];
};

export type OpenCodeContent = {
  kind: string;
  slug: string;
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

const EMPTY_TREE: OpenCodeTree = { skills: [], agents: [], commands: [], scripts: [] };

export function useOpenCodeTree() {
  const [tree, setTree] = useState<OpenCodeTree>(EMPTY_TREE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/proxy/opencode/tree", { cache: "no-store" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data: OpenCodeTree = await res.json();
      setTree(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { tree, loading, error, refetch };
}

type OpenCodeKind = "skill" | "agent" | "command" | "script";

function buildOpenCodeUrl(kind: OpenCodeKind, slug: string): string {
  if (kind === "script") {
    const sepIdx = slug.indexOf("/");
    if (sepIdx === -1) throw new Error("Script slug malformado");
    const skillSlug = encodeURIComponent(slug.slice(0, sepIdx));
    const filename = encodeURIComponent(slug.slice(sepIdx + 1));
    return `/api/proxy/opencode/scripts/${skillSlug}/${filename}`;
  }
  const path = kind === "skill" ? "skills" : kind === "agent" ? "agents" : "commands";
  return `/api/proxy/opencode/${path}/${encodeURIComponent(slug)}`;
}

export async function fetchOpenCodeContent(
  kind: OpenCodeKind,
  slug: string,
): Promise<OpenCodeContent> {
  const res = await fetch(buildOpenCodeUrl(kind, slug), { cache: "no-store" });
  if (!res.ok) {
    // Tenta extrair `detail` da API pra mensagem amigável; fallback genérico
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function deleteOpenCodeItem(
  kind: OpenCodeKind,
  slug: string,
): Promise<void> {
  const res = await fetch(buildOpenCodeUrl(kind, slug), {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}
