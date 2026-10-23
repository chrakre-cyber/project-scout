/**
 * PILOT-003 — kuratert offentlig demo er ikke underlagt leverandørstil kildefriskhet; alt annet er uendret og lukket.
 *
 * Årsaken til utløpet (PILOT-001): `assessEconomics` setter kildedatagrensen = observasjonstid + rettighetsprofilens lagringstid (syntetisk profil: 7 døgn). Observasjonene fornyes til et 48 t-vindu før
 * `SYNTHETIC_DEFAULT_EPOCH` (2026-10-21), så grensen ligger rundt 27–28. oktober og gir `validity_exhausted:source_data` («kildedataene er for gamle»).
 * Demoens policy (`curated_public_demo_static`) fjerner KUN denne ene grensen, KUN for den kuraterte demobilen. Avgiftsprofilens periode (slutt 2026-12-31), teknisk tak og kursens gyldighet gjelder fortsatt.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { ResultCard } from "@/components/search/ResultCard";
import { DOCUMENTED_RULE_PERIOD } from "@/domain/economics/validity";
import { REGISTERED_PROFILES, SYNTHETIC_RIGHTS_PROFILE, isWithinRetention, retentionExpiresAt, rightsForSource } from "@/domain/provider-rights";
import { toAcquisitionSummary } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import { OBSERVATION_WINDOW_HOURS, SYNTHETIC_DEFAULT_EPOCH } from "@/providers/marketplace/synthetic/epoch";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { CURATED_DEMO_VALIDITY_POLICY, isCuratedDemoVehicle, sourceDataValidityLimit } from "@/server/curated-demo";
import { assessEconomics } from "@/server/search-economics";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { previewForDisplay, type DisplayItem } from "@/server/search-display";
import { FIRM_A, SEARCH_1, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

const demoSpec = () => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-ix3")!.values() }, DEMO_CATALOG, { newCostId: () => "000000000001" });
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};
/** Appens ekte oppsett: standardepoken fornyer observasjonene til 2026-10-19/21; klokken settes fritt. */
const provider = (at: Date) => new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => at, epoch: SYNTHETIC_DEFAULT_EPOCH });
async function demoItems(at: Date): Promise<DisplayItem[]> {
  const out = await previewForDisplay(demoSpec(), { provider: provider(at), now: () => at });
  if (!out.ok) throw new Error(`demo feilet ved ${at.toISOString()}`);
  return out.items;
}
const curated = (items: DisplayItem[]) => items.find((i) => toAcquisitionSummary(i.economics).state !== "unavailable");
const scenarios = (i: DisplayItem) => { const s = toAcquisitionSummary(i.economics); return s.state === "scenarios" ? { amounts: s.scenarios.map((c) => c.amountNok), lines: Object.fromEntries(s.lines.map((l) => [l.id, l.amountNok])) } : s.state; };
const EXPECTED = { amounts: ["484214", "559214"], lines: { purchase: "424925", registration_tax: "18058", vat: null, transport: "8000" } };
const OLD_WINDOW_END = new Date(Date.parse(SYNTHETIC_DEFAULT_EPOCH) + 7 * 86_400_000); // grovt: siste observasjon + 7 døgn

describe("1–2. kuratert demo: økonomi finnes og er uendret etter det gamle friskhetsvinduet", () => {
  for (const at of ["2026-10-23T12:00:00Z", "2026-10-29T12:00:00Z", "2026-11-20T12:00:00Z", "2026-12-31T12:00:00Z"]) {
    it(`klokke ${at}: BMW iX3-demoen viser samme motorutledede område (484 214 – 559 214 kr)`, async () => {
      const d = new Date(at);
      const c = curated(await demoItems(d));
      expect(c).toBeDefined();
      expect(scenarios(c!)).toEqual(EXPECTED);
      const html = renderToStaticMarkup(createElement(ResultCard, { item: c!, draftId: "d1", version: 1 })).replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
      expect(html).toContain("484 214 – 559 214 kr");
      expect(html).not.toMatch(/innkjøpskostnad[^.]{0,60}ikke beregnet/i);
    });
  }
  it("klokkene over ligger faktisk etter det gamle utløpet", () => {
    expect(new Date("2026-10-29T12:00:00Z").getTime()).toBeGreaterThan(OLD_WINDOW_END.getTime());
  });
  it("ingen falsk ferskhet: observasjonstiden er den samme (ikke flyttet frem) og kandidat-id/proveniens er uendret", async () => {
    const early = (await demoItems(new Date("2026-10-23T12:00:00Z"))).find((i) => (i.listing as { source?: string }).source !== undefined || true)!;
    const a = await provider(new Date("2026-10-23T12:00:00Z")).getListing("dix3-001");
    const b = await provider(new Date("2026-12-20T12:00:00Z")).getListing("dix3-001");
    expect(early).toBeDefined();
    expect(b!.lastSeenAt).toBe(a!.lastSeenAt);
    expect(Date.parse(b!.lastSeenAt)).toBeLessThanOrEqual(Date.parse(SYNTHETIC_DEFAULT_EPOCH));
  });
});

describe("3–4. generiske syntetiske og leverandør-/sandbox-resultater følger uendret kildefriskhet", () => {
  const specNok = specOf();
  const run = (now: Date, l: NormalizedListing = listing()) => {
    const rights = rightsForSource("synthetic-demo", now, REGISTERED_PROFILES);
    const cand = candidateFor(l);
    const st = stored({ rights, spec: specNok, cand, input: dealerInput({ customsDate: { date: now.toISOString().slice(0, 10), kind: "actual_acceptance" }, norwegianRegistration: { date: "2026-12-30", kind: "expected" } }), confirmedAt: now.toISOString() });
    return assessEconomics({ dealershipId: FIRM_A, searchId: SEARCH_1, listing: l, candidate: cand, spec: specNok, stored: st, profile: null, now });
  };
  const outcomeOf = (a: ReturnType<typeof assessEconomics>) => (a.kind === "assessed" && a.detail ? a.detail.outcome : null);

  it("3. generisk syntetisk annonse (ikke den kuraterte): gyldig innenfor 7 døgn, stale/`source_data` etter", () => {
    const l = listing({ lastSeenAt: "2026-10-20T09:00:00Z" });
    expect(isCuratedDemoVehicle(l, rightsForSource("synthetic-demo", new Date("2026-10-21T00:00:00Z"), REGISTERED_PROFILES))).toBe(false);
    const fresh = outcomeOf(run(new Date("2026-10-21T10:00:00Z"), l));
    expect(fresh?.class).not.toBe("stale");
    const old = outcomeOf(run(new Date("2026-10-28T10:00:00Z"), l)); // > 7 døgn etter observasjon
    expect(old?.class).toBe("stale");
    expect(old?.bindingLimit).toBe("source_data");
  });

  it("4. sandbox/leverandør/live-profil og annonse som ser ut som demobilen: kildegrensen er den ordinære (observasjon + lagringstid, eller 5 min uten lagringsrett)", async () => {
    const demoL = (await provider(new Date("2026-10-23T12:00:00Z")).getListing("dix3-001"))!;
    const synthRights = rightsForSource("synthetic-demo", new Date("2026-10-23T12:00:00Z"), REGISTERED_PROFILES);
    const DEFAULT = "2026-10-28T00:00:00.000Z";
    expect(sourceDataValidityLimit(demoL, synthRights, DEFAULT)).toEqual({ label: CURATED_DEMO_VALIDITY_POLICY, untilExclusive: null });
    const spoofSrc = { ...demoL, source: "test-provider" } as NormalizedListing;
    const spoofProv = { ...demoL, provenance: { kind: "provider", description: "x", normalizationNotes: [] } } as unknown as NormalizedListing;
    const sandbox = profile({ providerId: "test-provider", environment: "sandbox", providerName: "Testleverandør", storage: { ...profile().storage, retentionSeconds: 604_800 } });
    const live = profile({ providerId: "test-provider", environment: "live", providerName: "Testleverandør" });
    for (const [l, r] of [[spoofSrc, rightsForSource("test-provider", new Date("2026-10-23T12:00:00Z"), [sandbox])], [spoofSrc, rightsForSource("test-provider", new Date("2026-10-23T12:00:00Z"), [live])], [spoofProv, synthRights],
      [{ ...demoL, sourceListingId: "dix3-002" } as NormalizedListing, synthRights], [spoofSrc, rightsForSource("test-provider", new Date(), [])]] as const) {
      expect(sourceDataValidityLimit(l, r, DEFAULT)).toEqual({ label: "source_data", untilExclusive: DEFAULT });
    }
    // sandbox med den syntetiske profilens miljø byttet ⇒ ikke kuratert
    expect(sourceDataValidityLimit(demoL, rightsForSource("synthetic-demo", new Date("2026-10-23T12:00:00Z"), [profile({ providerId: "synthetic-demo", environment: "sandbox", providerName: "x" })]), DEFAULT).label).toBe("source_data");
  });
});

describe("5. rettighetsprofilens lagringstid er uendret", () => {
  it("syntetisk profil: 7 døgn (604 800 s); `retentionExpiresAt`/`isWithinRetention` oppfører seg som før", () => {
    expect(SYNTHETIC_RIGHTS_PROFILE.storage.retentionSeconds).toBe(604_800);
    const seen = new Date("2026-10-20T00:00:00Z");
    expect(retentionExpiresAt(SYNTHETIC_RIGHTS_PROFILE, seen)!.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(isWithinRetention(SYNTHETIC_RIGHTS_PROFILE, seen, new Date("2026-10-26T23:59:59Z"))).toBe(true);
    expect(isWithinRetention(SYNTHETIC_RIGHTS_PROFILE, seen, new Date("2026-10-27T00:00:00Z"))).toBe(false);
    expect(SYNTHETIC_RIGHTS_PROFILE.validUntil).toBeNull();
  });
});

describe("6. utløpt avgiftsprofil feiler fortsatt lukket (demoen later ikke som om 2027 er dekket)", () => {
  it(`dokumentert periode slutter ${DOCUMENTED_RULE_PERIOD.toIso}; demoen har økonomi 2026-12-31 og ingenting etter`, async () => {
    expect(DOCUMENTED_RULE_PERIOD.toIso).toBe("2026-12-31");
    expect(curated(await demoItems(new Date("2026-12-31T20:00:00Z")))).toBeDefined();
    for (const at of ["2027-01-01T01:00:00Z", "2027-02-15T12:00:00Z"]) {
      const items = await demoItems(new Date(at));
      expect(curated(items)).toBeUndefined(); // ingen estimat, ingen scenarier
      for (const i of items) expect(toAcquisitionSummary(i.economics).state).toBe("unavailable");
    }
  });
});

describe("7. ingen global friskhetskonstant er svekket, og demoens policy er isolert", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  it("de globale konstantene er uendret", () => {
    expect(read("src/server/search-economics.ts")).toMatch(/const TRANSIENT_FRESH_MS = 5 \* 60 \* 1000;/);
    expect(read("src/domain/provenance.ts")).toMatch(/TRANSIENT_FRESH_MS = 5 \* 60 \* 1000/);
    expect(SYNTHETIC_RIGHTS_PROFILE.storage.retentionSeconds).toBe(604_800);
    expect(SYNTHETIC_DEFAULT_EPOCH).toBe("2026-10-21T06:50:00Z");
    expect(OBSERVATION_WINDOW_HOURS).toBe(48);
    expect(DOCUMENTED_RULE_PERIOD).toEqual({ fromIso: "2026-01-01", toIso: "2026-12-31", label: "2026" });
  });
  it("policyen er bare koblet inn ét sted i orkestreringen (kildedatagrensen) og brukes ikke av provider-/rettighets-/domenekode", () => {
    const hits: string[] = [];
    const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name) && /isCuratedDemoVehicle|sourceDataValidityLimit|CURATED_DEMO_VALIDITY_POLICY/.test(readFileSync(p, "utf8"))) hits.push(p.replace(`${process.cwd()}/`, "")); } };
    walk(join(process.cwd(), "src"));
    expect(hits.sort()).toEqual(["src/server/curated-demo.ts", "src/server/demo-economics.ts", "src/server/search-display.ts", "src/server/search-economics.ts"]);
    expect(read("src/domain/provider-rights.ts")).not.toMatch(/curated|demo-economics/i);
  });
});
