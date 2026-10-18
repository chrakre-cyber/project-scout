/**
 * Bruksfradrag etter alder (forskrift § 3-3; T05/T42). Deterministisk dato-til-dato fra første gangs registrering (i utlandet) til
 * første gangs registrering i Norge. Et trinn nås på dagen kjøretøyet «fyller» alderen (T42 for hele år; månedstrinn behandles likt,
 * E1P/U-009). Er dagen (29–31) ikke til i målmåneden, er kilden taus: da beregnes begge kandidater og utfallet er `ambiguous` hvis de
 * gir ulikt trinn. 20-årsregelen: 100 % fra 1. januar i året det har gått 20 år (§ 3-3 tredje ledd).
 */
import { compareIso, formatIso, monthAnniversaryCandidates, parseIsoDate } from "./dates";
import type { DeductionStep } from "./profile-no-2026-a";

export interface DeductionLookup {
  percent: number;
  stepMonths: number | null;
  stepLabel: string | null;
  twentyYearRule: boolean;
  /** Utfallet avhenger av hvordan dag 29–31 behandles (kilden sier ikke). */
  ambiguous: boolean;
  /** Hele måneder dato til dato (kandidat «clamped»). */
  completedMonths: number;
  /** Første trinn der utfallet avhenger av dag-overflyt (U-009); null hvis ingen. */
  ambiguity: { stepMonths: number; clampedDate: string; rolledDate: string } | null;
}

export function stepLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y > 0 ? `${y} år` : "";
  const ms = m > 0 ? `${m} ${m === 1 ? "måned" : "måneder"}` : "";
  return [ys, ms].filter(Boolean).join(" og ");
}

export function lookupDeduction(table: readonly DeductionStep[], firstIso: string, norwegianIso: string): DeductionLookup {
  const first = parseIsoDate(firstIso);
  if (!first || !parseIsoDate(norwegianIso)) throw new Error("ugyldig dato til bruksfradrag");
  if (compareIso(norwegianIso, firstIso) < 0) throw new Error("norsk registrering før første registrering");

  let completed = 0;
  while (completed < 1200 && compareIso(norwegianIso, monthAnniversaryCandidates(first, completed + 1).clamped) >= 0) completed++;

  if (compareIso(norwegianIso, formatIso({ y: first.y + 20, m: 1, d: 1 })) >= 0) {
    return { percent: 100, stepMonths: 240, stepLabel: stepLabel(240), twentyYearRule: true, ambiguous: false, completedMonths: completed, ambiguity: null };
  }
  let pc = 0;
  let pr = 0;
  let sm: number | null = null;
  let ambiguity: DeductionLookup["ambiguity"] = null;
  for (const s of table) {
    if (s.ageMonths >= 240) continue; // siste trinn styres av 1. januar-regelen over
    const c = monthAnniversaryCandidates(first, s.ageMonths);
    if (compareIso(norwegianIso, c.clamped) >= 0) {
      pc = s.percent;
      sm = s.ageMonths;
    }
    if (compareIso(norwegianIso, c.rolled) >= 0) pr = s.percent;
    if (!ambiguity && compareIso(norwegianIso, c.clamped) >= 0 && compareIso(norwegianIso, c.rolled) < 0) ambiguity = { stepMonths: s.ageMonths, clampedDate: c.clamped, rolledDate: c.rolled };
  }
  return { percent: pc, stepMonths: sm, stepLabel: sm === null ? null : stepLabel(sm), twentyYearRule: false, ambiguous: pc !== pr, completedMonths: completed, ambiguity };
}
