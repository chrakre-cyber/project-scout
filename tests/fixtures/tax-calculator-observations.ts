/**
 * Skjermbildeobservasjoner fra Skatteetatens importkalkulator, 18.10.2026 (ECON-002; GR-20261018-01…03).
 * Verdiene er transkribert fra originalbildene i docs/tax/golden-runs/2026-10-18/ (SHA-256 i MANIFEST.json) og kontrollert visuelt.
 * Bruk: valideringsreferanse for motoren — aldri regelkilde eller kalibreringsmål. Ingen klasse 1 er registrert (se REGISTRERING.md).
 * Kjøredato og «norsk registreringsdato» (kalkulatorens automatiske dagsdato) er BRUKERBEKREFTET, ikke synlig i bildene.
 */
import type { TaxInput } from "@/domain/tax";

export const RUN_DATE = "2026-10-18";

export interface ObservedPriceVersion {
  /** Innkjøpspris slik bildet viser den (NOK). */
  priceNok: number;
  file: string;
  /** true bare når bildet viser alle inputfelt som ga resultatet (ingen antakelse om uendrede felt). */
  fullInputDocumented: boolean;
  /** Visningsverdier (to desimaler) fra «Slik beregnes avgiftene»; null = ikke vist i denne versjonen. */
  breakdown: { scrappage: string; oneOff: string; total: string } | null;
  totalAvgift: string;
  vat: string;
}

export interface ObservedRun {
  id: string;
  label: string;
  /** Det motoren kjøres med. Hvert avvik fra det som er observert står i `assumptions`. */
  input: TaxInput;
  /** Observert input (etikett → verdi) fra inputbildet. */
  observedInputs: Record<string, string>;
  assumptions: string[];
  versions: ObservedPriceVersion[];
  expectedTotalNok: number;
}

const NOR = { date: RUN_DATE, kind: "expected" as const, defaulted: true };
const base = { vehicleClass: "passenger_car_m1", norwegianRegistration: NOR } as const;
const dir = "docs/tax/golden-runs/2026-10-18";

export const OBSERVED_RUNS: readonly ObservedRun[] = [
  {
    id: "GR-20261018-01",
    label: "PHEV (testetikett Urus)",
    expectedTotalNok: 529069,
    input: {
      ...base,
      propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "dealer_entered" },
      norwegianTaxWeight: { kg: 2610, basis: "dealer_entered" },
      co2: { gramsPerKm: 140, method: "wltp_weighted_combined" },
      firstRegistration: { precision: "day", value: "2026-09-01" },
    },
    observedInputs: { Kjøretøy: "Personbil", Personbiltype: "Ladbar hybridbil", "Brukt kjøretøy": "Ja", "Registrert i utlandet": "01.09.2026", "CO2-utslipp (ja/nei)": "Ja", "CO2-utslipp": "140 g/km", "Målemetode for CO2": "WLTP", Innkjøpspris: "600 000 NOK", "Drivstoff-type": "Bensin", Egenvekt: "2 610 kg" },
    assumptions: [
      "Ladbar hybridbil ⇒ stempeldrevet motor + ekstern lading (utledet fra valg i kalkulatoren, ikke teknisk bevis; evidence=dealer_entered)",
      "Målemetode «WLTP» ⇒ wltp_weighted_combined (testintensjon; feltetiketten «vektet kombinert» er ikke synlig; motoren blokkerer wltp_combined for PHEV)",
      "Egenvekt 2 610 kg: definisjon ukjent (dealer_entered)",
      "Norsk registreringsdato = kalkulatorens automatiske dagsdato 2026-10-18 (brukerbekreftet)",
      "Alternativ beregning (steg 11) ikke synlig i inputbildet",
    ],
    versions: [
      { priceNok: 600000, file: `${dir}/01_PHEV/02_input_pris_600000.png`, fullInputDocumented: false, breakdown: null, totalAvgift: "529069.00", vat: "150000.00" },
      { priceNok: 2600000, file: `${dir}/01_PHEV/03_nedbrytning_pris_2600000.png`, fullInputDocumented: false, breakdown: { scrappage: "2400.00", oneOff: "526669.74", total: "529069.00" }, totalAvgift: "529069.00", vat: "650000.00" },
    ],
  },
  {
    id: "GR-20261018-02",
    label: "Elbil (testetikett iX3)",
    expectedTotalNok: 16748,
    input: {
      ...base,
      propulsion: { pistonCombustionEngine: false, externallyChargeable: true, evidence: "dealer_entered" },
      norwegianTaxWeight: { kg: 2185, basis: "dealer_entered" },
      co2: { gramsPerKm: 0, method: "wltp_combined" },
      firstRegistration: { precision: "day", value: "2023-08-01" },
    },
    observedInputs: { Kjøretøy: "Personbil", Personbiltype: "Elbil - personbil", "Brukt kjøretøy": "Ja", "Registrert i utlandet": "01.08.2023", Innkjøpspris: "350 000 NOK", Egenvekt: "2 185 kg", "Alternativ beregning (valgfritt)": "ikke utfylt" },
    assumptions: [
      "Kalkulatoren viser ikke CO₂-felt for elbil; CO₂ 0 g/km er IKKE observert (motoren gir samme resultat med null/ukjent CO₂ for elbil)",
      "Elbil ⇒ ingen stempeldrevet motor, ekstern lading (utledet fra valget, ikke teknisk bevis)",
      "Egenvekt 2 185 kg: definisjon ukjent (dealer_entered)",
      "Norsk registreringsdato = kalkulatorens automatiske dagsdato 2026-10-18 (brukerbekreftet)",
    ],
    versions: [
      { priceNok: 350000, file: `${dir}/02_EV/02_input_pris_350000.png`, fullInputDocumented: true, breakdown: null, totalAvgift: "16748.00", vat: "12500.00" },
      { priceNok: 300000, file: `${dir}/02_EV/03_nedbrytning_pris_300000.png`, fullInputDocumented: false, breakdown: { scrappage: "2400.00", oneOff: "14348.95", total: "16748.00" }, totalAvgift: "16748.00", vat: "0.00" },
    ],
  },
  {
    id: "GR-20261018-03",
    label: "Diesel (testetikett E 400 d)",
    expectedTotalNok: 333723,
    input: {
      ...base,
      propulsion: { pistonCombustionEngine: true, externallyChargeable: false, evidence: "dealer_entered" },
      norwegianTaxWeight: { kg: 1976, basis: "dealer_entered" },
      co2: { gramsPerKm: 179, method: "wltp_combined" },
      firstRegistration: { precision: "day", value: "2023-11-01" },
    },
    observedInputs: { Kjøretøy: "Personbil", Personbiltype: "Bensin/dieselbil", "Brukt kjøretøy": "Ja", "Registrert i utlandet": "01.11.2023", "CO2-utslipp (ja/nei)": "Ja", "CO2-utslipp": "179 g/km", "Målemetode for CO2": "WLTP", Innkjøpspris: "350 000 NOK", "Drivstoff-type": "Diesel", Egenvekt: "1 976 kg", "Alternativ beregning (valgfritt)": "ikke utfylt" },
    assumptions: [
      "Bensin/dieselbil + drivstoff Diesel ⇒ stempeldrevet motor, ikke ladbar (utledet fra valg, ikke teknisk bevis)",
      "Målemetode «WLTP» ⇒ wltp_combined (feltetiketten «kombinert» er ikke synlig)",
      "Egenvekt 1 976 kg: definisjon ukjent (dealer_entered)",
      "Norsk registreringsdato = kalkulatorens automatiske dagsdato 2026-10-18 (brukerbekreftet)",
    ],
    versions: [
      { priceNok: 350000, file: `${dir}/03_DIESEL/02_input_pris_350000.png`, fullInputDocumented: true, breakdown: { scrappage: "2400.00", oneOff: "331323.97", total: "333723.00" }, totalAvgift: "333723.00", vat: "87500.00" },
    ],
  },
];
