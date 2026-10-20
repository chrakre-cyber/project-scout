import "server-only";
/**
 * ECON-005d — forhandlerkontekst for økonomivisning. Leser (som innlogget bruker, under firmabundet RLS) søkets bekreftede forhandlerinput og firmaets standardprofil og gir
 * `EconomicsContext` til visningsgrensen. Firma og søk kommer fra validert sesjon og lagret utkast. Feil ved lesing gir tom kontekst (økonomi regnes uten forhandlerinput —
 * aldri med antatte verdier). Skriver ingenting; lagrer ingen avledede resultater.
 */
import { createDealerEconomicsStore } from "./dealer-economics-store";
import { loadDealerProfile, loadStoredInputsForSearch } from "./dealer-economics";
import type { EconomicsContext } from "./search-display";
import type { SessionContext } from "./session";

type Member = Extract<SessionContext, { status: "member" }>;

export async function loadEconomicsContext(ctx: Member, searchId: string): Promise<EconomicsContext> {
  const empty: EconomicsContext = { dealershipId: ctx.dealership.id, searchId, storedInputs: new Map(), profile: null };
  try {
    const store = createDealerEconomicsStore(ctx);
    const [storedInputs, profile] = await Promise.all([loadStoredInputsForSearch(store, { dealershipId: ctx.dealership.id, searchId }), loadDealerProfile(store, ctx.dealership.id)]);
    return { dealershipId: ctx.dealership.id, searchId, storedInputs, profile };
  } catch {
    return empty;
  }
}
