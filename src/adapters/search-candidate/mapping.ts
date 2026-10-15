/**
 * Mappingkontrakt: kildens make/model/color → katalogens nøkler (SearchCatalog).
 *
 * Mappingdata er EKSPLISITT og versjonert (`sourceId` + `version`). Reglene:
 *  - Oppslag er eksakt etter én dokumentert normalisering (`normalizeSourceValue`): Unicode NFC, trim, sammenslåing av
 *    hvitt rom til ett mellomrom og små bokstaver (språkuavhengig `toLowerCase`). Ingen delstreng, fuzzy-søk,
 *    stavekorrigering eller utledning av modellfamilie.
 *  - Modeller slås opp UNDER det mappede merket (modellnavn er ikke entydige på tvers av merker). Uten mappet merke
 *    gis aldri en modell.
 *  - Alle mål må finnes i den injiserte katalogen. To kilder som normaliseres til samme oppslagsnøkkel (kollisjon) avvises,
 *    også når målene er like. Mange kilder → samme mål er tillatt (synonymer).
 *  - Mappingen er data, ikke kode: den leses som `unknown` og valideres før bruk.
 *  - En kildeverdi som ikke finnes i mappingen er IKKE en feil; kandidatfeltet blir null med forklaring.
 */
import type { Issue, SearchCatalog } from "@/domain/search-v2/types";

export interface CandidateMappingData {
  /** Kildens id; må være lik `NormalizedListing.source`. */
  sourceId: string;
  /** Mappingversjon. Inngår i kandidatrevisjonen: endret mening → ny revisjon. */
  version: string;
  brands: readonly { source: string; target: string }[];
  /** `brand` er katalogens merkenøkkel (målet fra `brands`). */
  models: readonly { brand: string; source: string; target: string }[];
  exteriorColors: readonly { source: string; target: string }[];
}

/** Validert, ugjennomsiktig mapping med raske oppslag. */
export interface CandidateMapping {
  readonly sourceId: string;
  readonly version: string;
  brand(sourceMake: string): string | null;
  model(brandKey: string, sourceModel: string): string | null;
  exteriorColor(sourceColor: string): string | null;
}

export function normalizeSourceValue(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

const CONTROL = /[\u0000-\u001f\u007f]/;
const isPlain = (x: unknown): x is Record<string, unknown> => {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const p = Object.getPrototypeOf(x);
  return p === Object.prototype || p === null;
};

export type MappingResult = { ok: true; mapping: CandidateMapping } | { ok: false; issues: Issue[] };

export function buildCandidateMapping(input: unknown, catalog: SearchCatalog): MappingResult {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => { issues.push({ path, code, message }); };
  try {
    if (!isPlain(input)) return { ok: false, issues: [{ path: "", code: "not_object", message: "Mappingen må være et objekt." }] };
    for (const k of Object.keys(input)) if (!["sourceId", "version", "brands", "models", "exteriorColors"].includes(k)) add(k, "unknown_key", "Ukjent nøkkel.");
    for (const k of ["sourceId", "version"] as const) {
      const v = input[k];
      if (typeof v !== "string" || v.trim() === "" || v !== v.trim() || v.length > 100 || CONTROL.test(v)) add(k, "invalid_value", "Må være en ikke-tom tekst uten styretegn eller omkringliggende mellomrom (høyst 100 tegn).");
    }
    const list = (key: string): unknown[] | null => {
      const v = input[key];
      if (!Array.isArray(v)) { add(key, "not_array", "Må være en liste."); return null; }
      return v;
    };
    const entryIssues = (e: unknown, path: string, keys: readonly string[]): Record<string, string> | null => {
      if (!isPlain(e)) { add(path, "not_object", "Må være et objekt."); return null; }
      for (const k of Object.keys(e)) if (!keys.includes(k)) add(`${path}.${k}`, "unknown_key", "Ukjent nøkkel.");
      const out: Record<string, string> = {};
      for (const k of keys) {
        const v = e[k];
        if (typeof v !== "string" || v.trim() === "" || CONTROL.test(v)) { add(`${path}.${k}`, "invalid_value", "Må være en ikke-tom tekst uten styretegn."); continue; }
        out[k] = v;
      }
      return Object.keys(out).length === keys.length ? out : null;
    };

    const brands = new Map<string, string>(); // normalisert kilde → merkenøkkel
    const brandTargets = new Set<string>();
    list("brands")?.forEach((e, i) => {
      const p = `brands[${i}]`;
      const x = entryIssues(e, p, ["source", "target"]);
      if (!x) return;
      const key = normalizeSourceValue(x.source!);
      if (key === "") { add(`${p}.source`, "invalid_value", "Kilden er tom etter normalisering."); return; }
      if (brands.has(key)) { add(`${p}.source`, "ambiguous_source", `«${x.source}» kolliderer med en annen oppføring etter normalisering.`); return; }
      if (!catalog.hasBrand(x.target!)) { add(`${p}.target`, "unknown_target", `Merket «${x.target}» finnes ikke i katalogen.`); return; }
      brands.set(key, x.target!);
      brandTargets.add(x.target!);
    });

    const models = new Map<string, Map<string, string>>(); // merkenøkkel → (normalisert kilde → modellnøkkel)
    list("models")?.forEach((e, i) => {
      const p = `models[${i}]`;
      const x = entryIssues(e, p, ["brand", "source", "target"]);
      if (!x) return;
      const key = normalizeSourceValue(x.source!);
      if (key === "") { add(`${p}.source`, "invalid_value", "Kilden er tom etter normalisering."); return; }
      if (!catalog.hasBrand(x.brand!)) { add(`${p}.brand`, "unknown_target", `Merket «${x.brand}» finnes ikke i katalogen.`); return; }
      if (!brandTargets.has(x.brand!)) { add(`${p}.brand`, "model_for_unmapped_brand", `Ingen kildemerke er mappet til «${x.brand}»; modellen kunne aldri slås opp.`); return; }
      if (!catalog.hasModel(x.brand!, x.target!)) { add(`${p}.target`, "unknown_target", `Modellen «${x.target}» finnes ikke under «${x.brand}» i katalogen.`); return; }
      const m = models.get(x.brand!) ?? new Map<string, string>();
      if (m.has(key)) { add(`${p}.source`, "ambiguous_source", `«${x.source}» kolliderer med en annen modelloppføring under «${x.brand}» etter normalisering.`); return; }
      m.set(key, x.target!);
      models.set(x.brand!, m);
    });

    const colors = new Map<string, string>();
    list("exteriorColors")?.forEach((e, i) => {
      const p = `exteriorColors[${i}]`;
      const x = entryIssues(e, p, ["source", "target"]);
      if (!x) return;
      const key = normalizeSourceValue(x.source!);
      if (key === "") { add(`${p}.source`, "invalid_value", "Kilden er tom etter normalisering."); return; }
      if (colors.has(key)) { add(`${p}.source`, "ambiguous_source", `«${x.source}» kolliderer med en annen fargeoppføring etter normalisering.`); return; }
      if (!catalog.hasExteriorColor(x.target!)) { add(`${p}.target`, "unknown_target", `Fargen «${x.target}» finnes ikke i katalogen.`); return; }
      colors.set(key, x.target!);
    });

    if (issues.length) return { ok: false, issues };
    const sourceId = input.sourceId as string;
    const version = input.version as string;
    return {
      ok: true,
      mapping: {
        sourceId,
        version,
        brand: (s) => brands.get(normalizeSourceValue(s)) ?? null,
        model: (brand, s) => models.get(brand)?.get(normalizeSourceValue(s)) ?? null,
        exteriorColor: (s) => colors.get(normalizeSourceValue(s)) ?? null,
      },
    };
  } catch {
    return { ok: false, issues: [{ path: "", code: "invalid_structure", message: "Ugyldig struktur." }] };
  }
}
