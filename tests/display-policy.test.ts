import { describe, expect, it } from "vitest";
import {
  DISPLAY_FIELD_KEYS, applyDisplayPolicy, denyAllPolicy, policyAllowing, policyInEffect,
  type DisplayFieldKey, type DisplayPolicy,
} from "@/domain/display-policy";
import { SYNTHETIC_DISPLAY_POLICY, policyForSource } from "@/domain/provider-rights";
import { sentinelListing } from "./fixtures/display-sentinel";

const NOW = new Date("2026-10-16T12:00:00Z");
const PID = "m1_AAAAAAAAAAAAAAAAAAAAAAAA";
const ap = (l: Parameters<typeof applyDisplayPolicy>[0], p: DisplayPolicy, n: Date, o: { unavailable?: readonly DisplayFieldKey[] } = {}) => applyDisplayPolicy(l, p, n, { publicId: PID, ...o });

const SENTINELS = ["SENTINEL-MERKE", "SENTINEL-MODELL", "SENTINEL-VARIANT", "31337", "3133700", "SENTINEL-PRISBELEGG", "SENTINEL-MVA", "424242", "SENTINEL-FARGE",
  "SENTINEL-FRITEKST", "12345678", "SENTINEL-BY", "sentinel-url", "2026-10-01T08:00", "SENTINEL-PROVENANS", "777", "Syntetisk demokilde"];
const KEYS_PER_SENTINEL: Record<DisplayFieldKey, string[]> = {
  title: ["SENTINEL-MERKE", "SENTINEL-MODELL", "SENTINEL-VARIANT"],
  price: ["31337", "3133700", "SENTINEL-PRISBELEGG", "SENTINEL-MVA"],
  mileage: ["424242"],
  registration: ['"year":2019'],
  specs: ["SENTINEL-FARGE", '"diesel"', '"automatic"', '"estate"', "777"],
  text: ["SENTINEL-FRITEKST", "12345678"],
  sellerType: ['"dealer"'],
  sellerLocation: ["SENTINEL-BY", '"DE"'],
  listingDates: ["2026-10-01T08:00"],
  providerName: ["Syntetisk demokilde"],
  sourceUrl: ["sentinel-url"],
  // `listingId` er en intern navigasjonsnøkkel og bærer samme verdi; visningsretten gjelder det separate feltet `providerListingId`.
  providerListingId: [],
};

describe("DATA-002A: applyDisplayPolicy — feltstater", () => {
  it("syntetisk profil: alle felt er `value` med de oppgitte verdiene; attribusjonen er med", () => {
    const d = ap(sentinelListing(), SYNTHETIC_DISPLAY_POLICY, NOW);
    expect(d.title).toEqual({ state: "value", value: { make: "SENTINEL-MERKE", model: "SENTINEL-MODELL", variant: "SENTINEL-VARIANT" } });
    expect(d.mileage).toEqual({ state: "value", value: { value: 424_242, unit: "km" } });
    expect(d.specs.fuel).toEqual({ state: "value", value: "diesel" });
    expect(d.text.state).toBe("value");
    expect(d.sourceUrl).toEqual({ state: "value", value: "https://sentinel-url.example/ad/1" });
    expect(d.attribution).toBe("Syntetiske demodata – ikke ekte leverandørdata");
    expect(d.policy).toMatchObject({ profileId: "synthetic-demo", environment: "synthetic", inEffect: true });
  });

  it("forbudt felt ⇒ `withheld`, og ingen verdi fra feltet finnes i utdata — ett felt av gangen", () => {
    for (const key of DISPLAY_FIELD_KEYS) {
      const policy = policyAllowing(SYNTHETIC_DISPLAY_POLICY, DISPLAY_FIELD_KEYS.filter((k) => k !== key));
      const d = ap(sentinelListing(), policy, NOW);
      const json = JSON.stringify(d);
      for (const s of KEYS_PER_SENTINEL[key]) expect(json, `${key}: ${s}`).not.toContain(s);
      // de andre feltene er fortsatt synlige
      for (const other of DISPLAY_FIELD_KEYS.filter((k) => k !== key)) for (const s of KEYS_PER_SENTINEL[other].filter((x) => x.startsWith("SENTINEL") && !KEYS_PER_SENTINEL[key].includes(x))) expect(json, `${other}: ${s}`).toContain(s);
    }
  });

  it("ingen felt tillatt (default-deny): alt `withheld`, ingen sentinel noe sted", () => {
    const d = ap(sentinelListing(), policyAllowing(SYNTHETIC_DISPLAY_POLICY, []), NOW);
    const json = JSON.stringify(d);
    for (const s of SENTINELS) expect(json, s).not.toContain(s);
    expect(d.title).toEqual({ state: "withheld" });
    expect(d.specs).toEqual({ fuel: { state: "withheld" }, transmission: { state: "withheld" }, bodyType: { state: "withheld" }, powerKw: { state: "withheld" }, color: { state: "withheld" } });
  });

  it("lat evaluering: et forbudt felt leses aldri fra den rå annonsen", () => {
    const touched: string[] = [];
    const wrap = <T extends object>(o: T, path: string): T => new Proxy(o, {
      get(t, p, r) { const v = Reflect.get(t, p, r); touched.push(`${path}.${String(p)}`); return v !== null && typeof v === "object" ? wrap(v as object, `${path}.${String(p)}`) : v; },
    });
    const raw = sentinelListing();
    const policy = policyAllowing(SYNTHETIC_DISPLAY_POLICY, ["title", "registration"]);
    ap(wrap(raw, "l"), policy, NOW);
    const read = touched.join(" ");
    expect(read).toMatch(/l\.specs\.make/);
    expect(read).toMatch(/l\.specs\.firstRegistration/);
    for (const forbidden of ["l.price", "l.text", "l.seller", "l.originalUrl", "l.sourceModifiedAt", "l.specs.mileage", "l.specs.fuel", "l.specs.color", "l.specs.powerKw"]) {
      expect(touched.filter((t) => t === forbidden || t.startsWith(`${forbidden}.`)), forbidden).toEqual([]);
    }
  });

  it("unknown ≠ withheld ≠ unavailable: tillatt men ikke oppgitt er `unknown`; forbudt og ikke oppgitt er likevel `withheld`", () => {
    const l = sentinelListing();
    l.price = null; l.text = null; l.seller = null; l.originalUrl = null; l.sourceModifiedAt = null;
    l.specs.mileage = null; l.specs.variant = null; l.specs.color = null; l.specs.fuel = null;
    const open = ap(l, SYNTHETIC_DISPLAY_POLICY, NOW);
    expect(open.price).toEqual({ state: "unknown" });
    expect(open.text).toEqual({ state: "unknown" });
    expect(open.sellerType).toEqual({ state: "unknown" });
    expect(open.sellerLocation).toEqual({ state: "unknown" });
    expect(open.sourceUrl).toEqual({ state: "unknown" });
    expect(open.listingDates).toEqual({ state: "unknown" });
    expect(open.mileage).toEqual({ state: "unknown" });
    expect(open.specs.fuel).toEqual({ state: "unknown" });
    expect(open.title).toMatchObject({ state: "value", value: { variant: null } }); // ukjent variant er null, ikke oppdiktet
    const closed = ap(l, policyAllowing(SYNTHETIC_DISPLAY_POLICY, []), NOW);
    expect(closed.price).toEqual({ state: "withheld" });
    expect(closed.mileage).toEqual({ state: "withheld" });
    const unav = ap(sentinelListing(), SYNTHETIC_DISPLAY_POLICY, NOW, { unavailable: ["text", "price"] });
    expect(unav.text).toEqual({ state: "unavailable" });
    expect(unav.price).toEqual({ state: "unavailable" });
    expect(JSON.stringify(unav)).not.toContain("SENTINEL-FRITEKST");
    expect(unav.title.state).toBe("value");
    // forbudt vinner over «utilgjengelig»
    const both = ap(sentinelListing(), policyAllowing(SYNTHETIC_DISPLAY_POLICY, []), NOW, { unavailable: ["text"] });
    expect(both.text).toEqual({ state: "withheld" });
  });

  it("0 og tom verdi gjøres ikke om: pris 0 forblir ikke funnet-opp; km 0 er en verdi", () => {
    const l = sentinelListing();
    l.specs.mileage = { value: 0, unit: "km" };
    expect(ap(l, SYNTHETIC_DISPLAY_POLICY, NOW).mileage).toEqual({ state: "value", value: { value: 0, unit: "km" } });
  });

  it("verdier klones: endring av rå annonse eller visningsmodell påvirker ikke den andre", () => {
    const l = sentinelListing();
    const d = ap(l, SYNTHETIC_DISPLAY_POLICY, NOW);
    if (d.price.state !== "value" || d.mileage.state !== "value") throw new Error("forventet verdi");
    expect(d.price.value).not.toBe(l.price);
    d.mileage.value.value = 1;
    expect(l.specs.mileage!.value).toBe(424_242);
  });
});

describe("DATA-002A: profiler — default-deny", () => {
  it("ukjent kilde får deny-all: alt `withheld`", () => {
    const p = policyForSource("noen-ekte-leverandor", NOW);
    expect(p.environment).toBe("unverified");
    const d = ap(sentinelListing("noen-ekte-leverandor"), p, NOW);
    const json = JSON.stringify(d);
    for (const s of SENTINELS) expect(json, s).not.toContain(s);
    expect(Object.values(p.allow).every((v) => v === false)).toBe(true);
  });

  it("profil utenfor virkningsperioden (ikke begynt / utløpt) ⇒ alt `withheld`, `inEffect` false", () => {
    const early: DisplayPolicy = { ...SYNTHETIC_DISPLAY_POLICY, effectiveFrom: "2026-11-01T00:00:00Z" };
    const expired: DisplayPolicy = { ...SYNTHETIC_DISPLAY_POLICY, effectiveTo: "2026-10-16T12:00:00Z" }; // slutt er eksklusiv
    for (const p of [early, expired]) {
      expect(policyInEffect(p, NOW)).toBe(false);
      const d = ap(sentinelListing(), p, NOW);
      expect(d.policy.inEffect).toBe(false);
      for (const s of SENTINELS) expect(JSON.stringify(d), s).not.toContain(s);
    }
    expect(policyInEffect({ ...SYNTHETIC_DISPLAY_POLICY, effectiveFrom: "2026-10-16T12:00:00Z" }, NOW)).toBe(true);
    expect(policyInEffect(SYNTHETIC_DISPLAY_POLICY, new Date("invalid"))).toBe(false);
  });

  it("den syntetiske profilen er den eneste som gir synlighet; alle andre kilder nektes", () => {
    expect(policyForSource("synthetic-demo", NOW)).toEqual(SYNTHETIC_DISPLAY_POLICY);
    expect(policyForSource("mobile-de-sandbox", NOW).profileId).toBe("deny:mobile-de-sandbox");
    expect(denyAllPolicy("x").allow.price).toBe(false);
  });

  it("profilobjektet for syntetisk kilde er frosset (kan ikke myke opp ved et uhell)", () => {
    expect(Object.isFrozen(SYNTHETIC_DISPLAY_POLICY)).toBe(true);
    expect(Object.isFrozen(SYNTHETIC_DISPLAY_POLICY.allow)).toBe(true);
  });
});
