// HOST-001 (forberedelse): opprydding av TESTDATA i testprosjektet (H4). Tørrkjøring er standard og skrivebeskyttet. Sletting skjer bare i `executeCleanup`, bare for rader som kan identifiseres som
// testdata (brukere med e-post på @example.test og firma der ALLE medlemmer er slike brukere), i én transaksjon som rulles tilbake hvis noe er igjen etterpå. Skjema/migrasjoner røres aldri; selve
// testprosjektet slettes av eier (kan ikke gjøres herfra). IDer holdes i minnet og skrives aldri ut — bare tall.
import { TEST_EMAIL_SUFFIX } from "./inspect.mjs";

const FIRM_TABLES = ["dealer_economics_inputs", "dealer_economics_profiles", "search_drafts", "search_run_results", "search_runs", "search_agents", "dealership_members"];
const q = async (c, sql, p) => (await c.query(sql, p)).rows;

async function select(client) {
  const firms = await q(client, `select d.id, count(m.user_id)::int members, count(m.user_id) filter (where u.email like $1)::int test_members
      from public.dealerships d left join public.dealership_members m on m.dealership_id = d.id left join auth.users u on u.id = m.user_id group by d.id`, [`%${TEST_EMAIL_SUFFIX}`]);
  const testFirms = firms.filter((f) => f.members > 0 && f.members === f.test_members).map((f) => f.id);
  const blocked = firms.filter((f) => f.test_members > 0 && f.members !== f.test_members).map((f) => f.id);   // firma som blander testbrukere og andre: røres ikke
  const orphanFirms = firms.filter((f) => f.members === 0).length;
  // testbrukere som er medlem av et blandet firma slettes heller ikke
  const users = await q(client, "select u.id from auth.users u where u.email like $1 and not exists (select 1 from public.dealership_members m where m.user_id = u.id and m.dealership_id = any($2::uuid[]))", [`%${TEST_EMAIL_SUFFIX}`, blocked]);
  const rows = {};
  for (const t of FIRM_TABLES) rows[t] = (await q(client, `select count(*)::int n from public.${t} where dealership_id = any($1::uuid[])`, [testFirms]))[0].n;
  return { testUserIds: users.map((u) => u.id), testFirmIds: testFirms, blockedFirms: blocked.length, orphanFirms, rows };
}
const summary = (s) => ({ testUsers: s.testUserIds.length, testFirms: s.testFirmIds.length, blockedFirms: s.blockedFirms, orphanFirms: s.orphanFirms, rows: s.rows });

/** Skrivebeskyttet tørrkjøring: bare tall for hva som VILLE slettes. */
export async function planCleanup(client) {
  await client.query("begin read only");
  try { return { plan: summary(await select(client)) }; } finally { await client.query("rollback").catch(() => {}); }
}

/** Sletter testdata i én transaksjon; ruller tilbake hvis testdata gjenstår. Returnerer tall før og etter. */
export async function executeCleanup(client) {
  await client.query("begin");
  try {
    const before = await select(client);
    for (const t of FIRM_TABLES) await client.query(`delete from public.${t} where dealership_id = any($1::uuid[])`, [before.testFirmIds]);
    await client.query("delete from public.dealerships where id = any($1::uuid[])", [before.testFirmIds]);
    await client.query("delete from auth.users where id = any($1::uuid[])", [before.testUserIds]);
    const after = await select(client);
    if (after.testUserIds.length || after.testFirmIds.length || Object.values(after.rows).some((n) => n > 0)) { await client.query("rollback"); return { ok: false, before: summary(before), after: summary(after), note: "testdata gjenstod; alt rullet tilbake" }; }
    await client.query("commit");
    return { ok: true, before: summary(before), after: summary(after) };
  } catch (e) {
    await client.query("rollback").catch(() => {});
    return { ok: false, error: `${e?.code ?? "feil"}`, note: "opprydding avbrutt; alt rullet tilbake" };
  }
}
