/**
 * DEV-002: firmaisolasjon (RLS), rettigheter, constraints, R5-pengeformat og
 * atomisk maks 10 aktive agenter — mot lokal Supabase med ordinære brukere.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentFromRow, type AgentRow } from "@/server/agent-records";
import {
  adminDb, anonClient, asUser, assertLocal, cleanup, createFirmWithMember, createUser, READY, signIn, type TestUser,
} from "./harness";

let db: Client;
let userA: TestUser, userB: TestUser, userC: TestUser, loner: TestUser;
let firmA: string, firmB: string, firmC: string;
let a: SupabaseClient, b: SupabaseClient;
let agentB: string;

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  [userA, userB, userC, loner] = [await createUser(db, "a"), await createUser(db, "b"), await createUser(db, "c"), await createUser(db, "loner")];
  firmA = await createFirmWithMember(db, "Testfirma A", userA);
  firmB = await createFirmWithMember(db, "Testfirma B", userB);
  firmC = await createFirmWithMember(db, "Testfirma C", userC);
  [a, b] = [await signIn(userA), await signIn(userB)];
  const { data, error } = await b.from("search_agents").insert({ dealership_id: firmB, name: "B sin agent", ...READY }).select("id").single();
  if (error) throw error;
  agentB = data.id;
});

afterAll(async () => {
  if (db) {
    await cleanup(db, [firmA, firmB, firmC].filter(Boolean), [userA, userB, userC, loner].filter(Boolean));
    await db.end();
  }
});

describe("lesing er isolert per firma", () => {
  it("A ser bare eget firma og eget medlemskap; B tilsvarende", async () => {
    for (const [client, own, other] of [[a, firmA, firmB], [b, firmB, firmA]] as const) {
      const firms = await client.from("dealerships").select("id");
      expect(firms.error).toBeNull();
      expect(firms.data!.map((f) => f.id)).toEqual([own]);
      const members = await client.from("dealership_members").select("dealership_id");
      expect(members.data!.map((m) => m.dealership_id)).toEqual([own]);
      const direct = await client.from("dealerships").select("id").eq("id", other);
      expect(direct.data).toEqual([]);
    }
  });

  it("A kan ikke lese Bs agent, heller ikke med eksplisitt ID", async () => {
    const res = await a.from("search_agents").select("id").eq("id", agentB);
    expect(res.error).toBeNull();
    expect(res.data).toEqual([]);
    expect((await b.from("search_agents").select("id").eq("id", agentB)).data).toHaveLength(1);
  });

  it("bruker uten medlemskap ser ingen firma eller agenter", async () => {
    const c = await signIn(loner);
    expect((await c.from("dealerships").select("id")).data).toEqual([]);
    expect((await c.from("search_agents").select("id")).data).toEqual([]);
    const insert = await c.from("search_agents").insert({ dealership_id: firmA, name: "x" });
    expect(insert.error?.code).toBe("42501");
  });

  it("åpen registrering er stengt; brukere opprettes bare av prosjekteier", async () => {
    const res = await anonClient().auth.signUp({ email: `selvregistrert-${Date.now()}@example.test`, password: "et-langt-testpassord-123" });
    expect(res.error).not.toBeNull();
    expect(res.data.user).toBeNull();
  });

  it("anonym klient har ingen tilgang", async () => {
    for (const table of ["dealerships", "dealership_members", "search_agents"]) {
      const res = await anonClient().from(table).select("*");
      expect(res.error?.code, table).toBe("42501");
    }
  });
});

describe("opprett og hent agent som ordinær bruker", () => {
  it("A oppretter agent i eget firma og finner den igjen i ny sesjon", async () => {
    const created = await a.from("search_agents")
      .insert({ dealership_id: firmA, name: "Golf-agent", filters: { make: "Volkswagen", model: "Golf" } })
      .select("id, version, active").single();
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({ version: 1, active: false });

    const fresh = await signIn(userA);
    const again = await fresh.from("search_agents").select("id, name, dealership_id").eq("id", created.data!.id).single();
    expect(again.data).toEqual({ id: created.data!.id, name: "Golf-agent", dealership_id: firmA });
  });
});

describe("manipulasjon av firma-ID og beskyttede felt", () => {
  it("A kan ikke opprette agent for B ved å sende Bs firma-ID; B heller ikke for A", async () => {
    const ab = await a.from("search_agents").insert({ dealership_id: firmB, name: "innbrudd" });
    expect(ab.error?.code).toBe("42501");
    const ba = await b.from("search_agents").insert({ dealership_id: firmA, name: "innbrudd" });
    expect(ba.error?.code).toBe("42501");
    const { rows } = await db.query("select count(*)::int as n from public.search_agents where name = 'innbrudd'");
    expect(rows[0].n).toBe(0);
  });

  it("A kan ikke endre Bs agent; raden er uendret", async () => {
    const res = await a.from("search_agents").update({ name: "kapret" }).eq("id", agentB).select("id");
    expect(res.data).toEqual([]);
    const { rows } = await db.query("select name, version from public.search_agents where id = $1", [agentB]);
    expect(rows[0]).toEqual({ name: "B sin agent", version: 1 });
  });

  it("firma-ID, versjon og siste søk kan ikke settes av bruker", async () => {
    const own = await a.from("search_agents").insert({ dealership_id: firmA, name: "Egen" }).select("id").single();
    const id = own.data!.id;
    expect((await a.from("search_agents").update({ dealership_id: firmB }).eq("id", id)).error?.code).toBe("42501");
    expect((await a.from("search_agents").update({ version: 99 }).eq("id", id)).error?.code).toBe("42501");
    expect((await a.from("search_agents").update({ last_success_at: new Date().toISOString() }).eq("id", id)).error?.code).toBe("42501");
    expect((await a.from("search_agents").insert({ dealership_id: firmA, name: "v", version: 7 })).error?.code).toBe("42501");
    expect((await a.from("search_agents").delete().eq("id", id)).error?.code).toBe("42501");
  });

  it("medlemskap og firma kan ikke opprettes, endres eller slettes fra klienten", async () => {
    expect((await a.from("dealership_members").insert({ user_id: userA.id, dealership_id: firmB })).error?.code).toBe("42501");
    expect((await a.from("dealership_members").update({ dealership_id: firmB }).eq("user_id", userA.id)).error?.code).toBe("42501");
    expect((await a.from("dealership_members").delete().eq("user_id", userA.id)).error?.code).toBe("42501");
    expect((await a.from("dealerships").insert({ name: "Nytt firma" })).error?.code).toBe("42501");
    const { rows } = await db.query("select dealership_id from public.dealership_members where user_id = $1", [userA.id]);
    expect(rows).toEqual([{ dealership_id: firmA }]);
  });

  it("administrasjonsfunksjonene kan ikke kjøres som ordinær bruker", async () => {
    await asUser(db, userA);
    await expect(db.query("select private.admin_add_member($1, $2)", [userA.email, firmB])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback");
    await asUser(db, userA);
    await expect(db.query("select private.admin_create_dealership('x')")).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback");
  });
});

describe("constraints og triggere", () => {
  it("versjon øker ved endring, ikke ved uendret oppdatering", async () => {
    const own = await a.from("search_agents").insert({ dealership_id: firmA, name: "Versjon" }).select("id").single();
    const id = own.data!.id;
    await a.from("search_agents").update({ name: "Versjon 2" }).eq("id", id);
    await a.from("search_agents").update({ name: "Versjon 2" }).eq("id", id);
    expect((await a.from("search_agents").select("version").eq("id", id).single()).data!.version).toBe(2);
  });

  it("firmabytte avvises også for databaseeier (trigger)", async () => {
    await expect(db.query("update public.search_agents set dealership_id = $1 where id = $2", [firmA, agentB]))
      .rejects.toMatchObject({ code: "23514" });
  });

  it("navn, JSON-typer og én membership per bruker håndheves", async () => {
    expect((await a.from("search_agents").insert({ dealership_id: firmA, name: "   " })).error?.code).toBe("23514");
    expect((await a.from("search_agents").insert({ dealership_id: firmA, name: "x", filters: [] })).error?.code).toBe("23514");
    expect((await a.from("search_agents").insert({ name: "uten firma" })).error?.code).toBe("42501");
    await expect(db.query("select private.admin_add_member($1, $2)", [userA.email, firmB])).rejects.toMatchObject({ code: "23505" });
  });
});

describe("R5: penger ved databasegrensen", () => {
  const money = (amountMinor: unknown) => ({ dealership_id: firmA, name: "Pris", filters: { maxPrice: { amountMinor, currency: "EUR" } } });

  it("avviser JSON-tall og beløp over 2^53-1, godtar største trygge beløp", async () => {
    expect((await a.from("search_agents").insert(money(4_000_000))).error?.code).toBe("23514");
    expect((await a.from("search_agents").insert(money("9007199254740992"))).error?.code).toBe("23514");
    expect((await a.from("search_agents").insert(money("12.50"))).error?.code).toBe("23514");
    expect((await a.from("search_agents").insert({ ...money("100"), filters: { maxPrice: { amountMinor: "100", currency: "EUR", extra: 1 } } })).error?.code).toBe("23514");
    const ok = await a.from("search_agents").insert(money("9007199254740991"))
      .select("id, name, filters, assumptions, active, version, last_success_at").single();
    expect(ok.error).toBeNull();
    expect(agentFromRow(ok.data as AgentRow).filters.maxPrice).toEqual({ amountMinor: 9007199254740991, currency: "EUR" });
  });
});

describe("maks 10 aktive agenter per firma (atomisk)", () => {
  it("11. aktivering avvises ved insert og update; pause frigjør plass", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ dealership_id: firmB, name: `Aktiv ${i}`, active: true, ...READY }));
    expect((await b.from("search_agents").insert(rows)).error).toBeNull();
    const eleventh = await b.from("search_agents").insert({ dealership_id: firmB, name: "Aktiv 11", active: true, ...READY });
    expect(eleventh.error?.code).toBe("23514");
    expect(eleventh.error?.message).toContain("active_agent_limit");
    const activate = await b.from("search_agents").update({ active: true }).eq("id", agentB);
    expect(activate.error?.code).toBe("23514");
    const one = (await b.from("search_agents").select("id").eq("active", true).limit(1).single()).data!.id;
    expect((await b.from("search_agents").update({ active: false }).eq("id", one)).error).toBeNull();
    expect((await b.from("search_agents").update({ active: true }).eq("id", agentB)).error).toBeNull();
    // Andre firma påvirkes ikke av Bs grense.
    expect((await a.from("search_agents").insert({ dealership_id: firmA, name: "A aktiv", active: true, ...READY })).error).toBeNull();
  });

  it("20 samtidige aktiveringer via API gir nøyaktig 10 aktive", async () => {
    const c = await signIn(userC);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      c.from("search_agents").insert({ dealership_id: firmC, name: `Samtidig ${i}`, active: true, ...READY })));
    expect(results.filter((r) => r.error === null)).toHaveLength(10);
    expect(results.filter((r) => r.error?.code === "23514")).toHaveLength(10);
    const { rows } = await db.query("select count(*)::int as n from public.search_agents where dealership_id = $1 and active", [firmC]);
    expect(rows[0].n).toBe(10);
  });

  it("to transaksjoner om siste plass: den andre venter på låsen og avvises etter commit", async () => {
    // Frigjør nøyaktig én plass (9 aktive), så to transaksjoner konkurrerer om den siste.
    await db.query("update public.search_agents set active = false where id = (select id from public.search_agents where dealership_id = $1 and active limit 1)", [firmC]);
    const { rows: before } = await db.query("select count(*)::int as n from public.search_agents where dealership_id = $1 and active", [firmC]);
    expect(before[0].n).toBe(9);

    const t1 = await adminDb();
    const t2 = await adminDb();
    try {
      await asUser(t1, userC);
      await asUser(t2, userC);
      await t1.query("insert into public.search_agents (dealership_id, name, active, filters, assumptions) values ($1, 'T1', true, $2, $3)", [firmC, READY.filters, READY.assumptions]);
      let settled = false;
      const second = t2.query("insert into public.search_agents (dealership_id, name, active, filters, assumptions) values ($1, 'T2', true, $2, $3)", [firmC, READY.filters, READY.assumptions])
        .finally(() => { settled = true; });
      second.catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
      expect(settled).toBe(false); // T2 venter på firmalåsen
      await t1.query("commit");
      await expect(second).rejects.toMatchObject({ code: "23514" });
      await t2.query("rollback");
    } finally {
      await t1.end();
      await t2.end();
    }
    const { rows: after } = await db.query("select count(*)::int as n from public.search_agents where dealership_id = $1 and active", [firmC]);
    expect(after[0].n).toBe(10);
  });
});
