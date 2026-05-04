"use client";

import { useCallback, useEffect, useState } from "react";

import { vault, type Secret } from "@/lib/api/vault";

export function useSecrets() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const list = await vault.list();
      setSecrets(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { secrets, loading, error, refetch };
}
