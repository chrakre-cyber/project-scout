/**
 * QA-001 / Gate G1 — revisjon av databasekatalogen etter hele migrasjonskjeden.
 *
 * Sjekker det som faktisk ligger i databasen (ikke hva rapportene sier): RLS, rettigheter,
 * funksjoner, constraints og triggere. Fungerer også som vakt mot at senere tabeller
 * (DEV-005+) glemmer RLS eller gir anon/authenticated for brede rettigheter.
 */
import { readFileSync } from "node:fs";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, assertLocal } from "./harness";

let db: Client;
beforeAll(async () => {
  assertLocal();
  db = await adminDb();
});
afterAll(async () => {
  await db?.end();
});
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

/** Forventede rettigheter for ordinær bruker (rolle authenticated). Alt annet skal være nei. */
const EXPECTED_TABLE_PRIVS: Record<string, string[]> = {
  dealerships: ["SELECT"],
  dealership_members: ["SELECT"],
  search_agents: ["SELECT"],
  search_runs: ["SELECT"],
  search_run_results: ["SELECT"],
};
const EXPECTED_COLUMN_PRIVS: Record<string, { insert: string[]; update: string[] }> = {
  search_agents: {
    insert: ["active", "assumptions", "dealership_id", "filters", "name"],
    update: ["active", "assumptions", "filters", "name"],
  },
  // DEV-005: klienten oppgir bare hva som ikke kan utledes. Firma, agentversjon, kriterier, rettighetsprofil og tidspunkt
  // settes av databasen. DEV-005B0: brukere kan IKKE avslutte kjøringer (update: []) og har ingen skriverett på resultater
  // (ingen oppføring) — det gjøres av den betrodde skriveveien (scout_ingest).
  search_runs: {
    insert: ["agent_id", "provider", "request_token", "requested_agent_version"],
    update: [],
  },
};

describe("tabeller i public", () => {
  it("alle tabeller har RLS aktivert (vakt for fremtidige migrasjoner)", async () => {
    const rows = await q<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')");
    expect(rows.map((r) => r.relname).sort()).toEqual(["dealership_members", "dealerships", "search_agents", "search_run_results", "search_runs"]);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it("ingen views, materialiserte views, sekvenser eller funksjoner i public (views omgår RLS som standard)", async () => {
    expect(await q("select relname from pg_class where relnamespace = 'public'::regnamespace and relkind in ('v','m','S','f')")).toEqual([]);
    expect(await q("select proname from pg_proc where pronamespace = 'public'::regnamespace")).toEqual([]);
  });

  it("anon og PUBLIC har ingen rettigheter på tabeller, kolonner eller sekvenser i public", async () => {
    for (const role of ["anon", "public"]) {
      expect(await q(
        `select table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee = $1`,
        [role === "public" ? "PUBLIC" : role]), role).toEqual([]);
    }
    for (const t of Object.keys(EXPECTED_TABLE_PRIVS)) {
      for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        expect((await q<{ ok: boolean }>("select has_table_privilege('anon', $1, $2) as ok", [`public.${t}`, priv]))[0]!.ok, `anon ${priv} ${t}`).toBe(false);
      }
    }
  });

  it("authenticated har nøyaktig forventede tabell- og kolonnerettigheter", async () => {
    const rows = await q<{ table_name: string; privs: string[] }>(
      `select table_name, array_agg(privilege_type::text order by privilege_type)::text[] privs from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated' group by 1`);
    const actual = Object.fromEntries(rows.map((r) => [r.table_name, r.privs]));
    expect(actual).toEqual(EXPECTED_TABLE_PRIVS);

    const cols = await q<{ table_name: string; privilege_type: string; cols: string[] }>(
      `select table_name, privilege_type, array_agg(column_name::text order by column_name)::text[] cols from information_schema.column_privileges
       where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('INSERT','UPDATE') group by 1,2`);
    const colActual: Record<string, { insert: string[]; update: string[] }> = {};
    for (const c of cols) (colActual[c.table_name] ??= { insert: [], update: [] })[c.privilege_type === "INSERT" ? "insert" : "update"] = c.cols;
    expect(colActual).toEqual(EXPECTED_COLUMN_PRIVS);
    // Kolonner som aldri skal kunne skrives av bruker
    for (const c of ["id", "version", "last_success_at", "created_at", "updated_at"]) {
      expect((await q<{ ok: boolean }>("select has_column_privilege('authenticated', 'public.search_agents', $1, 'UPDATE') ok", [c]))[0]!.ok, c).toBe(false);
      expect((await q<{ ok: boolean }>("select has_column_privilege('authenticated', 'public.search_agents', $1, 'INSERT') ok", [c]))[0]!.ok, c).toBe(false);
    }
  });
});

describe("policies", () => {
  it("bare authenticated-policyer, ingen åpne (true), ingen bruk av JWT-metadata", async () => {
    const pol = await q<{ tablename: string; policyname: string; roles: string[]; cmd: string; qual: string | null; with_check: string | null }>(
      "select tablename::text, policyname::text, roles::text[], cmd::text, qual, with_check from pg_policies where schemaname = 'public'");
    expect(pol.length).toBe(8);
    for (const p of pol) {
      expect(p.roles, p.policyname).toEqual(["authenticated"]);
      const text = `${p.qual ?? ""} ${p.with_check ?? ""}`;
      expect(text, p.policyname).toMatch(/my_dealership_ids|auth\.uid\(\)/);
      expect(text, p.policyname).not.toMatch(/jwt|metadata|\btrue\b/i);
    }
    expect(pol.map((p) => `${p.tablename}:${p.cmd}`).sort()).toEqual([
      "dealership_members:SELECT", "dealerships:SELECT", "search_agents:INSERT", "search_agents:SELECT", "search_agents:UPDATE",
      "search_run_results:SELECT", "search_runs:INSERT", "search_runs:SELECT",
    ]);
  });

  it("ingen funksjon eller policy utleder firma fra JWT-claims eller metadata", async () => {
    const hits = await q("select proname from pg_proc where pronamespace in ('private'::regnamespace) and (prosrc ~* 'jwt|user_metadata|raw_user_meta|app_metadata')");
    expect(hits).toEqual([]);
  });
});

describe("funksjoner i private", () => {
  it("alle har fast search_path og eies av postgres; ingen kan kjøres av anon eller PUBLIC", async () => {
    const fns = await q<{ proname: string; owner: string; cfg: string[] | null; sec: boolean; sig: string }>(
      `select proname::text, pg_get_userbyid(proowner)::text owner, proconfig::text[] cfg, prosecdef sec, oid::regprocedure::text sig from pg_proc where pronamespace = 'private'::regnamespace`);
    expect(fns.length).toBeGreaterThanOrEqual(17);
    for (const f of fns) {
      expect(f.owner, f.proname).toBe("postgres");
      expect(f.cfg ?? [], f.proname).toContain('search_path=""');
      for (const role of ["anon", "public"]) {
        expect((await q<{ ok: boolean }>("select has_function_privilege($1, $2, 'EXECUTE') ok", [role, f.sig]))[0]!.ok, `${role} ${f.sig}`).toBe(false);
      }
    }
  });

  it("SECURITY DEFINER er begrenset til kjente funksjoner", async () => {
    const rows = await q<{ proname: string }>("select proname::text from pg_proc where prosecdef and pronamespace in ('private'::regnamespace, 'public'::regnamespace) order by 1");
    expect(rows.map((r) => r.proname)).toEqual([
      "enforce_active_agent_limit", "my_dealership_ids", "purge_expired_search_runs", "rights_profile_in_force", "rights_profiles_guard",
      "search_run_results_before_insert", "search_runs_before_insert", "search_runs_before_update",
      "trusted_complete_run", "trusted_fail_run", "trusted_run_policy", "trusted_store_results",
    ]);
  });

  it("administrasjonsfunksjoner og triggerfunksjoner kan ikke kjøres av ordinære roller eller service_role", async () => {
    for (const fn of ["private.admin_create_dealership(text)", "private.admin_add_member(text, uuid)",
      "private.enforce_active_agent_limit()", "private.search_agents_before_write()",
      "private.search_runs_before_insert()", "private.search_runs_before_update()", "private.search_run_results_before_insert()",
      "private.rights_profiles_guard()", "private.rights_profile_in_force(text, timestamptz)"]) {
      for (const role of ["anon", "authenticated", "service_role", "public"]) {
        expect((await q<{ ok: boolean }>("select has_function_privilege($1, $2, 'EXECUTE') ok", [role, fn]))[0]!.ok, `${role} ${fn}`).toBe(false);
      }
    }
  });

  it("authenticated kan bare kjøre de rene hjelpefunksjonene CHECK/RLS trenger", async () => {
    const rows = await q<{ proname: string }>(
      `select proname::text from pg_proc where pronamespace = 'private'::regnamespace and has_function_privilege('authenticated', oid, 'EXECUTE') order by 1`);
    expect(rows.map((r) => r.proname)).toEqual([
      "agent_assumptions_valid", "agent_filters_valid", "agent_ready", "is_money_json", "is_money_json_allow_zero", "jnull",
      "keys_subset", "my_dealership_ids", "nok_money_or_null", "opt_enum", "opt_enum_array", "opt_int", "opt_text",
      "search_run_counts_valid",
    ]);
  });
});

describe("constraints og triggere", () => {
  it("forventede constraints finnes på search_agents", async () => {
    const rows = await q<{ conname: string }>("select conname::text from pg_constraint where conrelid = 'public.search_agents'::regclass");
    const names = rows.map((r) => r.conname);
    for (const c of ["search_agents_pkey", "search_agents_dealership_id_fkey", "search_agents_id_dealership_key", "search_agents_name_check",
      "search_agents_version_check", "search_agents_filters_valid", "search_agents_assumptions_valid", "search_agents_ready_when_active"]) {
      expect(names, c).toContain(c);
    }
    // membership: én per bruker, FK til Auth og firma
    const m = (await q<{ conname: string }>("select conname::text from pg_constraint where conrelid = 'public.dealership_members'::regclass")).map((r) => r.conname);
    expect(m).toEqual(expect.arrayContaining(["dealership_members_pkey", "dealership_members_user_id_fkey", "dealership_members_dealership_id_fkey"]));
    const pk = await q<{ attname: string }>(
      `select a.attname::text from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
       where i.indrelid = 'public.dealership_members'::regclass and i.indisprimary`);
    expect(pk.map((r) => r.attname)).toEqual(["user_id"]);
  });

  it("DEV-005: forventede constraints, indekser og triggere på søkekjøringer", async () => {
    const names = async (t: string) => (await q<{ conname: string }>("select conname::text from pg_constraint where conrelid = $1::regclass", [`public.${t}`])).map((r) => r.conname);
    expect(await names("search_runs")).toEqual(expect.arrayContaining([
      "search_runs_pkey", "search_runs_id_dealership_key", "search_runs_token_key", "search_runs_agent_fkey",
    ]));
    const fks = await q<{ def: string }>("select pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.search_runs'::regclass and contype = 'f'");
    expect(fks.some((f) => /FOREIGN KEY \(agent_id, dealership_id\) REFERENCES (public\.)?search_agents\(id, dealership_id\)/.test(f.def))).toBe(true);
    const rfks = await q<{ def: string }>("select pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.search_run_results'::regclass and contype = 'f'");
    expect(rfks.some((f) => /FOREIGN KEY \(search_run_id, dealership_id\) REFERENCES (public\.)?search_runs\(id, dealership_id\)/.test(f.def))).toBe(true);
    const idx = (await q<{ indexdef: string }>("select indexdef from pg_indexes where schemaname = 'public' and tablename = 'search_runs'")).map((r) => r.indexdef);
    expect(idx.some((d) => /UNIQUE INDEX search_runs_one_running_per_agent .*\(agent_id\) WHERE/.test(d))).toBe(true);
    for (const [t, expected] of [
      ["search_runs", ["search_runs_before_insert", "search_runs_before_update"]],
      ["search_run_results", ["search_run_results_before_insert"]],
    ] as const) {
      const trg = await q<{ tgname: string; tgenabled: string }>("select tgname::text, tgenabled::text from pg_trigger where tgrelid = $1::regclass and not tgisinternal order by 1", [`public.${t}`]);
      expect(trg, t).toEqual(expected.map((n) => ({ tgname: n, tgenabled: "O" })));
    }
  });

  it("DEV-005B0: rettighetsprofiler (private), rollen scout_ingest og utløpskolonner", async () => {
    expect((await q("select relname from pg_class where relnamespace = 'private'::regnamespace and relkind in ('r','p') order by 1")).map((r) => (r as { relname: string }).relname)).toEqual(["provider_rights_profiles"]);
    const trg = await q<{ tgname: string; tgenabled: string }>("select tgname::text, tgenabled::text from pg_trigger where tgrelid = 'private.provider_rights_profiles'::regclass and not tgisinternal");
    expect(trg).toEqual([{ tgname: "provider_rights_profiles_guard", tgenabled: "O" }]);
    const role = (await q<{ rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean }>("select rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname = 'scout_ingest'"))[0];
    expect(role, "rollen scout_ingest finnes").toBeDefined();
    expect(role).toEqual({ rolcanlogin: false, rolsuper: false, rolbypassrls: false }); // NOLOGIN som standard; passord settes utenfor git
    for (const t of ["search_runs", "search_run_results"]) {
      const cols = await q<{ column_name: string; is_nullable: string }>(
        "select column_name::text, is_nullable::text from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name in ('rights_profile_version', 'expires_at')", [t]);
      expect(cols.map((c) => `${c.column_name}:${c.is_nullable}`).sort(), t).toEqual(["expires_at:NO", "rights_profile_version:NO"]);
    }
    // Ingen rolle utenom eieren kan skrive til søkekjøringstabellene direkte
    for (const role of ["anon", "authenticated", "scout_ingest"]) { // service_role er Supabase-standard og brukes ikke av appen
      for (const t of ["search_runs", "search_run_results"]) {
        for (const priv of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
          if (role === "authenticated" && t === "search_runs" && priv === "INSERT") continue; // brukere starter kjøringer (kolonnevis)
          expect((await q<{ ok: boolean }>("select has_table_privilege($1, $2, $3) ok", [role, `public.${t}`, priv]))[0]!.ok, `${role} ${priv} ${t}`).toBe(false);
        }
      }
    }
  });

  it("alle constraints er validerte og triggerne er aktive", async () => {
    expect(await q("select conname from pg_constraint where connamespace = 'public'::regnamespace and not convalidated")).toEqual([]);
    const trg = await q<{ tgname: string; tgenabled: string }>("select tgname::text, tgenabled::text from pg_trigger where tgrelid = 'public.search_agents'::regclass and not tgisinternal order by 1");
    expect(trg).toEqual([{ tgname: "search_agents_active_limit", tgenabled: "O" }, { tgname: "search_agents_before_write", tgenabled: "O" }]);
  });

  it("DEV-004-funksjonene returnerer aldri NULL (en NULL-CHECK regnes som bestått)", async () => {
    const junk = ["null", "'null'::jsonb", "'[]'::jsonb", "'\"x\"'::jsonb", "'1'::jsonb", "'{}'::jsonb", "'{\"make\":null}'::jsonb",
      "'{\"broadSearchConfirmed\":null,\"bodyTypes\":[\"suv\"]}'::jsonb", "'{\"fuels\":\"petrol\"}'::jsonb", "'{\"retail\":5}'::jsonb"];
    for (const f of junk) {
      for (const a of junk) {
        const [r] = await q<{ r: boolean | null; v: boolean | null; w: boolean | null }>(
          `select private.agent_ready(${f.replace(/^null$/, "null::jsonb")}, ${a.replace(/^null$/, "null::jsonb")}) r,
                  private.agent_filters_valid(${f.replace(/^null$/, "null::jsonb")}) v,
                  private.agent_assumptions_valid(${a.replace(/^null$/, "null::jsonb")}) w`);
        expect(r!.r, `ready(${f},${a})`).not.toBeNull();
        expect(r!.v, `filters_valid(${f})`).not.toBeNull();
        expect(r!.w, `assumptions_valid(${a})`).not.toBeNull();
      }
    }
  });
});

describe("konfigurasjon", () => {
  it("rolle authenticated bruker READ COMMITTED som standard (grensetriggeren avviser REPEATABLE READ, DEC-025)", async () => {
    const rows = await q<{ cfg: string[] | null }>("select rolconfig::text[] cfg from pg_roles where rolname in ('authenticated', 'anon', 'authenticator')");
    for (const r of rows) expect((r.cfg ?? []).join(",")).not.toMatch(/default_transaction_isolation/);
    expect((await q<{ s: string }>("select current_setting('default_transaction_isolation') s"))[0]!.s).toBe("read committed");
  });

  it("Data API eksponerer ikke private; åpen registrering er av; ingen secrets i supabase/config.toml", () => {
    const toml = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
    expect(toml).toMatch(/^schemas = \["public", "graphql_public"\]$/m);
    expect(toml).not.toContain("private");
    const auth = toml.split("\n[auth.rate_limit]")[0]!;
    expect(auth).toMatch(/^enable_signup = false$/m);
    expect(auth).toMatch(/^enable_anonymous_sign_ins = false$/m);
    expect(toml).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9_-]{10,}|service_role_key/);
  });
});
