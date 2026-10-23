/**
 * PILOT-003 — den KURATERTE syntetiske BMW iX3-demoen: identitet, strengt predikat og demoens EGEN gyldighetspolicy for kildedata. Server-modul, ren (ingen I/O).
 *
 * Hvorfor egen modul: `search-economics.ts` (orkestreringen) må selv avgjøre om en annonse er den kuraterte demobilen, og `demo-economics.ts` importerer fra orkestreringen — dette er den felles, avhengighetsfrie delen.
 *
 * Demoens gyldighetspolicy («curated_public_demo_static»): kildedatagrensen `rettighetsprofilens lagringstid etter observasjon` (syntetisk profil: 7 døgn) gjelder IKKE for den kuraterte demobilen.
 * Begrunnelse: demobilen er en fast, kuratert syntetisk post — ikke en leverandørobservasjon som eldes. Ingen falske ferske observasjoner lages; observasjonstiden er uendret og vises uendret.
 * Alt annet er uendret og gjelder fortsatt for demobilen: teknisk tak (24 t rullerende), avgiftsprofilens dokumenterte periode (slutt 2026-12-31), kursens gyldighet, rettighetsprofilens egen gyldighet/status
 * og alle øvrige kontroller. Policyen gjelder bare når `isCuratedDemoVehicle` er sann — som krever syntetisk kilde, syntetisk proveniens, syntetisk rettighetsprofil i kraft, id og at annonsens egne fakta stemmer. Ingen leverandør-,
 * sandbox- eller live-annonse og ingen annen syntetisk annonse kan oppfylle dette (en som ser lik ut avvises: kilde/proveniens/profil/fakta må stemme).
 */
import type { ResolvedRights } from "@/domain/provider-rights";
import type { NormalizedListing } from "@/domain/types";

/** Den kuraterte demobilen (DEMO-RESULTS-001). */
export const DEMO_VEHICLE = Object.freeze({ source: "synthetic-demo", sourceListingId: "dix3-001", make: "BMW", model: "iX3", variant: "Inspiring", firstRegistration: { year: 2024, month: 3 }, netPriceEur: "36950" } as const);

/**
 * Er dette den kuraterte syntetiske demobilen, og kan den få demoforutsetninger? Strengt og lukket: kilde, proveniens, miljø, id OG at annonsens fakta stemmer med forutsetningene.
 */
export function isCuratedDemoVehicle(listing: NormalizedListing, rights: ResolvedRights): boolean {
  if (!rights.inForce || rights.profile.environment !== "synthetic" || rights.profile.providerId !== DEMO_VEHICLE.source) return false;
  if (listing.source !== DEMO_VEHICLE.source || listing.sourceListingId !== DEMO_VEHICLE.sourceListingId || listing.provenance.kind !== "synthetic") return false;
  const p = listing.price, s = listing.specs, fr = s.firstRegistration;
  if (p === null || p.stated.currency !== "EUR" || p.stated.amount !== DEMO_VEHICLE.netPriceEur || p.basis !== "net" || !p.basisEvidence) return false;
  if (s.make !== DEMO_VEHICLE.make || s.model !== DEMO_VEHICLE.model || s.variant !== DEMO_VEHICLE.variant || s.fuel !== "electric") return false;
  return fr !== null && fr.precision === "month" && fr.year === DEMO_VEHICLE.firstRegistration.year && fr.month === DEMO_VEHICLE.firstRegistration.month;
}


/** Navnet på demoens gyldighetspolicy (synlig i kode, dokumentasjon og i gyldighetsgrensen). */
export const CURATED_DEMO_VALIDITY_POLICY = "curated_public_demo_static" as const;

/**
 * Gyldighetsgrensen for kildedata (`source_data`) i økonomivurderingen. Standard: observasjon + lagringstid (`defaultUntilIso`). Kuratert demobil: ingen kildedatagrense (`null` = ingen slutt for DENNE grensen;
 * de øvrige grensene i `computeValidUntil` gjelder uendret). Alle andre annonser får standarden.
 */
export function sourceDataValidityLimit(listing: NormalizedListing, rights: ResolvedRights, defaultUntilIso: string): { label: string; untilExclusive: string | null } {
  return isCuratedDemoVehicle(listing, rights) ? { label: CURATED_DEMO_VALIDITY_POLICY, untilExclusive: null } : { label: "source_data", untilExclusive: defaultUntilIso };
}
