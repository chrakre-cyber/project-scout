/** Pipeline mot falske providere: sider, avkorting, tidsavbrudd, retry, validering og feilkoder. */
import { describe, expect, it } from "vitest";
import { MarketplaceError } from "@/providers/marketplace/errors";
import { EMPTY_QUERY, SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import type { MarketplaceProvider, SearchPage } from "@/providers/marketplace/types";
import { runSearchPipeline } from "@/server/search-pipeline";
import { fetchAll } from "./helpers";

const noSleep = async () => {};
const opts = { sleep: noSleep, random: () => 0 };

function fake(search: MarketplaceProvider["search"], source = "synthetic-demo"): MarketplaceProvider {
  return { source, search, getListing: async () => null };
}

describe("runSearchPipeline", () => {
  it("henter alle sider fra den syntetiske kilden og teller konsistent", async () => {
    const all = await fetchAll();
    const out = await runSearchPipeline(new SyntheticMarketplaceProvider(), EMPTY_QUERY, { ...opts, pageSize: 10 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.counts.matches + out.counts.needsReview).toBe(out.rows.length);
    expect(out.counts.fetched).toBe(all.length);
    expect(out.counts.pages).toBe(Math.ceil(all.length / 10));
    expect(out.rows.map((r) => r.rank)).toEqual(out.rows.map((_, i) => i + 1));
    expect(out.rows.every((r) => /^[0-9a-f]{64}$/.test(r.contentHash))).toBe(true);
  });

  it("er deterministisk: samme input gir identiske rader og hasher", async () => {
    const f = { ...EMPTY_QUERY, make: "Volkswagen" };
    const a = await runSearchPipeline(new SyntheticMarketplaceProvider(), f, opts);
    const b = await runSearchPipeline(new SyntheticMarketplaceProvider(), f, { ...opts, pageSize: 7 });
    expect(a.ok && b.ok && a.rows).toEqual(b.ok && b.rows);
  });

  it("tomt resultat er ok med null rader", async () => {
    const out = await runSearchPipeline(new SyntheticMarketplaceProvider(), { ...EMPTY_QUERY, make: "FinnesIkke" }, opts);
    expect(out).toMatchObject({ ok: true, rows: [], counts: { matches: 0, needsReview: 0 } });
  });

  it("transiente feil prøves på nytt og lykkes; antall forsøk er begrenset", async () => {
    const p = new SyntheticMarketplaceProvider({ failures: { search: ["unavailable", "rate_limit", null] } });
    expect((await runSearchPipeline(p, EMPTY_QUERY, opts)).ok).toBe(true);
    const sleeps: number[] = [];
    const bad = new SyntheticMarketplaceProvider({ failAll: "unavailable" });
    const out = await runSearchPipeline(bad, EMPTY_QUERY, { ...opts, sleep: async (ms) => void sleeps.push(ms) });
    expect(out).toEqual({ ok: false, errorCode: "unavailable" });
    expect(sleeps).toEqual([200, 400]); // 3 forsøk → 2 pauser, eksponentiell
  });

  it("ikke-transiente feil prøves ikke på nytt og får riktig kode", async () => {
    for (const code of ["authentication", "forbidden", "invalid_query", "malformed_data"] as const) {
      let calls = 0;
      const p = fake(async () => { calls++; throw new MarketplaceError(code, "hemmelig-token-123"); });
      const out = await runSearchPipeline(p, EMPTY_QUERY, opts);
      expect(out).toEqual({ ok: false, errorCode: code });
      expect(calls).toBe(1);
    }
  });

  it("tidsavbrudd gir timeout (og forsøkes på nytt)", async () => {
    let calls = 0;
    const p = fake(() => { calls++; return new Promise<SearchPage>(() => {}); });
    const out = await runSearchPipeline(p, EMPTY_QUERY, { ...opts, timeoutMs: 20 });
    expect(out).toEqual({ ok: false, errorCode: "timeout" });
    expect(calls).toBe(3);
  });

  it("ukjent unntak blir internal uten å lekke teksten", async () => {
    const out = await runSearchPipeline(fake(async () => { throw new Error("tilkobling feilet med hemmelig-verdi-passord"); }), EMPTY_QUERY, opts);
    expect(out).toEqual({ ok: false, errorCode: "internal" });
    expect(JSON.stringify(out)).not.toContain("passord");
  });

  it("ugyldig providersvar gir malformed_data", async () => {
    const good = await new SyntheticMarketplaceProvider().search(EMPTY_QUERY, { page: 1, pageSize: 5 });
    const cases: unknown[] = [
      null,
      { ...good, items: "ikke liste" },
      { ...good, sourceTotal: -1 },
      { ...good, truncated: "nei" },
      { ...good, nextPage: 1 }, // går ikke fremover
      { ...good, items: [{ ...good.items[0]!, source: "annen-kilde" }] },
      { ...good, items: [{ ...good.items[0]!, sourceListingId: "" }] },
      { ...good, items: [{ ...good.items[0]!, specs: null }] },
    ];
    for (const c of cases) {
      const out = await runSearchPipeline(fake(async () => c as SearchPage), EMPTY_QUERY, opts);
      expect(out, JSON.stringify(c)?.slice(0, 60)).toEqual({ ok: false, errorCode: "malformed_data" });
    }
  });

  it("provider som aldri avslutter stoppes av sidegrensen og markeres avkortet", async () => {
    const good = await new SyntheticMarketplaceProvider().search(EMPTY_QUERY, { page: 1, pageSize: 2 });
    let n = 0;
    const p = fake(async (_q, w) => ({ ...good, items: [{ ...good.items[0]!, sourceListingId: `id-${n++}` }], nextPage: (w.page ?? 1) + 1 }));
    const out = await runSearchPipeline(p, EMPTY_QUERY, { ...opts, maxPages: 5 });
    expect(out.ok && out.counts.pages).toBe(5);
    expect(out.ok && out.counts.truncated).toBe(true);
  });

  it("duplikater på tvers av sider og avviste poster telles, ikke lagres dobbelt", async () => {
    const good = await new SyntheticMarketplaceProvider().search(EMPTY_QUERY, { page: 1, pageSize: 3 });
    const p = fake(async (_q, w) => ({
      ...good, items: good.items, rejected: [{ sourceListingId: null, code: "malformed_data", reason: "x" }],
      nextPage: (w.page ?? 1) < 2 ? 2 : null,
    }));
    const out = await runSearchPipeline(p, EMPTY_QUERY, opts);
    expect(out.ok && out.counts.duplicates).toBe(3);
    expect(out.ok && out.counts.rejected).toBe(2);
    expect(out.ok && new Set(out.rows.map((r) => r.sourceListingId)).size).toBe(out.ok ? out.rows.length : -1);
  });
});
