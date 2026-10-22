// HOST-001 (forberedelse): SKRIVEBESKYTTET inspeksjon av en mål-database før H2. Én `begin read only`-transaksjon med bare SELECT; ruller alltid tilbake. Resultatet er bare tall, versjoner og flagg —
// aldri radinnhold, e-poster, nøkler eller adresser. Skiller TOMT prosjekt fra OPPGRADERING av eksisterende database og kjører DATA-002D-kartleggingen (de samme ugyldige radene som migrasjon
// 20261022090000 stopper på) FØR noe anvendes. Funksjonen tar en pg-lignende klient, så den kan prøves mot en isolert PostgreSQL uten hosted tilgang.
import { DATA002D_VERSION, classifyMigrations, includesDataMigration, repoHash } from "./migrations.mjs";

const TABLES = [["public", "dealerships"], ["public", "dealership_members"], ["public", "search_agents"], ["public", "search_runs"], ["public", "search_run_results"], ["public", "search_drafts"],
  ["public", "dealer_economics_inputs"], ["public", "dealer_economics_profiles"], ["private", "provider_rights_profiles"]];
export const TEST_EMAIL_SUFFIX = "@example.test";
const SAFE_ID = /^[a-z0-9._-]{1,64}$/;

const q = async (client, sql, params) => (await client.query(sql, params)).rows;

export async function inspectDatabase(client, { repoList, mode, target, now = new Date() }) {
  await client.query("begin read only");
  try {
    const stopReasons = [];
    // --- migrasjoner
    const hasMig = (await q(client, "select to_regclass('supabase_migrations.schema_migrations') is not null t"))[0].t;
    const applied = hasMig ? (await q(client, "select version from supabase_migrations.schema_migrations order by version")).map((r) => String(r.version)) : [];
    const cls = classifyMigrations(applied, repoList);
    // --- skjema og tabeller
    const sch = (await q(client, "select count(*) filter (where schemaname='public')::int pub, count(*) filter (where schemaname='private')::int priv from pg_tables where schemaname in ('public','private')"))[0];
    const counts = {};
    for (const [s, t] of TABLES) {
      const exists = (await q(client, "select to_regclass($1) is not null t", [`${s}.${t}`]))[0].t;
      counts[`${s}.${t}`] = exists ? (await q(client, `select count(*)::int n from ${s}.${t}`))[0].n : null;
    }
    // --- brukere (bare tall; testbrukere = e-post som slutter på @example.test)
    const hasUsers = (await q(client, "select to_regclass('auth.users') is not null t"))[0].t;
    const users = hasUsers ? (await q(client, "select count(*)::int n, count(*) filter (where email is null or email not like $1)::int non_test from auth.users", [`%${TEST_EMAIL_SUFFIX}`]))[0] : { n: null, non_test: null };
    // --- DATA-002D-kartlegging (samme betingelse som migrasjonens DO-blokk)
    let data002d;
    const tbl = counts["private.provider_rights_profiles"] !== null;
    if (!tbl) data002d = { status: "NOT_APPLICABLE", invalidProfiles: 0, note: "tabellen finnes ikke (tomt prosjekt eller før DATA-002B)" };
    else if (!(await q(client, "select to_regprocedure('private.rights_field_map_valid(jsonb)') is not null f"))[0].f) data002d = { status: "UNKNOWN", invalidProfiles: null, note: "tabellen finnes, men valideringsfunksjonen mangler" };
    else {
      const bad = await q(client, "select provider, version from private.provider_rights_profiles where private.rights_field_map_valid(display_fields) is not true or private.rights_field_map_valid(matching_fields) is not true order by provider, version");
      const ids = bad.map((r) => `${r.provider}@v${r.version}`).filter((x) => SAFE_ID.test(x.split("@")[0]));
      if (bad.length) data002d = { status: "INVALID", invalidProfiles: bad.length, profiles: ids.slice(0, 20), note: "ugyldige/tomme feltkart må avklares av eier før migrasjon 20261022090000" };
      else data002d = { status: includesDataMigration(cls) ? "ALREADY_APPLIED" : "OK", invalidProfiles: 0, note: includesDataMigration(cls) ? "migrasjonen er allerede anvendt og ingen ugyldige rader" : "ingen ugyldige rader" };
    }
    // --- tomt prosjekt eller oppgradering?
    const anyTables = sch.pub + sch.priv > 0 || Object.values(counts).some((n) => n !== null);
    const anyData = Object.values(counts).some((n) => (n ?? 0) > 0) || (users.n ?? 0) > 0;
    let state;
    if (cls.kind === "diverged") state = "ukjent";
    else if (cls.kind === "empty") state = anyTables || anyData ? "ukjent" : "tomt";
    else state = "oppgradering";
    // --- stoppårsaker
    if (cls.kind === "diverged") stopReasons.push(`migrasjonshistorikken avviker fra repoet: ${cls.reason}`);
    if (state === "ukjent" && cls.kind === "empty") stopReasons.push("ingen migrasjoner registrert, men databasen er ikke tom (tabeller eller data finnes): ukjent utgangspunkt");
    if ((users.non_test ?? 0) > 0) stopReasons.push(`${users.non_test} bruker(e) som ikke er testbrukere (${TEST_EMAIL_SUFFIX}) finnes: ikke et rent testprosjekt`);
    const want = mode === "fresh" ? "tomt" : "oppgradering";
    if (state !== "ukjent" && state !== want) stopReasons.push(`valgt modus «${mode}» passer ikke til databasen (${state})`);
    if (data002d.status === "INVALID" || data002d.status === "UNKNOWN") stopReasons.push(`DATA-002D-kartleggingen: ${data002d.status} — ${data002d.note}`);
    return {
      schemaVersion: 1, kind: "hosted-inspect", takenAt: now.toISOString(), mode, target: { fingerprint: target.fingerprint },
      repoHash: repoHash(repoList), repoMigrations: repoList.length,
      migrations: { historyTable: hasMig, appliedCount: cls.appliedCount, classification: cls.kind, pending: cls.pending, unknownApplied: cls.unknownApplied },
      schema: { publicTables: sch.pub, privateTables: sch.priv }, counts, auth: { users: users.n, nonTestUsers: users.non_test },
      data002d, state, nothingToApply: cls.pending.length === 0, verdict: stopReasons.length ? "STOPP" : "OK", stopReasons,
    };
  } finally {
    await client.query("rollback").catch(() => {});
  }
}
export { DATA002D_VERSION };
