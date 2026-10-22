// TESTHJELPER (ECON-006e): epoker for den UENDREDE appen. Appen leser SCOUT_SYNTHETIC_EPOCH (server-only) og kjøres uten testpatcher.
// Format som appen krever: ÅÅÅÅ-MM-DDTTT:MM:SSZ, aldri senere enn nå.
import { readFileSync } from "node:fs";

export const epochIso = (ms) => new Date(ms - (ms % 1000)).toISOString().replace(".000Z", "Z");
/** En frisk epoke: nå − 1 time (alle simulerte observasjoner ligger 1–49 timer tilbake; økonomien er i bruk til ≥ 4 d 23 t etter). */
export const freshEpoch = () => epochIso(Date.now() - 3_600_000);
/** En utløpt epoke: 8 døgn tilbake (oppbevaringstiden er 7 døgn ⇒ alle annonser utløpt, uten at kontrollen endres). Må ligge etter datasettets laveste gulv. */
export const expiredEpoch = () => epochIso(Date.now() - 8 * 86_400_000);
/** Epoken i fremtiden (skal avvises uten justering). */
export const futureEpoch = () => epochIso(Date.now() + 3_600_000);
/** Den innebygde standardepoken, lest fra kilden (uten å kjøre den). */
export function defaultEpoch(root = process.cwd()) {
  const m = /SYNTHETIC_DEFAULT_EPOCH = "(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)"/.exec(readFileSync(`${root}/src/providers/marketplace/synthetic/epoch.ts`, "utf8"));
  if (!m) throw new Error("fant ikke SYNTHETIC_DEFAULT_EPOCH");
  return m[1];
}
export const noDate = (epoch) => `${epoch.slice(8, 10)}.${epoch.slice(5, 7)}.${epoch.slice(0, 4)}`;
export const labelFor = (epoch) => `Syntetisk generert ${noDate(epoch)} — ikke hentet fra leverandør`;
/** Hva en server uten SCOUT_SYNTHETIC_EPOCH skal gjøre NÅ, utledet fra standardepoken (ingen tidsbombe): "fresh" | "expired" | "mixed". */
export function expectationForDefault(now = Date.now(), root = process.cwd()) {
  const e = Date.parse(defaultEpoch(root));
  if (now < e + 5 * 86_400_000) return "fresh";
  if (now >= e + 7 * 86_400_000) return "expired";
  return "mixed";
}
