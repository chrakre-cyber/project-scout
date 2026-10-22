/**
 * ECON-006e: fornyelse av syntetiske demodata. Prøver feilmodiene: fremtidig epoke uten toleranse, uendret identitet/revisjon,
 * vindu 0–48 t, uendret utløpskontroll (retensjon fra profilen) og ingen rullering.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isWithinRetention, retentionExpiresAt, SYNTHETIC_RIGHTS_PROFILE } from "@/domain/provider-rights";
import { getMarketplaceProvider } from "@/providers/marketplace";
import {
  configuredSyntheticEpoch, epochDateNo, epochFloors, OBSERVATION_WINDOW_HOURS, renewObservations, SYNTHETIC_DEFAULT_EPOCH,
  syntheticGeneratedText, validateSyntheticEpoch,
} from "@/providers/marketplace/synthetic/epoch";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { EMPTY_QUERY, SyntheticMarketplaceProvider, syntheticDatasetLabel } from "@/providers/marketplace/synthetic/provider";
import { registeredCandidateAdapter } from "@/server/candidate-pairing";
import type { NormalizedListing } from "@/domain/types";

const FLOORS = epochFloors(syntheticRawListings);
const H = 3_600_000;
const D = 24 * H;
const EPOCH = "2026-12-01T12:00:00Z";
const EPOCH_MS = Date.parse(EPOCH);
const NOW = new Date(EPOCH_MS + 1000);

async function all(p: SyntheticMarketplaceProvider): Promise<NormalizedListing[]> {
  const out: NormalizedListing[] = [];
  let page: number | null = 1;
  while (page !== null) {
    const r = await p.search(EMPTY_QUERY, { page, pageSize: 100 });
    out.push(...r.items);
    page = r.nextPage;
  }
  return out;
}

afterEach(() => vi.unstubAllEnvs());

describe("validering av epoken (≤ nå, ingen toleranse)", () => {
  const v = (value: unknown, now: Date = NOW) => validateSyntheticEpoch(value, now, FLOORS);
  it("eksakt nåtid godtas; ett sekund frem i tid avvises; ingen justering eller klemming", () => {
    expect(v(EPOCH, new Date(EPOCH_MS))).toEqual({ ok: true, epoch: EPOCH });
    expect(v(EPOCH, new Date(EPOCH_MS - 1000))).toEqual({ ok: false, reason: "in_future" });
    expect(v(EPOCH, new Date(EPOCH_MS - 1))).toEqual({ ok: false, reason: "in_future" });
    expect(v("2026-12-01T12:05:00Z", new Date(EPOCH_MS))).toEqual({ ok: false, reason: "in_future" }); // ikke 5 minutters toleranse
  });
  it("kun eksakt UTC-format og ekte kalenderdato", () => {
    for (const bad of ["", "2026-12-01", "2026-12-01T12:00:00", "2026-12-01T12:00:00.000Z", "2026-12-01T12:00:00+00:00", "2026-12-01 12:00:00Z", "2026-12-01t12:00:00z", "2026-02-30T12:00:00Z", "2026-13-01T12:00:00Z", "2026-12-01T24:00:00Z", " 2026-12-01T12:00:00Z", "1764590400", null, undefined, 1764590400000]) {
      expect(v(bad), String(bad)).toEqual({ ok: false, reason: "format" });
    }
  });
  it("observasjonsvinduet må ligge innenfor rettighetsprofilens gyldighet og etter datasettets siste endringstid", () => {
    const validFrom = Date.parse(SYNTHETIC_RIGHTS_PROFILE.validFrom);
    const now = new Date("2027-01-01T00:00:00Z");
    const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
    expect(v(iso(validFrom + 48 * H - 1000), now)).toEqual({ ok: false, reason: "before_profile" });
    const latestModified = FLOORS.datasetLatestModifiedMs!;
    expect(latestModified).toBe(Date.parse("2026-10-05T09:00:00Z"));
    expect(v(iso(latestModified + 48 * H - 1000), now)).toEqual({ ok: false, reason: "before_dataset" });
    expect(v(iso(latestModified + 48 * H), now)).toEqual({ ok: true, epoch: iso(latestModified + 48 * H) });
  });
  it("den innebygde standardepoken er gyldig og i fortiden (ingen tidsbombe i selve konstanten)", () => {
    expect(v(SYNTHETIC_DEFAULT_EPOCH, new Date(Date.parse(SYNTHETIC_DEFAULT_EPOCH))).ok).toBe(true);
    expect(Date.parse(SYNTHETIC_DEFAULT_EPOCH)).toBeLessThanOrEqual(Date.now());
  });
  it("konfigurasjon: ikke satt eller tom ⇒ standardepoke; alt annet gis videre til valideringen uendret", () => {
    expect(configuredSyntheticEpoch(undefined)).toBe(SYNTHETIC_DEFAULT_EPOCH);
    expect(configuredSyntheticEpoch("")).toBe(SYNTHETIC_DEFAULT_EPOCH);
    expect(configuredSyntheticEpoch("nonsens")).toBe("nonsens");
    expect(configuredSyntheticEpoch(" 2026-12-01T12:00:00Z")).toBe(" 2026-12-01T12:00:00Z");
  });
});

describe("fornyelse av observasjonstider", () => {
  const renewed = renewObservations(syntheticRawListings, EPOCH);
  it("alle observasjoner ligger i [epoke − 48 t, epoke]; lastSeenAt ≥ firstSeenAt; hele sekunder; ekstremene treffer vinduets kanter", () => {
    expect(OBSERVATION_WINDOW_HOURS).toBe(48);
    const times: number[] = [];
    for (const r of renewed) {
      const f = Date.parse(r.observed.firstSeenAt), l = Date.parse(r.observed.lastSeenAt);
      expect(f).toBeGreaterThanOrEqual(EPOCH_MS - 48 * H);
      expect(l).toBeLessThanOrEqual(EPOCH_MS);
      expect(l).toBeGreaterThanOrEqual(f);
      expect(r.observed.firstSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      times.push(f, l);
    }
    expect(Math.min(...times)).toBe(EPOCH_MS - 48 * H);
    expect(Math.max(...times)).toBe(EPOCH_MS);
  });
  it("avbildningen er monoton: samme rekkefølge på alle observasjonstider som i malen", () => {
    const pairs = syntheticRawListings.flatMap((r, i) => [[Date.parse(r.observed.firstSeenAt), Date.parse(renewed[i]!.observed.firstSeenAt)], [Date.parse(r.observed.lastSeenAt), Date.parse(renewed[i]!.observed.lastSeenAt)]] as const);
    const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]![1]).toBeGreaterThanOrEqual(sorted[i - 1]![1]);
  });
  it("innhold og modifiedAt er byte-identiske; kun observed er endret; inndata er ikke mutert", () => {
    const before = JSON.stringify(syntheticRawListings);
    const again = renewObservations(syntheticRawListings, EPOCH);
    expect(JSON.stringify(syntheticRawListings)).toBe(before);
    renewed.forEach((r, i) => {
      expect({ ...r, observed: null }).toEqual({ ...syntheticRawListings[i]!, observed: null });
    });
    expect(again).toEqual(renewed); // deterministisk
  });
  it("poster med ugyldig tidspunkt røres ikke (normaliseringen avviser dem som før)", () => {
    const bad = { ...syntheticRawListings[0]!, observed: { firstSeenAt: "ikke-en-tid", lastSeenAt: "2026-10-04T00:00:00Z" } };
    const out = renewObservations([bad, syntheticRawListings[1]!], EPOCH);
    expect(out[0]).toBe(bad);
  });
});

describe("identitet og revisjon er uendret (baseline tatt før endringen)", () => {
  const baseline = JSON.parse(readFileSync(join(__dirname, "fixtures/synthetic-identity-baseline.json"), "utf8")) as { id: string; sourceModifiedAt: string | null; ok: boolean; candidateId: string | null; version: string | null }[];
  it("kandidat-id, revisjon og sourceModifiedAt er identiske med baseline for alle annonser", async () => {
    const listings = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => NOW, resultCap: 100_000 }));
    expect(listings.length).toBe(baseline.length);
    expect(baseline.length).toBeGreaterThan(100);
    const adapter = registeredCandidateAdapter()!;
    const now = listings.map((l) => {
      const r = adapter.adapt(l);
      return { id: l.sourceListingId, sourceModifiedAt: l.sourceModifiedAt, ok: r.ok, candidateId: r.ok ? r.candidate.id : null, version: r.ok ? r.candidate.version : null };
    });
    expect(now).toEqual(baseline);
  });
  it("lastSeenAt/firstSeenAt er faktisk endret (testen er ikke tom)", async () => {
    const listings = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => NOW }));
    expect(listings.every((l) => Date.parse(l.lastSeenAt) > Date.parse("2026-11-29T00:00:00Z"))).toBe(true);
  });
});

describe("standarddatasettet bruker epoken; ugyldig epoke feiler lukket", () => {
  it("normalisert lastSeenAt/firstSeenAt ligger i vinduet og aldri etter nå", async () => {
    const listings = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => NOW }));
    for (const l of listings) {
      expect(Date.parse(l.lastSeenAt)).toBeLessThanOrEqual(NOW.getTime());
      expect(Date.parse(l.lastSeenAt)).toBeLessThanOrEqual(EPOCH_MS);
      expect(Date.parse(l.firstSeenAt)).toBeGreaterThanOrEqual(EPOCH_MS - 48 * H);
    }
  });
  it("proveniens: «Syntetisk generert <dato> — ikke hentet fra leverandør», fortsatt syntetisk, og notat om simulerte tider", async () => {
    const [l] = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => NOW }));
    expect(l!.provenance.kind).toBe("synthetic");
    expect(l!.provenance.description.startsWith("Syntetisk generert 01.12.2026 — ikke hentet fra leverandør.")).toBe(true);
    expect(l!.provenance.description).toContain("Ikke en ekte annonse og ikke data fra en markedsplass.");
    expect(l!.provenance.normalizationNotes.some((n) => n.includes("simulert") && n.includes(EPOCH))).toBe(true);
    expect(syntheticGeneratedText(EPOCH)).toBe("Syntetisk generert 01.12.2026 — ikke hentet fra leverandør");
    expect(epochDateNo("2026-10-21T06:50:00Z")).toBe("21.10.2026");
  });
  it("egne poster uten epoke er uendret (ingen stille fornyelse)", async () => {
    const p = new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => new Date("2026-10-05T08:00:00Z") });
    const l = await p.getListing("demo-001");
    expect(l!.lastSeenAt).toBe(syntheticRawListings.find((r) => r.id === "demo-001")!.observed.lastSeenAt.replace("Z", ".000Z"));
    expect(l!.provenance.description).not.toContain("generert");
  });
  it("fremtidig epoke ⇒ alle kall feiler med unavailable; ingen annonser leveres", async () => {
    const p = new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => new Date(EPOCH_MS - 1000) });
    expect(p.usable).toBe(false);
    await expect(p.search(EMPTY_QUERY, {})).rejects.toMatchObject({ code: "unavailable" });
    await expect(p.getListing("demo-001")).rejects.toMatchObject({ code: "unavailable" });
    await expect(p.search(EMPTY_QUERY, {})).rejects.toThrow(/fremtiden/);
  });
  it("miljøvariabelen SCOUT_SYNTHETIC_EPOCH brukes ved standarddatasett; ugyldig verdi feiler lukket og mellomlagres ikke", async () => {
    vi.stubEnv("SCOUT_SYNTHETIC_EPOCH", "2026-10-21T06:00:00Z");
    const ok = new SyntheticMarketplaceProvider();
    expect(ok.usable).toBe(true);
    expect((await all(ok)).every((l) => Date.parse(l.lastSeenAt) <= Date.parse("2026-10-21T06:00:00Z"))).toBe(true);
    expect(syntheticDatasetLabel()).toBe("Syntetisk generert 21.10.2026 — ikke hentet fra leverandør");

    vi.stubEnv("SCOUT_SYNTHETIC_EPOCH", "i morgen");
    expect(syntheticDatasetLabel()).toBeNull();
    const bad = getMarketplaceProvider();
    await expect(bad.search(EMPTY_QUERY, {})).rejects.toMatchObject({ code: "unavailable" });
    vi.stubEnv("SCOUT_SYNTHETIC_EPOCH", "2099-01-01T00:00:00Z");
    await expect(getMarketplaceProvider().search(EMPTY_QUERY, {})).rejects.toMatchObject({ code: "unavailable" });
    expect(syntheticDatasetLabel()).toBeNull();

    vi.stubEnv("SCOUT_SYNTHETIC_EPOCH", "");
    expect(syntheticDatasetLabel(new Date(Date.parse(SYNTHETIC_DEFAULT_EPOCH)))).toBe(`Syntetisk generert ${epochDateNo(SYNTHETIC_DEFAULT_EPOCH)} — ikke hentet fra leverandør`);
  });
});

describe("utløpskontrollen er uendret og data blir utløpt igjen", () => {
  const profile = SYNTHETIC_RIGHTS_PROFILE;
  it("retensjon er fortsatt 7 døgn fra lastSeenAt: utløp ligger i [epoke + 5 d, epoke + 7 d]; alt er utløpt etter epoke + 7 d", async () => {
    expect(profile.storage.retentionSeconds).toBe(604_800);
    const listings = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => NOW }));
    const expiries = listings.map((l) => retentionExpiresAt(profile, new Date(l.lastSeenAt))!.getTime());
    const earliest = Math.min(...expiries);
    expect(earliest).toBeGreaterThanOrEqual(EPOCH_MS + 5 * D);
    expect(Math.max(...expiries)).toBeLessThanOrEqual(EPOCH_MS + 7 * D);
    const within = (at: number) => listings.filter((l) => isWithinRetention(profile, new Date(l.lastSeenAt), new Date(at))).length;
    expect(within(EPOCH_MS + 5 * D - 1000)).toBe(listings.length); // alt brukbart til og med 4 d 23 t 59 min 59 s
    expect(within(earliest - 1)).toBe(listings.length);
    expect(within(earliest)).toBeLessThan(listings.length); // første annonse utløper
    expect(within(EPOCH_MS + 7 * D)).toBe(0); // alt utløpt
    expect(within(EPOCH_MS + 30 * D)).toBe(0);
  });
});

describe("ingen rullering", () => {
  it("to leverandører med ulik klokke gir identiske observasjonstider (klokka flytter ikke dataene)", async () => {
    const a = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => new Date(EPOCH_MS) }));
    const b = await all(new SyntheticMarketplaceProvider({ epoch: EPOCH, now: () => new Date(EPOCH_MS + 90 * D) }));
    expect(b.map((l) => [l.sourceListingId, l.firstSeenAt, l.lastSeenAt])).toEqual(a.map((l) => [l.sourceListingId, l.firstSeenAt, l.lastSeenAt]));
  });
  it("standardepoken er en fast streng, og epokemodulen bruker verken klokke, tilfeldighet eller flyttall", () => {
    const code = readFileSync(join(__dirname, "../src/providers/marketplace/synthetic/epoch.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/Date\.now\(|new Date\(\)|Math\.|parseFloat|toFixed/);
    expect(code).toMatch(/SYNTHETIC_DEFAULT_EPOCH = "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    // ingen annen kode utleder epoken fra klokka
    const src = join(__dirname, "../src");
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const f of walk(src).filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith("epoch.ts"))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/process\.env\.SCOUT_SYNTHETIC_EPOCH|SYNTHETIC_DEFAULT_EPOCH\s*=/);
    }
  });
});
