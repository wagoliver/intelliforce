import type { ComponentStatus } from "@/lib/api/diagnostics";

const LABEL: Record<ComponentStatus, string> = {
  ok: "saudável",
  warn: "atenção",
  err: "erro",
  unknown: "—",
};

export function StatusChip({ status }: { status: ComponentStatus }) {
  return (
    <span className={`chip chip-${status}`}>
      <span className="chip-dot" />
      {LABEL[status]}
    </span>
  );
}
