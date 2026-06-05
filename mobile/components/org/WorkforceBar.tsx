import { STATUS_COLORS, STATUS_ORDER, totalCount, type StatusCounts } from "@/lib/org/status";

/** Barra horizontal segmentada por status da força de trabalho. */
export function WorkforceBar({
  counts,
  className = "",
}: {
  counts: StatusCounts;
  className?: string;
}) {
  const total = totalCount(counts);
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-bg-subtle ${className}`}>
      {total > 0 &&
        STATUS_ORDER.map((k) => {
          const v = counts[k];
          if (!v) return null;
          return (
            <div
              key={k}
              style={{ width: `${(v / total) * 100}%`, background: STATUS_COLORS[k] }}
            />
          );
        })}
    </div>
  );
}
