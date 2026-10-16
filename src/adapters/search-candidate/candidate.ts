/**
 * SEARCH-004 — kandidatadapter: `NormalizedListing` (syntetisk provider) → `CandidateV2` (søkemodell v1).
 *
 * Ren TypeScript utenfor domenet; brukes i denne oppgaven bare gjennom tester. Ingen nettverk, ingen AI/regex/gjetting
 * på fritekst, ingen kobling til UI, pipeline, agenter, lagring eller provider-kontrakten. Domenet importerer aldri denne modulen.
 *
 * KILDEFELT → KANDIDATFELT
 *   specs.make/model        → brandKey/modelKey via eksplisitt mapping (se mapping.ts); ikke mappet ⇒ null + forklaring
 *   specs.variant           → variant (fritekst bevart som data; utstyr/pakker utledes aldri av den)
 *   specs.firstRegistration → firstRegistration (år/måned/dato-presisjon bevart; kalenderdato valideres)
 *   specs.mileage           → mileageKm (km bevart; miles × 1,609344 eksakt, se «Kilometer»)
 *   specs.fuel/transmission/bodyType → samme enum-verdi (null forblir null; «other» bare når kilden sa OTHER)
 *   specs.color             → exteriorColor via mapping
 *   (finnes ikke i NormalizedListing) modelYear, seats, driveTrain, interiorColor, interiorMaterial, equipment,
 *   packages, currentCategory → alltid null, med forklaring `not_in_source_model`
 *   Karosseri «van» sier ingenting om nåværende registreringskategori eller ønsket norsk scenario.
 *
 * KILOMETER. km bevares som heltall. Miles: km = miles × 1 609 344 / 1 000 000, regnet som EKSAKT heltall i mikro-km og
 * deretter ÉN korrekt avrundet divisjon (IEEE 754), uten avrunding til hele km. For kilometerstander ≤ 1 000 000 000 km
 * (ulp < 1,2·10⁻⁷ < halvparten av minste mulige avstand 10⁻⁶ til et heltall) gjelder: `mileageKm <= grense` ⇔ den eksakte
 * rasjonale verdien ≤ grensen (heltallsgrenser). Større verdier representeres ikke forsvarlig: mileageKm = null med forklaring
 * `unrepresentable` (aldri rundet ned til treff). Null = ukjent; eksplisitt 0 = kjent 0 km.
 *
 * IDENTITET. `id = <source.length>:<source>/<sourceListingId>` — lengdeprefikset gjør sammensetningen injektiv for alle
 * strenger (separatorer og Unicode), uten normalisering av kilde-ID. Samme annonse ⇒ samme id ved ny observasjon.
 *
 * REVISJON. `version = "rev1:" + SHA-256(kanonisk JSON)` over: revisjonskontrakt, mappingens sourceId+versjon, identitet,
 * mappede nøkler, og alt kildegrunnlag som kan påvirke vurdering/kostnad senere (pris inkl. beløp, valuta, prisgrunnlag og belegg,
 * mva.-opplysninger, spesifikasjoner, annonsetekst, selger, original-URL, kildens endringstid, provenance-art).
 * UTENFOR: observasjonstidspunkt (firstSeenAt/lastSeenAt), provenance-beskrivelse og normaliseringsnotater. Ingen nåtid,
 * tilfeldighet eller «bare sourceModifiedAt». Deterministisk: samme innhold ⇒ samme revisjon.
 *
 * Adapteren lager aldri en CostAssessment. Annonsepris er aldri totalpris til Norge.
 */
import { toMoney } from "@/domain/currency";
import { parseUtcInstant } from "@/domain/search-v2/budget";
import { firstRegistrationIssue } from "@/domain/search-v2/validation";
import { BODY_TYPES, FUELS, TRANSMISSIONS } from "@/domain/search-v2/types";
import type { CandidateV2, Issue, SearchCatalog } from "@/domain/search-v2/types";
import { buildCandidateMapping } from "./mapping";
import type { CandidateMapping } from "./mapping";
import { sha256Hex } from "./sha256";

export const REVISION_CONTRACT = "search-candidate-revision/1";
/** Grense for forsvarlig representasjon av kilometerstand i `number` (se dokumentasjonen over). */
export const MAX_REPRESENTABLE_KM = 1_000_000_000;
const MICRO_KM_PER_MILE = 1_609_344;
const MAX_MILES = Math.floor((MAX_REPRESENTABLE_KM * 1_000_000) / MICRO_KM_PER_MILE); // 621 371 192

export interface CandidateExplanation {
  field: keyof CandidateV2;
  code: "not_in_source_model" | "not_stated" | "unmapped" | "requires_mapped_brand" | "unrepresentable";
  message: string;
  /** Kildens verdi (data, ikke instruks) når forklaringen gjelder en konkret verdi. */
  sourceValue?: string;
}

export interface CandidateMeta {
  source: string;
  sourceListingId: string;
  /** true når annonsen er merket syntetisk av kilden/normaliseringen. Ingen påstand om live mobile.de-data. */
  synthetic: boolean;
  provenance: { kind: "synthetic" | "provider"; description: string; normalizationNotes: string[] };
  mapping: { sourceId: string; version: string };
  sourceModifiedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Annonseprisen slik kilden oppga den. IKKE total innkjøpskostnad til Norge og ikke et budsjettreff. */
  statedPrice: { amount: string; currency: string; basis: "gross" | "net" | "unknown"; basisEvidence: string | null; vat: { statedRateBasisPoints: number | null; reclaimableClaim: string; origin: string; evidence: string[] } } | null;
  explanations: CandidateExplanation[];
  revisionContract: string;
}

export type CandidateResult =
  | { ok: true; candidate: CandidateV2; meta: CandidateMeta }
  | { ok: false; issues: Issue[] };

export interface CandidateAdapter {
  readonly mapping: { sourceId: string; version: string };
  adapt(listing: unknown): CandidateResult;
}

export type CandidateAdapterResult = { ok: true; adapter: CandidateAdapter } | { ok: false; issues: Issue[] };

export function buildCandidateAdapter(mappingData: unknown, catalog: SearchCatalog): CandidateAdapterResult {
  const m = buildCandidateMapping(mappingData, catalog);
  if (!m.ok) return m;
  const mapping = m.mapping;
  return { ok: true, adapter: { mapping: { sourceId: mapping.sourceId, version: mapping.version }, adapt: (listing) => adaptListing(listing, mapping) } };
}

// ---------------------------------------------------------------- hjelpere

type Rec = Record<string, unknown>;
const isPlain = (x: unknown): x is Rec => {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const p = Object.getPrototypeOf(x);
  return p === Object.prototype || p === null;
};
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);

/** Kilometerstand i km som `number`, eller null når den ikke kan representeres forsvarlig. */
export function mileageToKm(value: number, unit: "km" | "mi"): number | null {
  if (unit === "km") return value <= MAX_REPRESENTABLE_KM ? value : null;
  if (value > MAX_MILES) return null;
  return (value * MICRO_KM_PER_MILE) / 1_000_000; // eksakt heltall i mikro-km, så én korrekt avrundet divisjon
}

/** Entydig kandidat-id for source + sourceListingId (lengdeprefiks ⇒ injektiv for alle strenger). */
export function candidateId(source: string, sourceListingId: string): string {
  return `${source.length}:${source}/${sourceListingId}`;
}

// ---------------------------------------------------------------- validering av kildeposten

const LISTING_KEYS = ["source", "sourceListingId", "originalUrl", "sourceModifiedAt", "firstSeenAt", "lastSeenAt", "price", "specs", "text", "seller", "provenance"];
const SPEC_KEYS = ["make", "model", "variant", "firstRegistration", "mileage", "fuel", "transmission", "bodyType", "powerKw", "co2", "curbWeightKg", "color"];

interface Checked {
  source: string; sourceListingId: string; originalUrl: string | null; sourceModifiedAt: string | null; firstSeenAt: string; lastSeenAt: string;
  price: NonNullable<CandidateMeta["statedPrice"]> & { amountMoney: { amountMinor: number; currency: string } | null } | null;
  specs: {
    make: string; model: string; variant: string | null; firstRegistration: CandidateV2["firstRegistration"];
    mileage: { value: number; unit: "km" | "mi" } | null; fuel: CandidateV2["fuel"]; transmission: CandidateV2["transmission"]; bodyType: CandidateV2["bodyType"];
    powerKw: number | null; co2: { gramsPerKm: number; testMethod: string } | null; curbWeightKg: number | null; color: string | null;
  };
  text: string | null;
  seller: { type: string; countryCode: string | null; city: string | null } | null;
  provenance: { kind: "synthetic" | "provider"; description: string; normalizationNotes: string[] };
}

function check(input: unknown, mapping: CandidateMapping): { ok: true; v: Checked } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => { issues.push({ path, code, message }); };
  const obj = (v: unknown, path: string, keys: readonly string[]): Rec | null => {
    if (!isPlain(v)) { add(path, "not_object", "Må være et objekt."); return null; }
    let ok = true;
    for (const k of Object.keys(v)) if (!keys.includes(k)) { add(path ? `${path}.${k}` : k, "unknown_key", "Ukjent nøkkel (adapteren må oppdateres når kildemodellen endres)."); ok = false; }
    for (const k of keys) if (!Object.hasOwn(v, k)) { add(path ? `${path}.${k}` : k, "missing_key", "Påkrevd nøkkel mangler."); ok = false; }
    return ok ? v : null;
  };
  const str = (v: unknown, path: string, opts: { nonEmpty?: boolean } = {}): string | null => {
    if (typeof v !== "string") { add(path, "not_string", "Må være tekst."); return null; }
    if (LONE_SURROGATE.test(v)) { add(path, "ill_formed_unicode", "Teksten har ugyldig Unicode (enslig surrogat)."); return null; }
    if (opts.nonEmpty && v.trim() === "") { add(path, "empty", "Kan ikke være tom."); return null; }
    return v;
  };
  const strOrNull = (v: unknown, path: string): string | null => (v === null ? null : str(v, path));
  const oneOf = <T extends string>(v: unknown, path: string, allowed: readonly T[], nullable: boolean): T | null => {
    if (v === null && nullable) return null;
    if (typeof v !== "string" || !allowed.includes(v as T)) { add(path, "invalid_enum", `Ugyldig verdi; tillatt: ${allowed.join(", ")}${nullable ? " eller null" : ""}.`); return null; }
    return v as T;
  };
  const instant = (v: unknown, path: string): string | null => {
    const s = str(v, path);
    if (s === null) return null;
    if (parseUtcInstant(s) === null) { add(path, "invalid_timestamp", "Ugyldig UTC-tidspunkt (ISO 8601)."); return null; }
    return s;
  };

  const top = obj(input, "", LISTING_KEYS);
  if (!top) return { ok: false, issues };
  const source = str(top.source, "source", { nonEmpty: true });
  const sourceListingId = str(top.sourceListingId, "sourceListingId", { nonEmpty: true });
  if (source !== null && source !== mapping.sourceId) add("source", "source_mismatch", `Annonsen kommer fra «${source}», men mappingen gjelder «${mapping.sourceId}».`);
  const originalUrl = strOrNull(top.originalUrl, "originalUrl");
  const sourceModifiedAt = top.sourceModifiedAt === null ? null : instant(top.sourceModifiedAt, "sourceModifiedAt");
  const firstSeenAt = instant(top.firstSeenAt, "firstSeenAt");
  const lastSeenAt = instant(top.lastSeenAt, "lastSeenAt");
  if (firstSeenAt && lastSeenAt && parseUtcInstant(lastSeenAt)! < parseUtcInstant(firstSeenAt)!) add("lastSeenAt", "before_first_seen", "lastSeenAt er før firstSeenAt.");
  const text = strOrNull(top.text, "text");

  // ---- spesifikasjoner
  const s = obj(top.specs, "specs", SPEC_KEYS);
  let specs: Checked["specs"] | null = null;
  if (s) {
    const make = str(s.make, "specs.make");
    const model = str(s.model, "specs.model");
    const variant = strOrNull(s.variant, "specs.variant");
    let firstRegistration: CandidateV2["firstRegistration"] = null;
    if (s.firstRegistration !== null) {
      const e = firstRegistrationIssue(s.firstRegistration);
      if (e) add("specs.firstRegistration", "invalid_date", e);
      else firstRegistration = { ...(s.firstRegistration as object) } as CandidateV2["firstRegistration"];
    }
    let mileage: Checked["specs"]["mileage"] = null;
    if (s.mileage !== null) {
      const mo = obj(s.mileage, "specs.mileage", ["value", "unit"]);
      if (mo) {
        const unit = oneOf(mo.unit, "specs.mileage.unit", ["km", "mi"] as const, false);
        if (!isInt(mo.value) || mo.value < 0) add("specs.mileage.value", "invalid_number", "Må være et heltall ≥ 0.");
        else if (unit) mileage = { value: mo.value, unit };
      }
    }
    const fuel = oneOf(s.fuel, "specs.fuel", FUELS, true);
    const transmission = oneOf(s.transmission, "specs.transmission", TRANSMISSIONS, true);
    const bodyType = oneOf(s.bodyType, "specs.bodyType", BODY_TYPES, true);
    const posOrNull = (v: unknown, path: string): number | null => {
      if (v === null) return null;
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) { add(path, "invalid_number", "Må være et positivt tall eller null."); return null; }
      return v;
    };
    const powerKw = posOrNull(s.powerKw, "specs.powerKw");
    const curbWeightKg = posOrNull(s.curbWeightKg, "specs.curbWeightKg");
    let co2: Checked["specs"]["co2"] = null;
    if (s.co2 !== null) {
      const co = obj(s.co2, "specs.co2", ["gramsPerKm", "testMethod"]);
      if (co) {
        const tm = oneOf(co.testMethod, "specs.co2.testMethod", ["WLTP", "NEDC", "unknown"] as const, false);
        if (typeof co.gramsPerKm !== "number" || !Number.isFinite(co.gramsPerKm) || co.gramsPerKm < 0) add("specs.co2.gramsPerKm", "invalid_number", "Må være et tall ≥ 0.");
        else if (tm) co2 = { gramsPerKm: co.gramsPerKm, testMethod: tm };
      }
    }
    const color = strOrNull(s.color, "specs.color");
    if (make !== null && model !== null) specs = { make, model, variant, firstRegistration, mileage, fuel, transmission, bodyType, powerKw, co2, curbWeightKg, color };
  }

  // ---- pris (inngår i revisjonen og valideres derfor fullt ut)
  let price: Checked["price"] = null;
  if (top.price !== null) {
    const po = obj(top.price, "price", ["stated", "amount", "basis", "basisEvidence", "vat"]);
    if (po) {
      const st = obj(po.stated, "price.stated", ["amount", "currency"]);
      let stated: { amount: string; currency: string } | null = null;
      if (st) {
        const amount = str(st.amount, "price.stated.amount");
        const currency = str(st.currency, "price.stated.currency");
        if (amount !== null && !/^\d+(\.\d+)?$/.test(amount)) add("price.stated.amount", "invalid_amount", "Må være en desimalstreng («32490» eller «32490.50»).");
        else if (currency !== null && !/^[A-Z]{3}$/.test(currency)) add("price.stated.currency", "invalid_currency", "Må være en ISO 4217-kode (tre store bokstaver).");
        else if (amount !== null && currency !== null) stated = { amount, currency };
      }
      let money: { amountMinor: number; currency: string } | null = null;
      let moneyOk = true;
      if (po.amount !== null) {
        const mo = obj(po.amount, "price.amount", ["amountMinor", "currency"]);
        if (mo) {
          if (!isInt(mo.amountMinor) || mo.amountMinor < 0) { add("price.amount.amountMinor", "invalid_amount", "Må være et heltall ≥ 0 (minste enhet)."); moneyOk = false; }
          const cur = str(mo.currency, "price.amount.currency");
          if (cur === null) moneyOk = false;
          if (moneyOk) money = { amountMinor: mo.amountMinor as number, currency: cur! };
        } else moneyOk = false;
      }
      if (stated && moneyOk) {
        const expected = toMoney(stated.amount, stated.currency);
        const same = expected === null ? money === null : money !== null && money.amountMinor === expected.amountMinor && money.currency === expected.currency;
        if (!same) add("price.amount", "inconsistent", "price.amount stemmer ikke med price.stated (beløp/valuta).");
      }
      const basis = oneOf(po.basis, "price.basis", ["gross", "net", "unknown"] as const, false);
      const basisEvidence = strOrNull(po.basisEvidence, "price.basisEvidence");
      if (basis === "unknown" && basisEvidence !== null) add("price.basisEvidence", "inconsistent", "Ukjent prisgrunnlag kan ikke ha belegg.");
      if ((basis === "gross" || basis === "net") && (basisEvidence === null || basisEvidence.trim() === "")) add("price.basisEvidence", "inconsistent", "Brutto/netto krever ordrett belegg (DEC-019).");
      const vo = obj(po.vat, "price.vat", ["statedRateBasisPoints", "reclaimableClaim", "evidence", "origin"]);
      let vat: NonNullable<Checked["price"]>["vat"] | null = null;
      if (vo) {
        const rate = vo.statedRateBasisPoints;
        if (rate !== null && (!isInt(rate) || rate < 0 || rate > 10000)) add("price.vat.statedRateBasisPoints", "invalid_number", "Må være 0–10 000 basispunkter eller null.");
        const claim = oneOf(vo.reclaimableClaim, "price.vat.reclaimableClaim", ["claimed", "denied", "unknown"] as const, false);
        const origin = oneOf(vo.origin, "price.vat.origin", ["structured_field", "listing_text", "none"] as const, false);
        let evidence: string[] = [];
        if (!Array.isArray(vo.evidence)) add("price.vat.evidence", "not_array", "Må være en liste.");
        else {
          const ev = vo.evidence.map((e, i) => str(e, `price.vat.evidence[${i}]`, { nonEmpty: true }));
          if (ev.every((e) => e !== null)) evidence = ev as string[];
        }
        const hasStatement = rate !== null || claim !== "unknown";
        if (claim && origin) {
          if (!hasStatement && (origin !== "none" || evidence.length > 0)) add("price.vat", "inconsistent", "Uten mva.-opplysning må opphav være «none» og belegg tomt.");
          if (hasStatement && (origin === "none" || evidence.length === 0)) add("price.vat", "inconsistent", "En mva.-opplysning krever belegg og opphav (DEC-019).");
        }
        if (claim && origin && (rate === null || (isInt(rate) && rate >= 0 && rate <= 10000))) vat = { statedRateBasisPoints: rate as number | null, reclaimableClaim: claim, origin, evidence };
      }
      if (stated && moneyOk && basis && vat) {
        price = { amount: stated.amount, currency: stated.currency, basis, basisEvidence, vat, amountMoney: money };
      }
    }
  }

  // ---- selger og provenance
  let seller: Checked["seller"] = null;
  if (top.seller !== null) {
    const so = obj(top.seller, "seller", ["type", "countryCode", "city"]);
    if (so) {
      const type = oneOf(so.type, "seller.type", ["dealer", "private", "unknown"] as const, false);
      const countryCode = strOrNull(so.countryCode, "seller.countryCode");
      if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) add("seller.countryCode", "invalid_value", "Må være to store bokstaver eller null.");
      const city = strOrNull(so.city, "seller.city");
      if (type) seller = { type, countryCode, city };
    }
  }
  let provenance: Checked["provenance"] | null = null;
  const pv = obj(top.provenance, "provenance", ["kind", "description", "normalizationNotes"]);
  if (pv) {
    const kind = oneOf(pv.kind, "provenance.kind", ["synthetic", "provider"] as const, false);
    const description = str(pv.description, "provenance.description");
    let notes: string[] = [];
    if (!Array.isArray(pv.normalizationNotes)) add("provenance.normalizationNotes", "not_array", "Må være en liste.");
    else {
      const n = pv.normalizationNotes.map((x, i) => str(x, `provenance.normalizationNotes[${i}]`));
      if (n.every((x) => x !== null)) notes = n as string[];
    }
    if (kind && description !== null) provenance = { kind, description, normalizationNotes: notes };
  }

  if (issues.length || !source || !sourceListingId || !firstSeenAt || !lastSeenAt || !specs || !provenance) return { ok: false, issues: issues.length ? issues : [{ path: "", code: "invalid_structure", message: "Ugyldig struktur." }] };
  return { ok: true, v: { source, sourceListingId, originalUrl, sourceModifiedAt, firstSeenAt, lastSeenAt, price, specs, text, seller, provenance } };
}

// ---------------------------------------------------------------- konvertering

export function adaptListing(input: unknown, mapping: CandidateMapping): CandidateResult {
  try {
    const c = check(input, mapping);
    if (!c.ok) return { ok: false, issues: c.issues };
    const v = c.v;
    const explanations: CandidateExplanation[] = [];
    const explain = (field: keyof CandidateV2, code: CandidateExplanation["code"], message: string, sourceValue?: string) =>
      explanations.push(sourceValue === undefined ? { field, code, message } : { field, code, message, sourceValue });

    // merke/modell: eksakt mapping; modell bare under mappet merke
    let brandKey: string | null = null;
    let modelKey: string | null = null;
    if (v.specs.make.trim() === "") explain("brandKey", "not_stated", "Kilden oppgir ikke merke.");
    else {
      brandKey = mapping.brand(v.specs.make);
      if (brandKey === null) explain("brandKey", "unmapped", `Kildemerket er ikke mappet til katalogen (mapping ${mapping.sourceId} v${mapping.version}).`, v.specs.make);
    }
    if (brandKey === null) explain("modelKey", "requires_mapped_brand", "Modell mappes bare under et mappet merke; ingen modell er antatt.", v.specs.model);
    else {
      modelKey = v.specs.model.trim() === "" ? null : mapping.model(brandKey, v.specs.model);
      if (modelKey === null) explain("modelKey", v.specs.model.trim() === "" ? "not_stated" : "unmapped", "Kildemodellen er ikke mappet til katalogen under dette merket.", v.specs.model);
    }
    if (v.specs.variant === null) explain("variant", "not_stated", "Kilden oppgir ikke variant.");

    // førstegangsregistrering
    if (v.specs.firstRegistration === null) explain("firstRegistration", "not_stated", "Kilden oppgir ikke førstegangsregistrering.");

    // kilometer
    let mileageKm: number | null = null;
    if (v.specs.mileage === null) explain("mileageKm", "not_stated", "Kilden oppgir ikke kilometerstand.");
    else {
      mileageKm = mileageToKm(v.specs.mileage.value, v.specs.mileage.unit);
      if (mileageKm === null) explain("mileageKm", "unrepresentable", `Kilometerstanden kan ikke representeres forsvarlig (> ${MAX_REPRESENTABLE_KM} km).`, `${v.specs.mileage.value} ${v.specs.mileage.unit}`);
    }

    for (const [field, value] of [["fuel", v.specs.fuel], ["transmission", v.specs.transmission], ["bodyType", v.specs.bodyType]] as const) {
      if (value === null) explain(field, "not_stated", `Kilden oppgir ikke ${field}, eller koden var ukjent for normaliseringen.`);
    }

    // farge
    let exteriorColor: string | null = null;
    if (v.specs.color === null) explain("exteriorColor", "not_stated", "Kilden oppgir ikke farge.");
    else {
      exteriorColor = v.specs.color.trim() === "" ? null : mapping.exteriorColor(v.specs.color);
      if (exteriorColor === null) explain("exteriorColor", "unmapped", "Kildefargen er ikke mappet til katalogen.", v.specs.color);
    }

    // felt som ikke finnes i dagens kildemodell
    for (const field of ["modelYear", "seats", "driveTrain", "interiorColor", "interiorMaterial", "equipment", "packages", "currentCategory"] as const) {
      explain(field, "not_in_source_model", "Finnes ikke i NormalizedListing; ukjent (ikke gjettet, ikke utledet av variant, tekst eller karosseri).");
    }

    const candidate: CandidateV2 = {
      id: candidateId(v.source, v.sourceListingId),
      version: revisionOf(v, mapping, { brandKey, modelKey, exteriorColor }),
      brandKey, modelKey,
      variant: v.specs.variant,
      modelYear: null,
      firstRegistration: v.specs.firstRegistration === null ? null : { ...v.specs.firstRegistration },
      mileageKm,
      seats: null,
      bodyType: v.specs.bodyType,
      fuel: v.specs.fuel,
      transmission: v.specs.transmission,
      driveTrain: null,
      exteriorColor,
      interiorColor: null,
      interiorMaterial: null,
      equipment: null,
      packages: null,
      currentCategory: null,
    };
    const meta: CandidateMeta = {
      source: v.source,
      sourceListingId: v.sourceListingId,
      synthetic: v.provenance.kind === "synthetic",
      provenance: { kind: v.provenance.kind, description: v.provenance.description, normalizationNotes: [...v.provenance.normalizationNotes] },
      mapping: { sourceId: mapping.sourceId, version: mapping.version },
      sourceModifiedAt: v.sourceModifiedAt,
      firstSeenAt: v.firstSeenAt,
      lastSeenAt: v.lastSeenAt,
      statedPrice: v.price === null ? null : {
        amount: v.price.amount, currency: v.price.currency, basis: v.price.basis, basisEvidence: v.price.basisEvidence,
        vat: { statedRateBasisPoints: v.price.vat.statedRateBasisPoints, reclaimableClaim: v.price.vat.reclaimableClaim, origin: v.price.vat.origin, evidence: [...v.price.vat.evidence] },
      },
      explanations,
      revisionContract: REVISION_CONTRACT,
    };
    return { ok: true, candidate, meta };
  } catch {
    return { ok: false, issues: [{ path: "", code: "invalid_structure", message: "Ugyldig struktur." }] };
  }
}

/** Kanonisk revisjonsgrunnlag (eksportert for test/dokumentasjon). Fast nøkkelrekkefølge ⇒ deterministisk JSON. */
export function revisionBasis(v: Checked, mapping: Pick<CandidateMapping, "sourceId" | "version">, mapped: { brandKey: string | null; modelKey: string | null; exteriorColor: string | null }): string {
  const p = v.price;
  return JSON.stringify({
    contract: REVISION_CONTRACT,
    mapping: [mapping.sourceId, mapping.version],
    identity: [v.source, v.sourceListingId],
    mapped: [mapped.brandKey, mapped.modelKey, mapped.exteriorColor],
    originalUrl: v.originalUrl,
    sourceModifiedAt: v.sourceModifiedAt,
    provenanceKind: v.provenance.kind,
    price: p === null ? null : [
      [p.amount, p.currency], p.amountMoney === null ? null : [p.amountMoney.amountMinor, p.amountMoney.currency],
      p.basis, p.basisEvidence, [p.vat.statedRateBasisPoints, p.vat.reclaimableClaim, p.vat.evidence, p.vat.origin],
    ],
    specs: [
      v.specs.make, v.specs.model, v.specs.variant,
      v.specs.firstRegistration === null ? null : [v.specs.firstRegistration.precision, v.specs.firstRegistration.year, "month" in v.specs.firstRegistration ? v.specs.firstRegistration.month : null, "day" in v.specs.firstRegistration ? v.specs.firstRegistration.day : null],
      v.specs.mileage === null ? null : [v.specs.mileage.value, v.specs.mileage.unit],
      v.specs.fuel, v.specs.transmission, v.specs.bodyType, v.specs.powerKw,
      v.specs.co2 === null ? null : [v.specs.co2.gramsPerKm, v.specs.co2.testMethod], v.specs.curbWeightKg, v.specs.color,
    ],
    text: v.text,
    seller: v.seller === null ? null : [v.seller.type, v.seller.countryCode, v.seller.city],
  });
}

function revisionOf(v: Checked, mapping: CandidateMapping, mapped: { brandKey: string | null; modelKey: string | null; exteriorColor: string | null }): string {
  return `rev1:${sha256Hex(revisionBasis(v, mapping, mapped))}`;
}
