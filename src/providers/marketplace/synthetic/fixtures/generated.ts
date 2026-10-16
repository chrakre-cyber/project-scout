/**
 * 100 deterministisk genererte SYNTETISKE kildeposter (syn-001 – syn-100).
 *
 * Variasjonen styres av indeksen, ikke tilfeldighet, slik at datasettet er
 * stabilt mellom kjøringer og hver kanttilfelle-type garantert finnes:
 * ukjent/udokumentert prisgrunnlag, mva.-påstander, ustøttet valuta (USD),
 * ulike registreringspresisjoner, miles, manglende felt, ugyldige verdier som
 * skal bli null, en endret annonse (syn-010) og en duplikatpost (syn-020).
 *
 * Merker og modeller er generiske eksempler. Ingen ekte annonser.
 */
import type { SyntheticRawListing } from "../raw";

const MODELS = [
  { make: "Volkswagen", model: "Passat", variant: "Variant 2.0 TDI", body: "ESTATE", fuel: "DIESEL" },
  { make: "Volkswagen", model: "ID.4", variant: "Pro Performance", body: "SUV", fuel: "ELECTRIC" },
  { make: "Toyota", model: "Corolla", variant: "Touring Sports 1.8 Hybrid", body: "ESTATE", fuel: "HYBRID" },
  { make: "Volvo", model: "XC60", variant: "T6 Recharge", body: "SUV", fuel: "PLUGIN_HYBRID" },
  { make: "Skoda", model: "Superb", variant: "Combi 2.0 TSI", body: "ESTATE", fuel: "PETROL" },
  { make: "BMW", model: "3er", variant: "320d Touring", body: "ESTATE", fuel: "DIESEL" },
  { make: "Audi", model: "Q5", variant: "55 TFSI e quattro", body: "SUV", fuel: "PLUGIN_HYBRID" },
  { make: "Mercedes-Benz", model: "C-Klasse", variant: "C 300 e T-Modell", body: "ESTATE", fuel: "PLUGIN_HYBRID" },
  { make: "Tesla", model: "Model 3", variant: "Long Range", body: "SEDAN", fuel: "ELECTRIC" },
  { make: "Porsche", model: "911", variant: null, body: "COUPE", fuel: "PETROL" },
  { make: "Kia", model: "EV6", variant: "GT-Line AWD", body: "SUV", fuel: "ELECTRIC" },
  { make: "Peugeot", model: "308", variant: "SW 1.2 PureTech", body: "HATCHBACK", fuel: "PETROL" },
] as const;

const COUNTRIES = ["DE", "DE", "DE", "AT", "NL", "BE", "FR", "DE"] as const;
const CITIES = ["Hamburg", "Stuttgart", "Leipzig", "Wien", "Utrecht", "Gent", "Lyon", null] as const;
const COLORS = ["Grå", "Svart", "Hvit", "Blå", "Rød", null] as const;

const pad = (n: number, w = 3) => String(n).padStart(w, "0");

/** ISO-tidspunkt for et antall timer etter 2026-09-01T00:00Z. */
function hoursAfterStart(hours: number): string {
  return new Date(Date.UTC(2026, 8, 1) + hours * 3_600_000).toISOString().replace(".000Z", "Z");
}

function currencyFor(i: number): string {
  if (i % 25 === 0) return "USD"; // ustøttet valuta
  if (i % 33 === 0) return "CHF";
  if (i % 20 === 7) return "SEK";
  if (i === 41) return "GBP";
  if (i === 58) return "PLN";
  return "EUR";
}

function amountFor(i: number, currency: string): string {
  const base = 9_000 + ((i * 7_919) % 60_000);
  const rounded = base - (base % 10);
  const whole = currency === "SEK" ? rounded * 11 : rounded;
  return i % 8 === 0 ? `${whole}.50` : String(whole);
}

function priceFor(i: number): NonNullable<SyntheticRawListing["price"]> {
  const currency = currencyFor(i);
  const amount = amountFor(i, currency);
  switch (i % 5) {
    case 0:
      return { amount, currency, type: "GROSS", typeEvidence: "Preis inkl. MwSt." };
    case 1:
      return {
        amount, currency, type: "NET", typeEvidence: "Nettopreis",
        vat: { rate: "19", reclaimable: true, evidence: ["MwSt. ausweisbar"], origin: "FIELD" },
      };
    case 2:
      // Grunnlag påstått uten belegg → skal bli unknown.
      return { amount, currency, type: "GROSS", typeEvidence: null };
    case 3:
      // Mva.-påstand uten prisgrunnlag → prisgrunnlag forblir unknown.
      return { amount, currency, type: null, vat: { reclaimable: true, evidence: ["MwSt. ausweisbar"], origin: "TEXT" } };
    default:
      return {
        amount, currency, type: "GROSS", typeEvidence: "inkl. 19 % MwSt.",
        vat: { rate: "19", reclaimable: null, evidence: ["inkl. 19 % MwSt."], origin: "TEXT" },
      };
  }
}

function descriptionFor(i: number, price: NonNullable<SyntheticRawListing["price"]>): string | null {
  if (i % 4 === 0) return null;
  const quotes = [price.typeEvidence, ...(price.vat?.origin === "TEXT" ? price.vat.evidence ?? [] : [])]
    .filter((q): q is string => Boolean(q));
  return ["Syntetisk annonsetekst.", ...new Set(quotes), "Servicehefte oppgitt."].join(" ");
}

function firstRegistrationFor(i: number): string | null {
  if (i % 17 === 0) return null;
  if (i % 29 === 0) return "2021-13"; // ugyldig måned → null
  const year = 2016 + (i % 9);
  const month = pad((i % 12) + 1, 2);
  const day = pad((i % 27) + 1, 2);
  return i % 3 === 0 ? `${year}-${month}-${day}` : i % 3 === 1 ? `${year}-${month}` : String(year);
}

function generate(i: number): SyntheticRawListing {
  const m = MODELS[i % MODELS.length]!;
  const price = priceFor(i);
  const firstSeenHours = 200 + i * 5;
  return {
    id: `syn-${pad(i)}`,
    modifiedAt: i % 15 === 0 ? null : hoursAfterStart(firstSeenHours - 3),
    observed: {
      firstSeenAt: hoursAfterStart(firstSeenHours),
      lastSeenAt: hoursAfterStart(Math.min(firstSeenHours + (i % 10) * 24, 790)),
    },
    price: i % 37 === 0 ? { amount: "0", currency: "EUR" } : price, // 0 = ikke oppgitt pris
    vehicle: {
      make: m.make,
      model: m.model,
      variant: m.variant,
      firstRegistration: firstRegistrationFor(i),
      mileage: i % 11 === 0 ? null : { value: 5_000 + ((i * 3_571) % 140_000), unit: i % 13 === 0 ? "MI" : "KM" },
      fuel: i % 19 === 0 ? "LPG" : m.fuel, // ukjent kode → null
      gearbox: i % 6 === 0 ? "MANUAL" : i % 14 === 0 ? null : "AUTOMATIC",
      body: m.body,
      powerKw: i % 23 === 0 ? 0 : 80 + ((i * 13) % 250), // 0 → null
      co2: i % 7 === 0 ? null : { gramsPerKm: m.fuel === "ELECTRIC" ? 0 : 90 + (i % 80), method: i % 4 === 0 ? "NEDC" : i % 9 === 0 ? null : "WLTP" },
      weightKg: i % 5 === 0 ? null : 1_300 + ((i * 17) % 900),
      color: COLORS[i % COLORS.length]!,
    },
    description: descriptionFor(i, price),
    seller: i % 9 === 0 ? null : {
      type: i % 3 === 0 ? "PRIVATE" : i % 10 === 0 ? null : "DEALER",
      country: i % 31 === 0 ? "Germany" : COUNTRIES[i % COUNTRIES.length]!, // ugyldig kode → null
      city: CITIES[i % CITIES.length]!,
    },
  };
}

const base = Array.from({ length: 100 }, (_, k) => generate(k + 1));

/** Endret annonse: ny revisjon av syn-010 med lavere pris, ny tekst og senere modifiedAt. */
const syn010 = base[9]!;
const syn010Revision: SyntheticRawListing = {
  ...syn010,
  modifiedAt: hoursAfterStart(700),
  observed: { ...syn010.observed, lastSeenAt: hoursAfterStart(790) },
  price: { ...syn010.price!, amount: "19990" },
  description: `${syn010.description ?? "Syntetisk annonsetekst."} Pris redusert.`,
};

/** Duplikat: samme post levert to ganger av kilden. */
const syn020Duplicate: SyntheticRawListing = structuredClone(base[19]!);

export const generatedRawListings: SyntheticRawListing[] = [...base, syn010Revision, syn020Duplicate];
