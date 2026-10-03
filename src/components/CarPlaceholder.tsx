import type { BodyType } from "@/domain/types";

const PALETTE = ["#64748b", "#0f766e", "#1d4ed8", "#9333ea", "#b45309", "#be123c", "#15803d", "#334155"];

/** Syntetisk bilillustrasjon. Ingen ekte bilbilder brukes før bruksrett er avklart. */
export function CarPlaceholder({ seed, bodyType, className = "" }: { seed: string; bodyType: BodyType | null; className?: string }) {
  const hash = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const color = PALETTE[hash % PALETTE.length];
  const tall = bodyType === "suv" || bodyType === "van";
  const roofY = tall ? 30 : 38;
  return (
    <div className={`relative flex items-center justify-center bg-slate-100 ${className}`}>
      <svg viewBox="0 0 200 100" role="img" aria-label="Syntetisk bilillustrasjon, ikke bilde av bilen" className="h-full w-full max-h-40">
        <rect x="0" y="82" width="200" height="4" fill="#cbd5e1" />
        <path
          d={`M20 72 L28 56 L58 52 L78 ${roofY} L132 ${roofY} L152 52 L178 58 L182 72 Z`}
          fill={color}
        />
        <path d={`M84 ${roofY + 4} L128 ${roofY + 4} L142 52 L72 52 Z`} fill="#e2e8f0" opacity="0.8" />
        <circle cx="58" cy="76" r="10" fill="#1e293b" />
        <circle cx="146" cy="76" r="10" fill="#1e293b" />
        <circle cx="58" cy="76" r="4" fill="#94a3b8" />
        <circle cx="146" cy="76" r="4" fill="#94a3b8" />
      </svg>
      <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        Illustrasjon
      </span>
    </div>
  );
}
