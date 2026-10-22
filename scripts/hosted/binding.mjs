// HOST-001 (forberedelse): binding av lokale belegg (.hosted/*.json) til mål, modus, migrasjonsgrunnlag og tidspunkt. Rapporten bruker bare belegg som er verifisert mot GJELDENDE mål/modus/repo-hash
// og som henger sammen i kjeden (inspeksjon → dry-run → anvendelse); alt annet forkastes som «ikke verifisert» og kan aldri gi BESTÅTT. Rene funksjoner; fingeravtrykk er ikke hemmelige, men vises ikke i avvisningsgrunnene.
export const REPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Bindingen som skrives sammen med hvert belegg. `extra` kan inneholde kjedeglede (inspectTakenAt, dryRunTakenAt, planTakenAt). */
export const stamp = (target, repoHash, now, extra = {}) => ({ target: { fingerprint: target.fingerprint }, mode: target.mode, repoHash, takenAt: now.toISOString(), ...extra });

/** @returns {{ ok: boolean, reason?: string }} */
export function checkBinding(b, { target, repoHash, now, maxAgeMs = REPORT_MAX_AGE_MS }) {
  if (!b || typeof b !== "object" || !b.target || typeof b.takenAt !== "string") return { ok: false, reason: "mangler binding til mål/modus/migrasjonsgrunnlag" };
  if (b.target.fingerprint !== target.fingerprint) return { ok: false, reason: "hører til et annet mål" };
  if (b.mode !== target.mode) return { ok: false, reason: "hører til en annen modus" };
  if (b.repoHash !== repoHash) return { ok: false, reason: "hører til et annet migrasjonsgrunnlag (repoets migrasjoner er endret)" };
  const age = now.getTime() - Date.parse(b.takenAt);
  if (!Number.isFinite(age) || age < 0) return { ok: false, reason: "har ugyldig tidspunkt" };
  if (age > maxAgeMs) return { ok: false, reason: "er for gammelt (over 24 timer)" };
  return { ok: true };
}
