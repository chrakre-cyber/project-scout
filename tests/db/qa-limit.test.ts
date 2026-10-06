/**
 * QA-001 / Gate G1 — maks 10 aktive agenter per firma: uavhengig, adversariell kontroll.
 *
 * Dekker det DEV-002/004-testene ikke dekker: batch med >10 rader i ett kall,
 * samtidighet på tvers av klienter/brukere i samme firma, firma uten innbyrdes
 * blokkering, samt transaksjonsisolasjon og informasjonslekkasje på tvers av firma.
 * Ordinære brukere via Auth + Data API; oppsett som databaseeier. Ingen service-role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, assertLocal, cleanup, createFirmWithMember, createUser, READY, signIn, type TestUser } from "./harness";

let db: Client;
const users: TestUser[] = [];
const firms: string[] = [];

const activeCount = async (firm: string) =>
  (await db.query("select count(*)::int n from public.search_agents where dealership_id = $1 and active", [firm])).rows[0].n as number;

/** Setter inn n pauset komplette agenter direkte som databaseeier (oppsett, ikke testobjekt). */
async function seedPaused(firm: string, n: number, prefix: string): Promise<string[]> {
  const { rows } = await db.query(
    `insert into public.search_agents (dealership_id, name, filters, assumptions)
     select $1, $2 || g, $3::jsonb, $4::jsonb from generate_series(1, $5::int) g returning id`,
    [firm, prefix, JSON.stringify(READY.filters), JSON.stringify(READY.assumptions), n],
  );
  return rows.map((r) => r.id as string);
}
const pauseAll = (firm: string) => db.query("update public.search_agents set active = false where dealership_id = $1 and active", [firm]);

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
});
afterAll(async () => {
  if (db) {
    await cleanup(db, firms, users);
    await db.end();
  }
});

async function newFirm(label: string, memberCount = 1) {
  const members: TestUser[] = [];
  for (let i = 0; i < memberCount; i++) members.push(await createUser(db, `${label}-u${i}`));
  const firm = await createFirmWithMember(db, `QA ${label}`, members[0]!);
  for (const extra of members.slice(1)) await db.query("select private.admin_add_member($1, $2)", [extra.email, firm]);
  users.push(...members);
  firms.push(firm);
  return { firm, members };
}

describe("batch i ett kall kan ikke gi mer enn 10 aktive", () => {
  it("INSERT av 11 aktive rader i én forespørsel", async () => {
    const { firm, members } = await newFirm("batch-insert");
    const c = await signIn(members[0]!);
    const rows = Array.from({ length: 11 }, (_, i) => ({ dealership_id: firm, name: `B${i}`, active: true, ...READY }));
    const res = await c.from("search_agents").insert(rows);
    expect(res.error?.code).toBe("23514");
    expect(res.error?.message).toContain("active_agent_limit");
    expect(await activeCount(firm)).toBe(0); // hele setningen rulles tilbake
  });

  it("INSERT av 10 + 1 i separate kall gir 10 og avvisning", async () => {
    const { firm, members } = await newFirm("seq-insert");
    const c = await signIn(members[0]!);
    const ten = await c.from("search_agents").insert(Array.from({ length: 10 }, (_, i) => ({ dealership_id: firm, name: `S${i}`, active: true, ...READY })));
    expect(ten.error).toBeNull();
    expect((await c.from("search_agents").insert({ dealership_id: firm, name: "S11", active: true, ...READY })).error?.code).toBe("23514");
    expect(await activeCount(firm)).toBe(10);
  });

  it("UPDATE av 11 pausede agenter til aktiv i én forespørsel", async () => {
    const { firm, members } = await newFirm("batch-update");
    const c = await signIn(members[0]!);
    const ids = await seedPaused(firm, 11, "BU");
    const res = await c.from("search_agents").update({ active: true }).in("id", ids).select("id");
    expect(res.error?.code).toBe("23514");
    expect(await activeCount(firm)).toBe(0);
  });

  it("UPDATE via bred filter (alle firmaets agenter) kan ikke aktivere flere enn 10", async () => {
    const { firm, members } = await newFirm("filter-update");
    const c = await signIn(members[0]!);
    await seedPaused(firm, 15, "FU");
    const res = await c.from("search_agents").update({ active: true }).eq("dealership_id", firm).select("id");
    expect(res.error).not.toBeNull();
    expect(await activeCount(firm)).toBeLessThanOrEqual(10);
  });

  it("UPSERT kan ikke brukes til å omgå grensen (insert og update-gren)", async () => {
    const { firm, members } = await newFirm("upsert");
    const c = await signIn(members[0]!);
    await c.from("search_agents").insert(Array.from({ length: 10 }, (_, i) => ({ dealership_id: firm, name: `U${i}`, active: true, ...READY })));
    const [paused] = await seedPaused(firm, 1, "UP");
    // update-gren: id kan ikke oppgis av ordinær bruker (ingen INSERT-rettighet på id)
    const viaId = await c.from("search_agents").upsert({ id: paused, dealership_id: firm, name: "UP1", active: true, ...READY }, { onConflict: "id" });
    expect(viaId.error?.code).toBe("42501");
    // Upsert uten id genererer ON CONFLICT DO UPDATE SET dealership_id = …, og ordinær bruker har ikke UPDATE-rett på dealership_id.
    const viaInsert = await c.from("search_agents").upsert({ dealership_id: firm, name: "ny", active: true, ...READY });
    expect(viaInsert.error).not.toBeNull();
    expect(["42501", "23514"]).toContain(viaInsert.error?.code);
    expect(await activeCount(firm)).toBe(10);
  });
});

describe("samtidighet", () => {
  it("24 samtidige aktiveringer fra 4 sesjoner (2 brukere i samme firma) gir nøyaktig 10, 3 runder", async () => {
    const { firm, members } = await newFirm("concurrent", 2);
    const clients: SupabaseClient[] = [
      await signIn(members[0]!), await signIn(members[0]!), await signIn(members[1]!), await signIn(members[1]!),
    ];
    const ids = await seedPaused(firm, 24, "C");
    for (let round = 0; round < 3; round++) {
      await pauseAll(firm);
      const results = await Promise.all(ids.map((id, i) => clients[i % clients.length]!.from("search_agents").update({ active: true }).eq("id", id).select("id")));
      const ok = results.filter((r) => r.error === null && r.data?.length === 1).length;
      const rejected = results.filter((r) => r.error?.code === "23514").length;
      expect(ok, `runde ${round}`).toBe(10);
      expect(rejected, `runde ${round}`).toBe(14);
      expect(await activeCount(firm), `runde ${round}`).toBe(10);
    }
  });

  it("blandet samtidig INSERT og UPDATE mot siste ledige plasser gir aldri mer enn 10", async () => {
    const { firm, members } = await newFirm("mixed", 2);
    const [a, b] = [await signIn(members[0]!), await signIn(members[1]!)];
    const ids = await seedPaused(firm, 10, "M");
    for (const id of ids.slice(0, 7)) await a.from("search_agents").update({ active: true }).eq("id", id);
    expect(await activeCount(firm)).toBe(7);
    const ops = [
      ...ids.slice(7).map((id) => b.from("search_agents").update({ active: true }).eq("id", id).select("id")),
      ...Array.from({ length: 6 }, (_, i) => a.from("search_agents").insert({ dealership_id: firm, name: `MI${i}`, active: true, ...READY })),
    ];
    await Promise.all(ops);
    expect(await activeCount(firm)).toBe(10);
  });

  it("grensen er per firma: to firma aktiverer 10 hver samtidig uten å blokkere hverandre", async () => {
    const [x, y] = [await newFirm("iso-x"), await newFirm("iso-y")];
    const [cx, cy] = [await signIn(x.members[0]!), await signIn(y.members[0]!)];
    const [ix, iy] = [await seedPaused(x.firm, 12, "X"), await seedPaused(y.firm, 12, "Y")];
    await Promise.all([
      ...ix.map((id) => cx.from("search_agents").update({ active: true }).eq("id", id)),
      ...iy.map((id) => cy.from("search_agents").update({ active: true }).eq("id", id)),
    ]);
    expect(await activeCount(x.firm)).toBe(10);
    expect(await activeCount(y.firm)).toBe(10);
  });

  it("pause og aktivering i samme øyeblikk: aldri over 10, og en pauset plass kan gjenbrukes", async () => {
    const { firm, members } = await newFirm("pause-race");
    const c = await signIn(members[0]!);
    const ids = await seedPaused(firm, 12, "PR");
    for (const id of ids.slice(0, 10)) await c.from("search_agents").update({ active: true }).eq("id", id);
    const results = await Promise.all([
      c.from("search_agents").update({ active: false }).eq("id", ids[0]!),
      c.from("search_agents").update({ active: true }).eq("id", ids[10]!),
      c.from("search_agents").update({ active: true }).eq("id", ids[11]!),
    ]);
    expect(results.length).toBe(3);
    expect(await activeCount(firm)).toBeLessThanOrEqual(10);
    expect(await activeCount(firm)).toBeGreaterThanOrEqual(9);
  });
});

describe("transaksjonsisolasjon (databasegrensen bak API-et)", () => {
  async function race(level: "read committed" | "repeatable read" | "serializable") {
    const { firm, members } = await newFirm(`iso-${level.replace(" ", "-")}`);
    const ids = await seedPaused(firm, 11, "T");
    for (const id of ids.slice(0, 9)) await db.query("update public.search_agents set active = true where id = $1", [id]);
    expect(await activeCount(firm)).toBe(9);
    const [t1, t2] = [await adminDb(), await adminDb()];
    const claims = JSON.stringify({ sub: members[0]!.id, role: "authenticated" });
    const begin = async (t: Client) => {
      await t.query(`begin isolation level ${level}`);
      await t.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [claims]);
      await t.query("select count(*) from public.search_agents"); // tar snapshot før konkurrenten committer
    };
    const outcome = { t1: "ok", t2: "ok" };
    try {
      await begin(t1);
      await begin(t2);
      await t1.query("update public.search_agents set active = true where id = $1", [ids[9]]);
      await t1.query("commit");
      try {
        await t2.query("update public.search_agents set active = true where id = $1", [ids[10]]);
        await t2.query("commit");
      } catch (e) {
        outcome.t2 = (e as { code?: string }).code ?? "feil";
        await t2.query("rollback").catch(() => {});
      }
    } finally {
      await t1.end();
      await t2.end();
    }
    return { ...outcome, active: await activeCount(firm) };
  }

  it("READ COMMITTED (standard for Data API): to transaksjoner om siste plass gir 10", async () => {
    const r = await race("read committed");
    expect(r.active).toBe(10);
    expect(r.t2).toBe("23514");
  });

  it("SERIALIZABLE: aldri mer enn 10 (serialiserings- eller grensefeil)", async () => {
    const r = await race("serializable");
    expect(r.active).toBeLessThanOrEqual(10);
  });

  // FUNN QA-001-F2 (P3/P2, ikke nåbart for ordinære brukere): under REPEATABLE READ kan grensen overskrides, fordi
  // telling bruker transaksjonens eldre snapshot. Kommentaren i DEV-002-migrasjonen påstår at dette gir serialiseringsfeil.
  // `it.fails` er grønn så lenge feilen finnes og blir rød når den rettes (da fjernes `.fails`).
  it.fails("REPEATABLE READ: aldri mer enn 10 (FUNN F2: overskrides i dag)", async () => {
    const r = await race("repeatable read");
    expect(r.active).toBeLessThanOrEqual(10);
  });
});

describe("informasjon på tvers av firma via grensetriggeren", () => {
  // FUNN QA-001-F1 (P2): BEFORE-triggeren (SECURITY DEFINER) teller og låser Bs firma FØR RLS WITH CHECK avviser raden.
  // Brukere i A som kjenner Bs UUID får `active_agent_limit` (23514) når B har 10 aktive, ellers 42501.
  // `it.fails` er grønn så lenge funnet er åpent og blir rød når det rettes (da fjernes `.fails`).
  it.fails("A får samme feil mot et fullt firma B som mot et tomt firma B (FUNN F1: sidekanal i dag)", async () => {
    const [a, b, empty] = [await newFirm("leak-a"), await newFirm("leak-b"), await newFirm("leak-empty")];
    await db.query(
      `insert into public.search_agents (dealership_id, name, filters, assumptions, active)
       select $1, 'F'||g, $2::jsonb, $3::jsonb, true from generate_series(1, 10) g`,
      [b.firm, JSON.stringify(READY.filters), JSON.stringify(READY.assumptions)],
    );
    expect(await activeCount(b.firm)).toBe(10);
    const client = await signIn(a.members[0]!);
    const probe = (firm: string) => client.from("search_agents").insert({ dealership_id: firm, name: "probe", active: true, ...READY });
    const against = await probe(b.firm); // B har 10 aktive
    const againstEmpty = await probe(empty.firm); // 0 aktive
    expect(againstEmpty.error?.code).toBe("42501");
    expect(against.error?.code).toBe(againstEmpty.error?.code);
    expect(against.error?.message).toBe(againstEmpty.error?.message);
  });
});
