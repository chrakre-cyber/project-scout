import { describe, expect, it } from "vitest";
import { applyDisplayPolicy } from "@/domain/display-policy";
import {
  REGISTERED_PROFILES, RIGHTS_FIELD_KEYS, SYNTHETIC_DISPLAY_POLICY, SYNTHETIC_RIGHTS_PROFILE, canDisplay, canMatch, geographyAllows, isWithinRetention,
  noRights, policyForSource, resolveRights, restrictForMatching, retentionExpiresAt, toDisplayPolicy, validateProfile, type ProviderRightsProfile,
} from "@/domain/provider-rights";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { detailForDisplay, previewForDisplay } from "@/server/search-display";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { sentinelListing } from "./fixtures/display-sentinel";
import { MOBILE_SANDBOX_EXAMPLE, profile } from "./fixtures/rights-profiles";

const NOW = new Date("2026-10-16T12:00:00Z");
let seq = 0;
const spec = () => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values() }, DEMO_CATALOG, { newCostId: () => (seq++).toString(16).padStart(12, "0") });
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};
const run = (profiles: readonly ProviderRightsProfile[], provider = new SyntheticMarketplaceProvider()) =>
  previewForDisplay(spec(), { provider, now: () => NOW, profiles }).then((o) => { if (!o.ok) throw new Error("kilden feilet"); return o; });
const statuses = (o: Awaited<ReturnType<typeof run>>) => o.items.map((i) => `${i.listing.listingId}:${i.assessment.vehicle.status}`);

describe("DATA-002B: profilens tilstander (default-deny)", () => {
  it("gyldig verifisert profil i kraft: gir rettighetene, versjonen og en visningspolicy utledet av profilen", () => {
    const p = profile({ version: 4, display: { price: false, seller_identity: false } });
    expect(validateProfile(p)).toEqual([]);
    const r = resolveRights("synthetic-demo", [p], NOW);
    expect(r.inForce).toBe(true);
    expect(canDisplay(r, "title")).toBe(true);
    expect(canDisplay(r, "price")).toBe(false);
    const pol = toDisplayPolicy(r);
    expect(pol.profileVersion).toBe(4);
    expect(pol.allow).toMatchObject({ title: true, price: false, sellerType: false, sellerLocation: true, providerName: true, sourceUrl: true, providerListingId: true });
    expect(pol.attribution).toBe("Testattribusjon");
    expect(pol.effectiveFrom).toBe("2026-10-01T00:00:00Z");
  });

  it.each([
    ["utløpt (slutt er eksklusiv)", { validUntil: "2026-10-16T12:00:00Z" }, "expired"],
    ["trukket", { status: "revoked" as const }, "revoked"],
    ["ikke begynt", { validFrom: "2026-10-17T00:00:00Z" }, "not_started"],
    ["utkast (ikke verifisert)", { status: "draft" as const, verifiedBy: null, verifiedAt: null }, "not_verified"],
    ["ugyldig (verifisert uten verifisering)", { verifiedBy: null }, "invalid_profile"],
    ["ugyldig (historikk lengre enn lagring)", { storage: { ...profile().storage, historyRetentionSeconds: 99999 } }, "invalid_profile"],
    ["ugyldig (attribusjon påkrevd uten tekst)", { attribution: { required: true, text: null } }, "invalid_profile"],
  ])("%s ⇒ ingenting tillatt, med årsak og profilversjon", (_n, over, reason) => {
    const p = profile({ version: 3, ...over });
    const r = resolveRights("synthetic-demo", [p], NOW);
    expect(r).toMatchObject({ inForce: false, reason, profileVersion: 3 });
    for (const k of RIGHTS_FIELD_KEYS) { expect(canDisplay(r, k)).toBe(false); expect(canMatch(r, k)).toBe(false); }
    const pol = toDisplayPolicy(r);
    expect(Object.values(pol.allow).every((v) => v === false)).toBe(true);
    expect(pol.profileVersion).toBe(3);
    const d = applyDisplayPolicy(sentinelListing(), pol, NOW);
    expect(JSON.stringify(d)).not.toContain("SENTINEL");
    expect(d.title).toEqual({ state: "withheld" });
  });

  it("ukjent leverandør ⇒ avslag `unknown_provider`, versjon 0, deny-all", () => {
    const r = resolveRights("noen-ekte-leverandor", REGISTERED_PROFILES, NOW);
    expect(r).toEqual({ inForce: false, reason: "unknown_provider", providerId: "noen-ekte-leverandor", profileVersion: 0 });
    expect(toDisplayPolicy(r).profileVersion).toBe(0);
    expect(policyForSource("noen-ekte-leverandor", NOW).environment).toBe("unverified");
  });

  it("flere versjoner: høyeste versjon i kraft gjelder; en ny utkast-versjon fjerner ikke den verifiserte; utløpt ny versjon faller tilbake til ingen (ikke til gammel utløpt)", () => {
    const v1 = profile({ version: 1, validUntil: "2026-12-01T00:00:00Z" });
    const v2 = profile({ version: 2, validFrom: "2026-10-10T00:00:00Z", display: { price: false } });
    const draft3 = profile({ version: 3, status: "draft", verifiedBy: null, verifiedAt: null });
    const r = resolveRights("synthetic-demo", [v1, draft3, v2], NOW);
    expect(r.inForce && r.profile.version).toBe(2);
    expect(canDisplay(r, "price")).toBe(false);
    const later = resolveRights("synthetic-demo", [v1, v2, draft3], new Date("2027-03-01T00:00:00Z"));
    expect(later.inForce).toBe(true); // v2 har ingen slutt
    const onlyExpired = resolveRights("synthetic-demo", [v1], new Date("2027-03-01T00:00:00Z"));
    expect(onlyExpired).toMatchObject({ inForce: false, reason: "expired" });
  });

  it("profiler validerer feltkart, ISO-land, geografi-konsistens og tider", () => {
    expect(validateProfile(profile({ geography: { unrestricted: true, countries: ["DE"] } }))).toContain("geography");
    expect(validateProfile(profile({ geography: { unrestricted: false, countries: ["Germany"] } }))).toContain("countries");
    expect(validateProfile(profile({ validUntil: "2026-09-01T00:00:00Z" }))).toContain("validUntil");
    expect(validateProfile({ ...profile(), display: { title: true } as never })).toContain("display");
    expect(validateProfile(profile({ providerId: "Bad Id" }))).toContain("providerId");
    expect(validateProfile(profile({ environment: "live", providerName: null }))).toContain("providerName"); // ingen live-profil er registrert
  });
});

describe("DATA-002B: visning og matching er separate rettigheter", () => {
  it("visning nektet, matching tillatt: vurderingen er identisk, men ingen felt vises (ingen verdier i utdata)", async () => {
    const base = await run(REGISTERED_PROFILES);
    const hidden = await run([profile({ version: 2, display: Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])) })]);
    expect(statuses(hidden)).toEqual(statuses(base));
    expect(hidden.counts).toEqual(base.counts);
    expect(hidden.items.length).toBeGreaterThan(100);
    for (const i of hidden.items) {
      expect(i.listing.title).toEqual({ state: "withheld" });
      expect(i.listing.price).toEqual({ state: "withheld" });
      expect(i.listing.specs.fuel).toEqual({ state: "withheld" });
      expect(i.listing.policy.profileVersion).toBe(2);
    }
    const sample = JSON.stringify(hidden.items.slice(0, 20).map((i) => i.listing), (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(sample).not.toMatch(/BMW|Volkswagen|diesel|Hamburg/);
  });

  it("matching nektet for ett felt: feltet blir ukjent i vurderingen (må kontrolleres), aldri oppdiktet eller brudd", async () => {
    const base = await run(REGISTERED_PROFILES);
    const noMileage = await run([profile({ version: 2, matching: { mileage: false } })]);
    const b = new Map(base.items.map((i) => [i.listing.listingId, i.assessment.vehicle]));
    let changed = 0;
    for (const i of noMileage.items) {
      const was = b.get(i.listing.listingId)!;
      const now = i.assessment.vehicle;
      expect(now.excludedBy.includes("maxMileage")).toBe(false); // ukjent er aldri «ikke oppfylt»
      if (was.status === "match") { expect(now.status).toBe("needs_review"); expect(now.unknownMust).toContain("maxMileage"); changed++; }
      if (was.status === "excluded" && !was.excludedBy.every((c) => c === "maxMileage")) expect(now.status).toBe("excluded"); // andre kravbrudd består
    }
    expect(changed).toBeGreaterThan(0);
    // visningen er uavhengig: kilometerstand kan fortsatt vises
    expect(noMileage.items.some((i) => i.listing.mileage.state === "value")).toBe(true);
  });

  it("både matching og visning nektet: ingen annonse kan vurderes eller vises", async () => {
    const o = await run([profile({ version: 2, display: Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])), matching: Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])) })]);
    expect(o.items).toHaveLength(0);
    expect(o.coverage.notAdapted).toBe(o.coverage.sourceTotal);
    expect(o.counts).toEqual({ match: 0, needsReview: 0, excluded: 0 });
  });

  it("matching tillatt men tittel nektet ⇒ uvurderbar; matching av andre felt hjelper ikke", async () => {
    const o = await run([profile({ matching: { title: false } })]);
    expect(o.items).toHaveLength(0);
    const l = restrictForMatching(sentinelListing(), { ...noRights(), price: true });
    expect(l.listing).toBeNull();
    expect(l.unusable).toContain("title");
  });

  it("restrictForMatching nuller bare det som ikke kan brukes, uten å oppdikte", () => {
    const m = { ...noRights(), title: true, registration: true };
    const r = restrictForMatching(sentinelListing(), m).listing!;
    expect(r.specs.make).toBe("SENTINEL-MERKE");
    expect(r.specs.firstRegistration).not.toBeNull();
    expect(r.specs.mileage).toBeNull();
    expect(r.specs.fuel).toBeNull();
    expect(r.price).toBeNull();
    expect(r.text).toBeNull();
    expect(r.seller).toBeNull();
    expect(r.sourceModifiedAt).toBeNull();
  });

  it("detalj: ukjent profil (ingen registrert for kilden) ⇒ uvurderbar; ellers vurdert", async () => {
    const provider = new SyntheticMarketplaceProvider();
    const noProfile = await detailForDisplay(spec(), "syn-005", { provider, now: () => NOW, profiles: [] });
    expect(noProfile.kind).toBe("not_assessable");
    const ok = await detailForDisplay(spec(), "syn-005", { provider, now: () => NOW });
    expect(ok.kind).toBe("ok");
  });
});

describe("DATA-002B: profilversjon følger resultatet", () => {
  it("hver visningsmodell bærer profilens id, versjon og miljø; også ved detalj", async () => {
    const p = profile({ version: 7 });
    const o = await run([p]);
    for (const i of o.items) expect(i.listing.policy).toEqual({ profileId: "synthetic-demo", profileVersion: 7, environment: "synthetic", inEffect: true });
    const d = await detailForDisplay(spec(), "syn-005", { now: () => NOW, profiles: [p] });
    if (d.kind !== "ok") throw new Error(d.kind);
    expect(d.item.listing.policy.profileVersion).toBe(7);
  });

  it("utløper profilen mellom to kall, forsvinner rettighetene umiddelbart (ingen mellomlagring av tillatelser)", async () => {
    const p = profile({ validUntil: "2026-10-16T12:30:00Z" });
    const before = await previewForDisplay(spec(), { now: () => NOW, profiles: [p] });
    const after = await previewForDisplay(spec(), { now: () => new Date("2026-10-16T12:31:00Z"), profiles: [p] });
    if (!before.ok || !after.ok) throw new Error("kilden feilet");
    expect(before.items.length).toBeGreaterThan(0);
    expect(after.items).toHaveLength(0);
  });
});

describe("DATA-002B: retensjon, cache og geografi", () => {
  const p = profile({ storage: { ...profile().storage, retentionSeconds: 3600 }, validUntil: "2026-10-16T12:30:00Z" });
  it("utløp = hentetid + retensjon, kappet ved profilens slutt; 0 = ingen lagring", () => {
    expect(retentionExpiresAt(profile(), new Date("2026-10-16T10:00:00Z"))?.toISOString()).toBe("2026-10-16T11:00:00.000Z");
    expect(retentionExpiresAt(p, new Date("2026-10-16T12:00:00Z"))?.toISOString()).toBe("2026-10-16T12:30:00.000Z"); // kappet
    expect(retentionExpiresAt(profile({ storage: { ...profile().storage, retentionSeconds: 0 } }), NOW)).toBeNull();
  });
  it("synlig bare mens retensjonen ikke er nådd OG profilen er i kraft", () => {
    const got = new Date("2026-10-16T11:30:00Z");
    expect(isWithinRetention(profile(), got, new Date("2026-10-16T12:29:59Z"))).toBe(true);
    expect(isWithinRetention(profile(), got, new Date("2026-10-16T12:30:00Z"))).toBe(false); // nådd
    expect(isWithinRetention(profile({ status: "revoked" }), got, new Date("2026-10-16T11:31:00Z"))).toBe(false); // trukket skjuler umiddelbart
    expect(isWithinRetention(p, new Date("2026-10-16T11:59:00Z"), new Date("2026-10-16T12:31:00Z"))).toBe(false); // profil utløpt
    expect(isWithinRetention(profile({ storage: { ...profile().storage, retentionSeconds: 0 } }), got, got)).toBe(false);
  });
  it("geografi: ukjent land er aldri tillatt når det finnes begrensninger", () => {
    const g = profile({ geography: { unrestricted: false, countries: ["DE", "NL"] } });
    expect(geographyAllows(g, "DE")).toBe(true);
    expect(geographyAllows(g, "FR")).toBe(false);
    expect(geographyAllows(g, null)).toBe(false);
    expect(geographyAllows(profile(), null)).toBe(true);
  });
});

describe("DATA-002B: syntetisk regresjon og eksempelprofil", () => {
  it("synthetic-demo v1 er gyldig, i kraft, speiler DB-raden og gir samme visning som før", () => {
    expect(validateProfile(SYNTHETIC_RIGHTS_PROFILE)).toEqual([]);
    const r = resolveRights("synthetic-demo", REGISTERED_PROFILES, NOW);
    expect(r.inForce && r.profile.version).toBe(1);
    expect(SYNTHETIC_DISPLAY_POLICY).toMatchObject({ profileId: "synthetic-demo", profileVersion: 1, environment: "synthetic", attribution: "Syntetiske demodata – ikke ekte leverandørdata", providerName: "Syntetisk demokilde" });
    expect(Object.values(SYNTHETIC_DISPLAY_POLICY.allow).every((v) => v === true)).toBe(true);
    expect(Object.isFrozen(SYNTHETIC_DISPLAY_POLICY)).toBe(true);
    expect(SYNTHETIC_RIGHTS_PROFILE.display.images).toBe(false);
    expect(SYNTHETIC_RIGHTS_PROFILE.storage).toMatchObject({ retentionSeconds: 604_800, cacheSeconds: 0, historyRetentionSeconds: 0 });
  });
  it("kun den syntetiske profilen er registrert i kjøretiden", () => {
    expect(REGISTERED_PROFILES.map((x) => `${x.providerId}@${x.version}`)).toEqual(["synthetic-demo@1"]);
  });
  it("mobile-sandbox-eksemplet er et utkast uten noen rettigheter, ikke registrert, og gir ingenting selv om det ble verifisert", () => {
    expect(REGISTERED_PROFILES.some((x) => x.providerId === "mobile-sandbox")).toBe(false);
    expect(validateProfile(MOBILE_SANDBOX_EXAMPLE)).toEqual([]); // gyldig som utkast
    const r = resolveRights("mobile-sandbox", [MOBILE_SANDBOX_EXAMPLE], NOW);
    expect(r).toMatchObject({ inForce: false, reason: "not_verified" });
    expect(Object.values(MOBILE_SANDBOX_EXAMPLE.display).concat(Object.values(MOBILE_SANDBOX_EXAMPLE.matching)).some(Boolean)).toBe(false);
    expect(MOBILE_SANDBOX_EXAMPLE.storage.retentionSeconds).toBe(0);
    // «verifisert» uten å ha lagt inn noen rettigheter gir fortsatt ingenting (tillatelser må settes eksplisitt)
    const forced: ProviderRightsProfile = { ...MOBILE_SANDBOX_EXAMPLE, status: "verified", verifiedBy: "test", verifiedAt: "2026-10-16T00:00:00Z", providerName: "Eksempel", attribution: { required: true, text: "Sandbox" } };
    const rf = resolveRights("mobile-sandbox", [forced], NOW);
    expect(rf.inForce).toBe(true);
    expect(Object.values(toDisplayPolicy(rf).allow).every((v) => v === false)).toBe(true);
    for (const k of RIGHTS_FIELD_KEYS) { expect(canDisplay(rf, k)).toBe(false); expect(canMatch(rf, k)).toBe(false); }
  });
});
