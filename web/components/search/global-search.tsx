"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";

import "./global-search.css";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  url: string;
};

type SearchGroup = {
  kind: "department" | "agent" | "activity" | "skill";
  label: string;
  results: SearchResult[];
};

type SearchResponse = {
  groups: SearchGroup[];
  total: number;
  query: string;
};

const KIND_ICON: Record<SearchGroup["kind"], string> = {
  department: "▦",
  agent: "◉",
  activity: "▶",
  skill: "✦",
};

/**
 * Busca global no TopBar — debounce 200ms, dropdown agrupado por categoria,
 * keyboard nav (↑↓ Enter Esc), ⌘K global pra abrir.
 *
 * Endpoints: GET /search?q=... retorna { groups: [{kind, label, results}] }
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  // Lista plana dos resultados pra navegação por teclado
  const flatResults = results.flatMap((g) =>
    g.results.map((r) => ({ ...r, kind: g.kind })),
  );

  // ── ⌘K global ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd+K (Mac) ou Ctrl+K (Win/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Click fora fecha ──
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Debounced search ──
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(() => {
      apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(query.trim())}`)
        .then((data) => {
          setResults(data.groups || []);
          setError(null);
          setHighlightedIdx(0);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (!open || flatResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatResults[highlightedIdx];
      if (target) selectResult(target);
    }
  }

  function selectResult(r: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(r.url);
  }

  // Calcula índice global de cada resultado pra mapear highlight
  let globalIdx = 0;

  return (
    <div ref={containerRef} className="gs-container">
      <div className={`gs-input-wrap ${open ? "is-active" : ""}`}>
        <svg
          className="gs-icon"
          width={14}
          height={14}
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10l3 3" />
          </g>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Buscar departamentos, employees, atividades, skills…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="gs-input"
          aria-label="Busca global"
          aria-expanded={open}
          aria-controls="gs-results"
        />
        <kbd className="gs-kbd">⌘K</kbd>
      </div>

      {open && query.trim() && (
        <div id="gs-results" className="gs-dropdown" role="listbox">
          {loading && <div className="gs-status">buscando…</div>}
          {error && (
            <div className="gs-status gs-status--error" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && flatResults.length === 0 && (
            <div className="gs-status">Nenhum resultado pra "{query}"</div>
          )}
          {results.map((group) => (
            <div key={group.kind} className="gs-group">
              <div className="gs-group-label">{group.label}</div>
              {group.results.map((r) => {
                const idx = globalIdx++;
                const highlighted = idx === highlightedIdx;
                return (
                  <button
                    key={`${group.kind}-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={highlighted}
                    className={`gs-result ${highlighted ? "is-highlighted" : ""}`}
                    onClick={() => selectResult(r)}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                  >
                    <span className={`gs-result-icon gs-result-icon--${group.kind}`}>
                      {KIND_ICON[group.kind]}
                    </span>
                    <span className="gs-result-body">
                      <span className="gs-result-title">{r.title}</span>
                      {r.subtitle && (
                        <span className="gs-result-subtitle">{r.subtitle}</span>
                      )}
                    </span>
                    <span className="gs-result-slug">{r.slug}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
