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

export async function fetchOpenCodeContent(
  kind: "skill" | "agent" | "command" | "script",
  slug: string,
): Promise<OpenCodeContent> {
  let url: string;
  if (kind === "script") {
    // slug pra script vem como "<skill>/<filename>" — encodeURI dos dois lados separadamente
    const sepIdx = slug.indexOf("/");
    if (sepIdx === -1) throw new Error("Script slug malformado");
    const skillSlug = encodeURIComponent(slug.slice(0, sepIdx));
    const filename = encodeURIComponent(slug.slice(sepIdx + 1));
    url = `/api/proxy/opencode/scripts/${skillSlug}/${filename}`;
  } else {
    const path = kind === "skill" ? "skills" : kind === "agent" ? "agents" : "commands";
    url = `/api/proxy/opencode/${path}/${encodeURIComponent(slug)}`;
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}
