/**
 * Lagringsrettigheter per provider (DEC-028). Rent domenelag: ingen I/O.
 *
 * En `StoragePolicy` er det som den gjeldende, verifiserte rettighetsprofilen tillater for en kjøring. Hva som
 * lagres bestemmes av policyen, aldri av en global antakelse. Det som ikke er uttrykkelig tillatt, lagres ikke.
 * Databasen håndhever det samme (trigger) som siste forsvarslinje.
 */
import type { ResultSnapshot } from "./search-run";

export interface StoragePolicy {
  profileVersion: number;
  /** Tillatt lagringstid i sekunder. */
  retentionSeconds: number;
  allowPrice: boolean;
  allowSpecs: boolean;
  allowText: boolean;
  allowImages: boolean;
  allowSellerData: boolean;
}

export type WithheldKind = "price" | "specs" | "seller";

/**
 * Fjerner fra resultatutdraget det profilen ikke tillater å lagre, og noterer hva som er holdt tilbake (`withheld`).
 * «Holdt tilbake» er noe annet enn «ikke oppgitt i annonsen»: begge blir `null`, men bare det første står i `withheld`.
 * Rang, treffstatus og kilde-ID (vår egen avledede vurdering og identitet) beholdes. Muterer ikke input.
 */
export function applyStoragePolicy(snapshot: ResultSnapshot, policy: StoragePolicy): ResultSnapshot {
  const withheld: WithheldKind[] = [];
  const out: ResultSnapshot = { ...snapshot, withheld };
  if (!policy.allowPrice) {
    out.price = null;
    withheld.push("price");
  }
  if (!policy.allowSpecs) {
    out.make = null;
    out.model = null;
    out.variant = null;
    out.firstRegistration = null;
    out.mileage = null;
    out.fuel = null;
    out.transmission = null;
    out.bodyType = null;
    withheld.push("specs");
  }
  if (!policy.allowSellerData) {
    out.sellerType = null;
    out.sellerCountry = null;
    withheld.push("seller");
  }
  return out;
}
