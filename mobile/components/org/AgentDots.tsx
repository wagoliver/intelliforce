import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  totalCount,
  type StatusCounts,
  type WorkStatus,
} from "@/lib/org/status";

const CAP = 60;

/** Grade de bolinhas dos agentes por status + legenda com contagens. */
export function AgentDots({ counts }: { counts: StatusCounts }) {
  const total = totalCount(counts);
  const dots: WorkStatus[] = [];
  for (const s of STATUS_ORDER) {
    for (let i = 0; i < counts[s]; i++) dots.push(s);
  }
  const shown = dots.slice(0, CAP);
  const overflow = dots.length - shown.length;

  return (
    <div>
      {total === 0 ? (
        <p className="text-sm text-fg-subtle">Sem agentes provisionados.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {shown.map((s, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_COLORS[s] }}
            />
          ))}
          {overflow > 0 && <span className="text-[11px] text-fg-subtle">+{overflow}</span>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]} <span className="font-mono text-fg">{counts[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
