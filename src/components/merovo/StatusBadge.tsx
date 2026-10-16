import { VEHICLE_STATUS_LABEL } from "@/lib/search-labels";

/** Kravstatus med ikon og tekst (ikke bare farge). «Må kontrolleres» er en oppfordring til å se nærmere, ikke en feiltilstand. */
const STYLE = {
  match: { icon: "✓", cls: "border-ok/40 bg-[#e3efe6] text-ok" },
  needs_review: { icon: "◐", cls: "border-[#c9a45a] bg-[#f8ecd2] text-[#5c4106]" },
  excluded: { icon: "✕", cls: "border-sand bg-sand-soft text-[#7a3a29]" },
} as const;

export function StatusBadge({ status, testId }: { status: keyof typeof STYLE; testId?: string }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${s.cls}`} data-testid={testId}>
      <span aria-hidden="true">{s.icon}</span>{VEHICLE_STATUS_LABEL[status]}
    </span>
  );
}

export function SyntheticChip({ text }: { text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-rust bg-paper px-3 py-1 text-xs font-bold text-rust-dark" data-testid="source-label"><span aria-hidden="true">◇</span>{text}</span>;
}
