import { RIGHTS_FIELD_KEYS, allRights, noEconomicsRights, noRights, type ProviderRightsProfile, type RightsFieldKey } from "@/domain/provider-rights";

/** Byggeklosser for rettighetsprofiler i tester. Alt er HYPOTETISK testdata; ingen leverandør har gitt noen av disse rettighetene. */
export function profile(over: Omit<Partial<ProviderRightsProfile>, "display" | "matching"> & { display?: Partial<Record<RightsFieldKey, boolean>>; matching?: Partial<Record<RightsFieldKey, boolean>> } = {}): ProviderRightsProfile {
  const { display, matching, ...rest } = over;
  return {
    providerId: "synthetic-demo", // kilden testene kjører mot; en kjøring mot annen kilde avvises uansett av kandidatadapteren
    environment: "synthetic",
    version: 1,
    status: "verified",
    validFrom: "2026-10-01T00:00:00Z",
    validUntil: null,
    sourceRef: "TESTFIXTURE — hypotetisk profil, ingen avtale",
    verifiedBy: "test", verifiedAt: "2026-10-02T00:00:00Z",
    providerName: "Testkilde",
    display: { ...allRights(), images: false, ...display },
    matching: { ...allRights(), images: false, ...matching },
    storage: { retentionSeconds: 3600, cacheSeconds: 0, historyRetentionSeconds: 0, storable: { price: true, specs: true, text: false, images: false, sellerData: true } },
    usage: { multiCustomerReuse: false, reEvaluation: false, alerts: false },
    geography: { unrestricted: true, countries: [] },
    attribution: { required: true, text: "Testattribusjon" },
    deepLinkRequired: false,
    onRevocation: "hide_and_purge",
    derivedEconomics: { allow: noEconomicsRights(), display: false }, // default nei (ECON-005b)
    ...rest,
  };
}

/**
 * EKSEMPEL/FIXTURE — ikke en avtale. Viser hvordan en sandbox-profil for mobile.de *ville* se ut mens vilkårene ikke er lest:
 * utkast, ingen visning, ingen matching, ingen lagring, ingen gjenbruk. Rettigheter mobile.de ikke har gitt er IKKE påstått.
 * Den er ikke registrert i `REGISTERED_PROFILES` og brukes aldri av kjøretidskoden.
 */
export const MOBILE_SANDBOX_EXAMPLE: ProviderRightsProfile = Object.freeze({
  providerId: "mobile-sandbox",
  environment: "sandbox",
  version: 1,
  status: "draft",
  validFrom: "2026-10-16T00:00:00Z",
  validUntil: null,
  sourceRef: "EKSEMPEL: sandbox-vilkår er ikke lest eller registrert",
  verifiedBy: null, verifiedAt: null,
  providerName: null,
  display: Object.freeze(noRights()),
  matching: Object.freeze(noRights()),
  storage: Object.freeze({ retentionSeconds: 0, cacheSeconds: 0, historyRetentionSeconds: 0, storable: Object.freeze({ price: false, specs: false, text: false, images: false, sellerData: false }) }),
  usage: Object.freeze({ multiCustomerReuse: false, reEvaluation: false, alerts: false }),
  geography: Object.freeze({ unrestricted: false, countries: Object.freeze([]) as readonly string[] }),
  attribution: Object.freeze({ required: true, text: null }),
  deepLinkRequired: false,
  onRevocation: "hide_and_purge",
  derivedEconomics: Object.freeze({ allow: Object.freeze(noEconomicsRights()), display: false }),
}) as ProviderRightsProfile;

export { RIGHTS_FIELD_KEYS };
