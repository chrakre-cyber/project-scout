// ECON-006c — referanseverdier for nettleserforløpene. ALT her er B-Merovo-scenario / FIXTURE-KONVENSJON (kurs og kjøretøydata er testinput; halvt-opp-avrunding er fixturekonvensjon U-013,
// IKKE produksjonsregel; ingenting er validert mot offisiell kilde). Avgiftene (engangsavgift + vrakpant) er hentet fra de eksisterende gyldne fixturene (tests/fixtures/econ-golden.ts,
// `MEROVO_DEFAULT_EXPECTED[*].totalRegistrationTaxesNok`); en vitest-test (tests/economics-006c-reference.test.ts) kontrollerer at de er like og regner kjøpesum/mva. på nytt med eksakt
// heltallsaritmetikk, uavhengig av appens kode. Annonsene er syntetiske demoannonser (ikke mobile.de); kjøretøydata i skjemaet er fixtureinput fra CASE-001/-002/-003, ikke annonsens.
export const FX_RATE = "10.6709";
export const TRANSPORT_NOK = 8000;
export const EV_EXEMPTION_NOK = 300000; // fixture: vatExemptionNok i CASE-002 (anvendelsen er uavklart: R-IMP-VAT-003)
export const TAX_NOK = { diesel: 333723 /* CASE-003 */, phev: 529069 /* CASE-001 */, bev: 16748 /* CASE-002 */ };
export const LISTINGS = {
  diesel: { providerId: "demo-006", label: "Audi A6", priceEur: "36500" },
  phev: { providerId: "demo-002", label: "Toyota RAV4", priceEur: "41900" },
  bev: { providerId: "syn-056", label: "Tesla Model 3", priceEur: "32460.50" },
  /** Gir avrundingslikhet i mva. (585 082 × 25 % = 146 270,50): U-013 er uavklart ⇒ nedre grense, aldri punktestimat. */
  diesel2: { providerId: "syn-036", label: "Volkswagen Passat", priceEur: "54080" },
  /** Brukes til utløpt kurs. */
  diesel3: { providerId: "syn-096", label: "Volkswagen Passat", priceEur: "49220.50" },
  /** Brukes til delvis utfylling (manglende opplysninger). */
  missing: { providerId: "syn-011", label: "Peugeot 308", priceEur: "36100" },
};
/** Eksakt desimalaritmetikk med BigInt (skala 10^4 for kurs, 10^2 for pris). Halvt opp. */
const roundDiv = (n, d) => { const q = n / d, r = n % d; return r * 2n >= d ? q + 1n : q; };
const parseScaled = (s, scale) => { const [i, f = ""] = s.split("."); return BigInt(i) * 10n ** BigInt(scale) + BigInt(f.padEnd(scale, "0")); };
export function expected(kind) {
  const price = parseScaled(LISTINGS[kind].priceEur, 2), fx = parseScaled(FX_RATE, 4);
  const purchase = roundDiv(price * fx, 10n ** 6n);
  const customs = purchase + BigInt(TRANSPORT_NOK);
  const vat = (base) => (base > 0n ? roundDiv(base * 25n, 100n) : 0n);
  const tax = BigInt(TAX_NOK[kind === "diesel2" || kind === "diesel3" || kind === "missing" ? "diesel" : kind]);
  const cash = (v) => purchase + BigInt(TRANSPORT_NOK) + v + tax;
  const out = { purchase, customs, vat: vat(customs), tax, cash: cash(vat(customs)), vatTie: (customs * 25n) % 100n === 50n };
  if (out.vatTie) out.lowerBoundCash = out.cash - 1n; // kjernen bruker laveste kandidat når avrundingen er uavklart (nedre grense)
  if (kind === "bev") { out.vatWithExemption = vat(customs - BigInt(EV_EXEMPTION_NOK)); out.cashWithExemption = cash(out.vatWithExemption); }
  return out;
}
export const nok = (n) => `${BigInt(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
