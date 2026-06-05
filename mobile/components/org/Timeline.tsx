import { STATUS_COLORS } from "@/lib/org/status";
import type { TimelineBucket } from "@/lib/api/metrics";

/** Barras empilhadas (sucesso/falha) por hora — últimas 12h. */
export function Timeline({ buckets }: { buckets: TimelineBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.completed + b.failed));
  return (
    <div className="flex h-14 items-end gap-1">
      {buckets.map((b, i) => {
        const total = b.completed + b.failed;
        return (
          <div key={i} className="flex flex-1 flex-col justify-end gap-px">
            {b.failed > 0 && (
              <div
                className="rounded-sm"
                style={{ height: `${(b.failed / max) * 100}%`, background: STATUS_COLORS.error }}
              />
            )}
            {b.completed > 0 && (
              <div
                className="rounded-sm"
                style={{ height: `${(b.completed / max) * 100}%`, background: STATUS_COLORS.active }}
              />
            )}
            {total === 0 && <div className="h-0.5 rounded bg-bg-subtle" />}
          </div>
        );
      })}
    </div>
  );
}
