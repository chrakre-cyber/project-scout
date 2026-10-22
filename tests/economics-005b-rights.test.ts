/**
 * ECON-005b — rettigheter for avledet økonomiberegning (`derivedEconomics.allow` per kildefelt + egen visningsrett). Rent domene; ingen DB her
 * (samsvar mot SQL: `tests/db/econ005b-rights.test.ts`). Profilene er syntetiske/hypotetiske testdata; ingen leverandør har gitt noen rettighet.
 */
import { describe, expect, it } from "vitest";
import {
  ECONOMICS_FIELD_KEYS, REGISTERED_PROFILES, SYNTHETIC_RIGHTS_PROFILE, canDeriveEconomics, canDisplayEconomics, economicsDecision, noEconomicsRights, resolveRights, validateProfile,
  type EconomicsFieldKey, type ProviderRightsProfile,
} from "@/domain/provider-rights";
import { buildProvenance, canonicalPermissions, evaluateProvenance } from "@/domain/provenance";
import { createHash } from "node:crypto";
import { profileDigest } from "@/server/public-ids";
import { sentinelListing } from "./fixtures/display-sentinel";
import { MOBILE_SANDBOX_EXAMPLE, profile } from "./fixtures/rights-profiles";

const NOW = new Date("2026-10-20T12:00:00Z");
const allow = (over: Partial<Record<EconomicsFieldKey, boolean>> = {}) => ({ ...noEconomicsRights(), ...over });
type ProfileOver = NonNullable<Parameters<typeof profile>[0]>;
const withEcon = (allowed: Partial<Record<EconomicsFieldKey, boolean>>, display: boolean, over: ProfileOver = {}) =>
  profile({ derivedEconomics: { allow: allow(allowed), display }, ...over });
const rights = (p: ProviderRightsProfile, now = NOW) => resolveRights(p.providerId, [p], now);
const ALL = { price: true, registration: true, specs: true } as const;

describe("default nei", () => {
  it("fixture-/eksempelprofiler uten uttrykkelig tillatelse gir ingen avledet økonomi, heller ikke med full visnings- og matchingsrett", () => {
    const r = rights(profile()); // display/matching: alle felt unntatt images; derivedEconomics: default nei
    expect(r.inForce).toBe(true);
    expect(canDeriveEconomics(r, ["price"])).toBe(false);
    expect(economicsDecision(r, ["price"], ["price"])).toEqual({ derive: false, display: false, reason: "field_not_granted" });
    expect(noEconomicsRights()).toEqual({ price: false, registration: false, specs: false });
    expect(MOBILE_SANDBOX_EXAMPLE.derivedEconomics).toEqual({ allow: noEconomicsRights(), display: false });
  });
  it("sandbox og live får ingenting automatisk, selv verifiserte og i kraft", () => {
    for (const environment of ["sandbox", "live"] as const) {
      const r = rights(profile({ environment, providerId: "eksempel-kilde", providerName: "Eksempel" }));
      expect(r.inForce).toBe(true);
      expect(economicsDecision(r, ECONOMICS_FIELD_KEYS, ["price"])).toMatchObject({ derive: false, display: false });
    }
  });
  it("bare den syntetiske demoprofilen er registrert, og den har uttrykkelig true for alle tre felt og visning", () => {
    expect(REGISTERED_PROFILES.map((p) => p.providerId)).toEqual(["synthetic-demo"]);
    expect(SYNTHETIC_RIGHTS_PROFILE.environment).toBe("synthetic");
    expect(SYNTHETIC_RIGHTS_PROFILE.derivedEconomics).toEqual({ allow: ALL, display: true });
    expect(economicsDecision(rights(SYNTHETIC_RIGHTS_PROFILE), ECONOMICS_FIELD_KEYS, ["price"])).toEqual({ derive: true, display: true, reason: null });
  });
  it("ukjent leverandør ⇒ avslag (ingen profil)", () => {
    const r = resolveRights("ukjent", REGISTERED_PROFILES, NOW);
    expect(economicsDecision(r, ["price"])).toEqual({ derive: false, display: false, reason: "unknown_provider" });
  });
});

describe("rettighetskombinasjoner: beregning × visning × visningsrett for avslørt felt", () => {
  const cases: Array<[string, boolean, boolean, boolean, { derive: boolean; display: boolean; reason: string | null }]> = [
    // [navn, beregning price, derived-display, display.price, forventet]
    ["beregning nei, visning nei", false, false, true, { derive: false, display: false, reason: "field_not_granted" }],
    ["beregning ja, visning nei", true, false, true, { derive: true, display: false, reason: "display_not_granted" }],
    ["beregning ja, visning ja, prisvisning ja", true, true, true, { derive: true, display: true, reason: null }],
    ["beregning ja, visning ja, prisvisning NEI ⇒ avslører pris uten rett", true, true, false, { derive: true, display: false, reason: "reveal_not_granted" }],
  ];
  it.each(cases)("%s", (_n, derive, derivedDisplay, priceDisplay, want) => {
    const p = withEcon({ price: derive }, derivedDisplay && derive, { display: { price: priceDisplay } });
    // «visning ja uten beregning» er ugyldig profil (egen test); her testes bare gyldige profiler
    expect(validateProfile(p)).toEqual([]);
    expect(economicsDecision(rights(p), ["price"], ["price"])).toEqual(want);
  });
  it("visning som ikke avslører pris trenger ikke prisvisningsrett (reveals = [])", () => {
    const p = withEcon({ price: true }, true, { display: { price: false } });
    expect(economicsDecision(rights(p), ["price"], [])).toEqual({ derive: true, display: true, reason: null });
    expect(canDisplayEconomics(rights(p), ["price"], ["price"])).toBe(false);
  });
  it("rettighetene er uavhengige: matching og visning gir ikke beregning, beregning gir ikke visning eller matching", () => {
    const m = rights(profile({ matching: { price: true, registration: true, specs: true }, display: { price: true, registration: true, specs: true } }));
    expect(canDeriveEconomics(m, ECONOMICS_FIELD_KEYS)).toBe(false);
    const d = withEcon(ALL, false, { display: { price: false, registration: false, specs: false }, matching: { price: false, registration: false, specs: false } });
    const r = rights(d);
    expect(canDeriveEconomics(r, ECONOMICS_FIELD_KEYS)).toBe(true);
    expect(canDisplayEconomics(r, ECONOMICS_FIELD_KEYS)).toBe(false);
    expect(r.inForce && r.profile.matching.price).toBe(false);
  });
  it("avledet visning krever beregningsrett for de samme feltene (kan ikke vise det som ikke kan beregnes)", () => {
    const r = rights(withEcon({ price: true }, true));
    expect(canDisplayEconomics(r, ["price", "specs"])).toBe(false);
    expect(canDisplayEconomics(r, ["price"])).toBe(true);
  });
});

describe("feltbegrensninger", () => {
  const keys = ECONOMICS_FIELD_KEYS;
  it.each(keys)("kun %s tillatt: bare dette feltet (alene) kan brukes", (only) => {
    const r = rights(withEcon({ [only]: true }, true));
    for (const k of keys) expect(canDeriveEconomics(r, [k])).toBe(k === only);
    expect(canDeriveEconomics(r, keys)).toBe(false);
    for (const k of keys) if (k !== only) expect(economicsDecision(r, [only, k])).toMatchObject({ derive: false, reason: "field_not_granted" });
  });
  it("alle undermengder av felt: tillatt bare når hvert felt er tillatt", () => {
    for (let mask = 0; mask < 8; mask++) {
      const granted = keys.filter((_, i) => mask & (1 << i));
      const r = rights(withEcon(Object.fromEntries(granted.map((k) => [k, true])), granted.length > 0));
      for (let q = 1; q < 8; q++) {
        const used = keys.filter((_, i) => q & (1 << i));
        expect(canDeriveEconomics(r, used)).toBe(used.every((k) => granted.includes(k)));
      }
    }
  });
  it("tom feltliste og ukjente/ikke-økonomifelt (title, mileage, images, tilfeldig) gir nei, også med alle økonomifelt tillatt", () => {
    const r = rights(withEcon(ALL, true));
    expect(canDeriveEconomics(r, [])).toBe(false);
    expect(economicsDecision(r, [])).toEqual({ derive: false, display: false, reason: "no_fields" });
    for (const f of ["title", "mileage", "images", "seller_location", "vin", "", "PRICE", "constructor", "__proto__"]) {
      expect(canDeriveEconomics(r, [f])).toBe(false);
      expect(canDeriveEconomics(r, ["price", f])).toBe(false);
    }
    expect(canDisplayEconomics(r, ["price"], ["vin"])).toBe(false);
    expect(canDisplayEconomics(r, ["price"], ["constructor"])).toBe(false);
  });
});

describe("profilgyldighet: manglende, ugyldig, utløpt, tilbakekalt ⇒ avslag", () => {
  const good = (over: ProfileOver = {}) => withEcon(ALL, true, over);
  it.each<[string, ProfileOver, string]>([
    ["utkast", { status: "draft", verifiedBy: null, verifiedAt: null }, "not_verified"],
    ["tilbakekalt", { status: "revoked" }, "revoked"],
    ["utløpt", { validUntil: "2026-10-20T12:00:00Z" }, "expired"], // eksklusiv slutt = nå
    ["ikke begynt", { validFrom: "2026-10-21T00:00:00Z" }, "not_started"],
  ])("%s", (_n, over, reason) => {
    const r = rights(good(over));
    expect(r.inForce).toBe(false);
    expect(economicsDecision(r, ["price"], ["price"])).toEqual({ derive: false, display: false, reason });
    expect(canDeriveEconomics(r, ["price"])).toBe(false);
    expect(canDisplayEconomics(r, ["price"])).toBe(false);
  });
  it("sluttid i fremtiden gjelder; ett millisekund før slutt gir rett, på slutten ikke", () => {
    const p = good({ validUntil: "2026-10-20T12:00:00Z" });
    expect(economicsDecision(rights(p, new Date("2026-10-20T11:59:59.999Z")), ["price"], ["price"]).display).toBe(true);
    expect(economicsDecision(rights(p, new Date("2026-10-20T12:00:00Z")), ["price"]).derive).toBe(false);
  });
  it.each<[string, unknown]>([
    ["manglende derivedEconomics", undefined],
    ["ekstra nøkkel", { allow: { ...ALL, mileage: true }, display: true }],
    ["manglende nøkkel", { allow: { price: true, registration: true }, display: true }],
    ["tomt kart, visning false", { allow: {}, display: false }],
    ["tomt kart, visning true", { allow: {}, display: true }],
    ["ikke-boolsk felt", { allow: { ...ALL, price: "ja" }, display: true }],
    ["ikke-boolsk visning", { allow: ALL, display: "ja" }],
    ["visning uten noe tillatt felt", { allow: noEconomicsRights(), display: true }],
  ])("ugyldig profil (%s) avviser ALT, også øvrige rettigheter", (_n, de) => {
    const p = { ...good(), derivedEconomics: de } as unknown as ProviderRightsProfile;
    expect(validateProfile(p)).toContain("derivedEconomics");
    const r = rights(p);
    expect(r).toMatchObject({ inForce: false, reason: "invalid_profile" });
    expect(economicsDecision(r, ["price"], ["price"])).toMatchObject({ derive: false, display: false, reason: "invalid_profile" });
  });
  it("versjoner: høyeste verifiserte versjon i kraft gjelder; ny utkast-versjon eller utløpt ny versjon endrer ikke tilgjengelig rett feil vei", () => {
    const v1 = good({ version: 1, validUntil: "2026-12-01T00:00:00Z" });
    const v2deny = withEcon(allow(), false, { version: 2, validFrom: "2026-10-10T00:00:00Z" });
    const r = resolveRights("synthetic-demo", [v1, v2deny], NOW);
    expect(r.inForce && r.profile.version).toBe(2); // ny versjon uten rett gjelder ⇒ nei (rett kan fjernes ved ny versjon)
    expect(canDeriveEconomics(r, ["price"])).toBe(false);
    const draft2 = good({ version: 2, status: "draft", verifiedBy: null, verifiedAt: null });
    const r2 = resolveRights("synthetic-demo", [withEcon(allow(), false), draft2], NOW);
    expect(canDeriveEconomics(r2, ["price"])).toBe(false); // utkast med rett åpner ikke noe
    const revoked = good({ version: 1, status: "revoked" });
    expect(canDeriveEconomics(resolveRights("synthetic-demo", [revoked, good({ version: 2, status: "draft", verifiedBy: null, verifiedAt: null })], NOW), ["price"])).toBe(false);
  });
});

describe("avtrykk og validering", () => {
  it("endret avledet-økonomi-rett endrer rettighetsavtrykket (oppdages som endring på plass)", () => {
    const a = canonicalPermissions(withEcon({ price: true }, true));
    expect(a).not.toBe(canonicalPermissions(withEcon({ price: true }, false)));
    expect(a).not.toBe(canonicalPermissions(withEcon({ price: true, specs: true }, true)));
    expect(a).toBe(canonicalPermissions(withEcon({ price: true }, true)));
  });
  it("gyldige profiler: alle åtte kombinasjoner av felt uten visning, og visning med minst ett felt", () => {
    for (let mask = 0; mask < 8; mask++) {
      const granted = ECONOMICS_FIELD_KEYS.filter((_, i) => mask & (1 << i));
      const obj = Object.fromEntries(granted.map((k) => [k, true]));
      expect(validateProfile(withEcon(obj, false))).toEqual([]);
      expect(validateProfile(withEcon(obj, true)).includes("derivedEconomics")).toBe(granted.length === 0);
    }
  });
});

describe("canonicalPermissions-format: nytt felt endrer avtrykket (bevisst; eldre proveniens skrives ikke om)", () => {
  const p = profile({ version: 3, validUntil: "2026-12-01T00:00:00Z", storage: { ...profile().storage, retentionSeconds: 3600 } });
  const prov = (digest: string) => buildProvenance({ listing: sentinelListing(), publicId: "m1_AAAAAAAAAAAAAAAAAAAAAAAA", profile: p, profileDigest: digest, retrievedAt: new Date("2026-10-20T11:30:00Z"), schemaVersion: "synthetic-demo@1" });
  const ev = (digest: string) => evaluateProvenance(prov(digest), { profiles: [p], now: NOW, digestOf: profileDigest });
  it("avtrykk beregnet i det gamle formatet (uten `derivedEconomics`) gir `rights_changed`, selv om rettighetene i praksis er uendret; nytt format gir `valid`", () => {
    const oldFormat = JSON.stringify((() => { const o = JSON.parse(canonicalPermissions(p)) as Record<string, unknown>; delete o.derivedEconomics; return o; })());
    expect(oldFormat).not.toBe(canonicalPermissions(p));
    const oldDigest = createHash("sha256").update(oldFormat).digest("hex");
    expect(oldDigest).not.toBe(profileDigest(p));
    expect(ev(oldDigest)).toBe("rights_changed");
    expect(ev(profileDigest(p))).toBe("valid");
  });
  it("det nye feltet er med i det kanoniske formatet, nøkkelrekkefølge-uavhengig", () => {
    expect(JSON.parse(canonicalPermissions(p)).derivedEconomics).toEqual({ allow: { price: false, registration: false, specs: false }, display: false });
  });
});
