import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { PUBLIC_ID_PATTERN } from "@/domain/display-policy";
import { buildProvenance, canonicalPermissions, evaluateProvenance, TRANSIENT_FRESH_MS, type InternalProvenance } from "@/domain/provenance";
import { REGISTERED_PROFILES, SYNTHETIC_RIGHTS_PROFILE, type ProviderRightsProfile } from "@/domain/provider-rights";
import type { NormalizedListing } from "@/domain/types";
import { ResultCard } from "@/components/search/ResultCard";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { PublicIdKeyMissingError, derivePublicId, profileDigest, publicIdFor, publicIdKey } from "@/server/public-ids";
import { detailForDisplay, previewForDisplay, previewInternal } from "@/server/search-display";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { sentinelListing } from "./fixtures/display-sentinel";
import { profile } from "./fixtures/rights-profiles";

const NOW = new Date("2026-10-16T12:00:00Z");
let seq = 0;
const spec = () => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values() }, DEMO_CATALOG, { newCostId: () => (seq++).toString(16).padStart(12, "0") });
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};
const providerAt = (at: Date, listings?: NormalizedListing[]): MarketplaceProvider => {
  if (!listings) return new SyntheticMarketplaceProvider({ now: () => at });
  return {
    source: "synthetic-demo",
    search: async () => ({ items: listings, nextPage: null, sourceTotal: listings.length, truncated: false, fetchedAt: at.toISOString(), rejected: [] }),
    getListing: async (id) => listings.find((l) => l.sourceListingId === id) ?? null,
  };
};
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

describe("DATA-002C: opak Merovo-id", () => {
  it("format, determinisme, og ingen kodet leverandør eller leverandør-id", () => {
    const id = publicIdFor("synthetic-demo", "syn-017", "synthetic");
    expect(id).toMatch(PUBLIC_ID_PATTERN);
    expect(id).toBe(publicIdFor("synthetic-demo", "syn-017", "synthetic"));
    expect(id.toLowerCase()).not.toContain("syn");
    expect(id.toLowerCase()).not.toContain("synthetic");
    expect(id).not.toContain("017");
    expect(Buffer.from(id.slice(3), "base64url").toString("latin1")).not.toMatch(/syn|demo|017/i);
  });

  it("to leverandører med samme lokale annonse-id får ulike id-er (id er ikke globalt unik); samme leverandør gir samme", () => {
    const a = publicIdFor("synthetic-demo", "12345", "synthetic");
    const b = publicIdFor("another-provider", "12345", "synthetic");
    const c = publicIdFor("synthetic-demo", "12346", "synthetic");
    expect(new Set([a, b, c]).size).toBe(3);
    expect(derivePublicId("p1", "x", "k".repeat(16))).not.toBe(derivePublicId("p2", "x", "k".repeat(16)));
    expect(derivePublicId("p1", "x|p2", "k".repeat(16))).not.toBe(derivePublicId("p1|x", "p2", "k".repeat(16))); // ingen kollisjon via sammensetning av felt
  });

  it("nøkkel: syntetisk kan bruke innebygd pepper; sandbox/produksjon feiler lukket uten nøkkel; en konfigurert nøkkel endrer id-en", () => {
    expect(() => publicIdKey("synthetic", undefined)).not.toThrow();
    for (const env of ["sandbox", "live"] as const) { // ingen live-leverandør er koblet til
      expect(() => publicIdKey(env, undefined)).toThrow(PublicIdKeyMissingError);
      expect(() => publicIdKey(env, "kort")).toThrow(PublicIdKeyMissingError); // for kort nøkkel regnes som manglende
      expect(() => publicIdKey(env, "x".repeat(32))).not.toThrow();
    }
    expect(publicIdFor("synthetic-demo", "a", "synthetic", "k".repeat(32))).not.toBe(publicIdFor("synthetic-demo", "a", "synthetic"));
  });

  it("syntetisk regresjon: alle annonser får en unik, gyldig id; id-ene er stabile mellom kall", async () => {
    const a = await previewForDisplay(spec(), { provider: providerAt(NOW), now: () => NOW });
    const b = await previewForDisplay(spec(), { provider: providerAt(NOW), now: () => NOW });
    if (!a.ok || !b.ok) throw new Error("kilden feilet");
    const ids = a.items.map((i) => i.listing.listingId);
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(PUBLIC_ID_PATTERN);
    expect(ids).toEqual(b.items.map((i) => i.listing.listingId));
    expect(a.coverage.withheldByProvenance).toBe(0);
  });
});

describe("DATA-002C: leverandørens annonse-id kan ikke havne i URL, DOM eller visningsmodell uten rett", () => {
  it("resultatkortets lenke og data-attributter bærer bare den opake id-en — også når profilen tillater å vise leverandørens id", async () => {
    const l = sentinelListing();
    l.sourceListingId = "LEVERANDOR-ID-SENTINEL-4711";
    const out = await previewForDisplay(spec(), { provider: providerAt(NOW, [l]), now: () => NOW });
    if (!out.ok) throw new Error("kilden feilet");
    const item = out.items[0]!;
    const html = renderToStaticMarkup(createElement(ResultCard, { item, draftId: "d1", version: 3 }));
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(hrefs.some((h) => h.includes("/preview/"))).toBe(true);
    for (const h of hrefs) expect(h, h).not.toContain("SENTINEL");
    expect(html).not.toContain("LEVERANDOR-ID-SENTINEL-4711");
    expect(html).not.toMatch(/data-listing="[^"]*(SENTINEL|syn|demo)/i);
    expect(hrefs.find((h) => h.includes("/preview/"))).toBe(`/searches/d1/preview/${item.listing.listingId}?v=3`);
    expect(item.listing.listingId).toMatch(PUBLIC_ID_PATTERN);
    // visbart felt: bare når profilen sier det (listing_id) — og da som felt, ikke i URL
    expect(item.listing.providerListingId).toEqual({ state: "value", value: "LEVERANDOR-ID-SENTINEL-4711" });
  });

  it("listing_id nektet: leverandørens id finnes ingen steder i visningsmodellen, markup eller URL", async () => {
    const l = sentinelListing();
    l.sourceListingId = "LEVERANDOR-ID-SENTINEL-4711";
    const p = profile({ version: 5, display: { listing_id: false } });
    const out = await previewForDisplay(spec(), { provider: providerAt(NOW, [l]), now: () => NOW, profiles: [p] });
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.items).toHaveLength(1);
    expect(json(out)).not.toContain("LEVERANDOR-ID-SENTINEL-4711");
    expect(renderToStaticMarkup(createElement(ResultCard, { item: out.items[0]!, draftId: "d1", version: 1 }))).not.toContain("LEVERANDOR-ID-SENTINEL-4711");
    const d = await detailForDisplay(spec(), out.items[0]!.listing.listingId, { provider: providerAt(NOW, [l]), now: () => NOW, profiles: [p] });
    if (d.kind !== "ok") throw new Error(d.kind);
    expect(json(d)).not.toContain("LEVERANDOR-ID-SENTINEL-4711");
    expect(d.item.listing.providerListingId).toEqual({ state: "withheld" });
  });

  it("detaljoppslag med leverandørens egen id (gammelt URL-format) finner ingenting; med den opake id-en fungerer navigasjonen", async () => {
    const provider = providerAt(NOW);
    const out = await previewForDisplay(spec(), { provider, now: () => NOW });
    if (!out.ok) throw new Error("kilden feilet");
    const pick = out.items.find((i) => i.assessment.vehicle.status === "match")!;
    const ok = await detailForDisplay(spec(), pick.listing.listingId, { provider, now: () => NOW });
    expect(ok.kind).toBe("ok");
    if (ok.kind === "ok") expect(ok.item.listing.title).toEqual(pick.listing.title);
    expect((await detailForDisplay(spec(), "syn-005", { provider, now: () => NOW })).kind).toBe("not_found");
    expect((await detailForDisplay(spec(), "m1_AAAAAAAAAAAAAAAAAAAAAAAA", { provider, now: () => NOW })).kind).toBe("not_found");
  });
});

describe("DATA-002C: proveniens (server-internt)", () => {
  it("bærer leverandør, miljø, leverandørens id, profil-id/-versjon/avtrykk, hentetid, utløp, skjemaversjon, URL-referanse (kun hvis tillatt), attribusjon og korrelasjons-id", async () => {
    const l = sentinelListing();
    const p = profile({ version: 9, validUntil: "2026-12-01T00:00:00Z", storage: { ...profile().storage, retentionSeconds: 3600 } });
    const r = await previewInternal(spec(), { provider: providerAt(NOW, [l]), now: () => NOW, profiles: [p], correlationId: "batch-42" });
    if (!r.ok) throw new Error("kilden feilet");
    const prov = r.items[0]!.provenance;
    expect(prov).toEqual({
      publicId: r.items[0]!.display.listing.listingId,
      providerId: "synthetic-demo", environment: "synthetic", providerListingId: "sentinel-1",
      rightsProfile: { id: "synthetic-demo@9", version: 9, digest: profileDigest(p) },
      retrievedAt: NOW.toISOString(), sourceExpiresAt: "2026-10-16T13:00:00.000Z",
      schemaVersion: "synthetic-demo@1", sourceUrlRef: "https://sentinel-url.example/ad/1",
      attribution: { required: true, text: "Testattribusjon" }, correlationId: "batch-42",
    });
    // kilde-URL-referansen følger visningsretten
    const q = await previewInternal(spec(), { provider: providerAt(NOW, [l]), now: () => NOW, profiles: [profile({ display: { source_url: false } })] });
    if (!q.ok) throw new Error("kilden feilet");
    expect(q.items[0]!.provenance.sourceUrlRef).toBeNull();
  });

  it("proveniens og avtrykk når aldri UI: DisplayItem har bare listing/assessment/unknowns og ingen proveniensnøkler", async () => {
    const out = await previewForDisplay(spec(), { provider: providerAt(NOW), now: () => NOW });
    if (!out.ok) throw new Error("kilden feilet");
    for (const i of out.items) expect(Object.keys(i).sort()).toEqual(["assessment", "economics", "listing", "unknowns"]); // ECON-005d: + økonomi som ferdig visningsmodell
    const text = json(out.items.slice(0, 30));
    for (const k of ["rightsProfile", "digest", "correlationId", "retrievedAt", "schemaVersion", "sourceExpiresAt", "sourceUrlRef"]) expect(text, k).not.toContain(`"${k}"`);
  });

  it("avtrykket er stabilt, uavhengig av nøkkelrekkefølge, og endres av enhver rettighetsendring", () => {
    const base = profile({ version: 2 });
    expect(profileDigest(base)).toBe(profileDigest({ ...base, display: Object.fromEntries(Object.entries(base.display).reverse()) as typeof base.display }));
    expect(profileDigest(base)).not.toBe(profileDigest(profile({ version: 2, display: { price: false } })));
    expect(profileDigest(base)).not.toBe(profileDigest(profile({ version: 2, matching: { price: false } })));
    expect(profileDigest(base)).not.toBe(profileDigest(profile({ version: 2, usage: { ...base.usage, alerts: true } })));
    expect(profileDigest(base)).not.toBe(profileDigest(profile({ version: 2, geography: { unrestricted: false, countries: ["DE"] } })));
    expect(canonicalPermissions(base)).not.toContain("verifiedBy"); // verifisering er ikke rettighet
  });
});

describe("DATA-002C: lukket feil ved ugyldig proveniens", () => {
  const p = profile({ version: 3, validUntil: "2026-12-01T00:00:00Z", storage: { ...profile().storage, retentionSeconds: 3600 } });
  const prov = (over: Partial<InternalProvenance> = {}, profileUsed: ProviderRightsProfile = p): InternalProvenance => ({
    ...buildProvenance({ listing: sentinelListing(), publicId: "m1_AAAAAAAAAAAAAAAAAAAAAAAA", profile: profileUsed, profileDigest: profileDigest(profileUsed), retrievedAt: new Date("2026-10-16T11:30:00Z"), schemaVersion: "synthetic-demo@1" }),
    ...over,
  });
  const ev = (pv: InternalProvenance, profiles: readonly ProviderRightsProfile[], now = NOW, extra: { listingAvailable?: boolean } = {}) => evaluateProvenance(pv, { profiles, now, digestOf: profileDigest, ...extra });

  it("gyldig: profilen er i kraft, avtrykket stemmer og kildedata ikke utløpt", () => {
    expect(ev(prov(), [p])).toBe("valid");
  });
  it("ukjent profil (ingen profil / annen versjon / annen leverandør) ⇒ rights_unknown", () => {
    expect(ev(prov(), [])).toBe("rights_unknown");
    expect(ev(prov(), [profile({ version: 4 })])).toBe("rights_unknown");
    expect(ev(prov(), [profile({ providerId: "andre", version: 3 })])).toBe("rights_unknown");
    expect(ev(prov(), [{ ...p, status: "draft", verifiedBy: null, verifiedAt: null }])).toBe("rights_unknown"); // utkast er aldri i kraft (avtrykket dekker rettigheter, ikke status)
  });
  it("trukket profil ⇒ rights_revoked (umiddelbart, også mens kildedata ellers ville vært gyldige)", () => {
    expect(ev(prov(), [{ ...p, status: "revoked" }])).toBe("rights_revoked");
  });
  it("utløpt profil ⇒ rights_expired", () => {
    expect(ev(prov(), [p], new Date("2026-12-01T00:00:00Z"))).toBe("rights_expired");
  });
  it("endret profil på plass (samme versjon, andre rettigheter) ⇒ rights_changed", () => {
    expect(ev(prov(), [{ ...p, display: { ...p.display, price: false } }])).toBe("rights_changed");
    expect(ev(prov(), [{ ...p, usage: { ...p.usage, alerts: true } }])).toBe("rights_changed");
  });
  it("utløpte kildedata ⇒ source_expired: lagret kopi etter retensjon; ikke-lagret data eldre enn fersk-vinduet; hentetid i fremtiden", () => {
    expect(ev(prov(), [p], new Date("2026-10-16T12:30:00Z"))).toBe("source_expired"); // 11:30 + 1 t = 12:30 (eksklusiv)
    expect(ev(prov(), [p], new Date("2026-10-16T12:29:59Z"))).toBe("valid");
    const transient = profile({ version: 3, storage: { ...profile().storage, retentionSeconds: 0 } });
    const t = prov({}, transient);
    expect(t.sourceExpiresAt).toBeNull();
    expect(ev(t, [transient], new Date(Date.parse(t.retrievedAt) + TRANSIENT_FRESH_MS))).toBe("valid");
    expect(ev(t, [transient], new Date(Date.parse(t.retrievedAt) + TRANSIENT_FRESH_MS + 1))).toBe("source_expired");
    expect(ev(prov({ retrievedAt: "2026-10-17T00:00:00Z" }), [p])).toBe("source_expired");
    expect(ev(prov({ retrievedAt: "ugyldig" }), [p])).toBe("source_expired");
  });
  it("annonsen er borte hos kilden ⇒ unavailable (eget avslag, ikke «ukjent»); rettighetsavslag har forrang", () => {
    expect(ev(prov(), [p], NOW, { listingAvailable: false })).toBe("unavailable");
    expect(ev(prov(), [{ ...p, status: "revoked" }], NOW, { listingAvailable: false })).toBe("rights_revoked");
  });

  it("gjennom serverlaget: utløpt kildedata (leverandøren leverer gammel hentetid) skjules i liste og blokkeres i detalj — med egen årsak", async () => {
    const stale = new Date("2026-10-01T00:00:00Z"); // 15 dager gammel; retensjon 7 dager
    const provider = new SyntheticMarketplaceProvider({ now: () => stale });
    const prof = [SYNTHETIC_RIGHTS_PROFILE];
    const out = await previewForDisplay(spec(), { provider, now: () => NOW, profiles: prof });
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.items).toHaveLength(0);
    expect(out.counts).toEqual({ match: 0, needsReview: 0, excluded: 0 });
    expect(out.coverage.withheldByProvenance).toBeGreaterThan(100);
    const id = publicIdFor("synthetic-demo", "syn-005", "synthetic");
    expect(await detailForDisplay(spec(), id, { provider, now: () => NOW, profiles: prof })).toEqual({ kind: "blocked", reason: "source_expired" });
  });

  it("gjennom serverlaget: trukket eller utløpt profil gir blokkert (ikke «ikke funnet», ikke «ukjent»); ukjent leverandør gir ikke funnet", async () => {
    const provider = providerAt(NOW);
    const id = publicIdFor("synthetic-demo", "syn-005", "synthetic");
    expect(await detailForDisplay(spec(), id, { provider, now: () => NOW, profiles: [profile({ status: "revoked" })] })).toEqual({ kind: "blocked", reason: "rights_revoked" });
    expect(await detailForDisplay(spec(), id, { provider, now: () => NOW, profiles: [profile({ validUntil: "2026-10-16T11:00:00Z" })] })).toEqual({ kind: "blocked", reason: "rights_expired" });
    expect(await detailForDisplay(spec(), id, { provider, now: () => NOW, profiles: [profile({ status: "draft", verifiedBy: null, verifiedAt: null })] })).toEqual({ kind: "blocked", reason: "rights_unknown" });
    expect((await detailForDisplay(spec(), id, { provider, now: () => NOW, profiles: [] })).kind).toBe("not_found");
    // aldri en stille erstatning: ingen verdier fra utløpt data i utfallet
    expect(json(await detailForDisplay(spec(), id, { provider, now: () => NOW, profiles: [profile({ status: "revoked" })] }))).not.toMatch(/BMW|diesel|Hamburg/);
  });

  it("sandbox/produksjon uten id-nøkkel feiler lukket gjennom serverlaget: ingen id, ingen visning", async () => {
    const sandbox = profile({ providerId: "synthetic-demo", environment: "sandbox", version: 2, providerName: "Eksempel" });
    const out = await previewForDisplay(spec(), { provider: providerAt(NOW), now: () => NOW, profiles: [sandbox] });
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.items).toHaveLength(0);
    expect(out.coverage.withheldByProvenance).toBeGreaterThan(100);
    const keyed = await previewForDisplay(spec(), { provider: providerAt(NOW), now: () => NOW, profiles: [sandbox], publicIdKey: "k".repeat(32) });
    if (!keyed.ok) throw new Error("kilden feilet");
    expect(keyed.items.length).toBeGreaterThan(100);
  });
});

describe("DATA-002C: syntetisk regresjon og registrerte profiler", () => {
  it("den registrerte syntetiske profilen er fortsatt eneste profil, og gir gyldig proveniens for alle annonser", async () => {
    expect(REGISTERED_PROFILES).toHaveLength(1);
    const r = await previewInternal(spec(), { provider: providerAt(NOW), now: () => NOW });
    if (!r.ok) throw new Error("kilden feilet");
    expect(r.items.length).toBeGreaterThan(100);
    for (const i of r.items) {
      expect(evaluateProvenance(i.provenance, { profiles: REGISTERED_PROFILES, now: NOW, digestOf: profileDigest })).toBe("valid");
      expect(i.provenance.rightsProfile.version).toBe(1);
      expect(i.provenance.environment).toBe("synthetic");
    }
  });
});
