// Hjelper: scratch-databaser i den isolerte klyngen med shim + et utvalg migrasjoner, med eller uten registrert historikk (supabase_migrations.schema_migrations).
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import type { Client as PgClient } from "pg";

const DIR = "supabase/migrations";
export const MIGRATION_FILES = readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

export async function withScratch<T>(admin: PgClient, opts: { apply: number; record?: boolean; shim?: boolean }, fn: (c: PgClient) => Promise<T>): Promise<T> {
  const name = `hosted_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await admin.query(`create database ${name}`);
  const u = new URL(process.env.SUPABASE_TEST_DB_URL!); u.pathname = `/${name}`;
  const c = new Client({ connectionString: u.toString() });
  await c.connect();
  try {
    if (opts.shim !== false) await c.query(readFileSync("tests/db/support/supabase-shim.sql", "utf8").replace(/^create role .*$/gm, ""));
    for (const f of MIGRATION_FILES.slice(0, opts.apply)) await c.query(readFileSync(`${DIR}/${f}`, "utf8"));
    if (opts.record !== false && opts.apply > 0) {
      await c.query("create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)");
      for (const f of MIGRATION_FILES.slice(0, opts.apply)) await c.query("insert into supabase_migrations.schema_migrations (version, name) values ($1,$2)", [f.slice(0, 14), f.slice(15, -4)]);
    }
    return await fn(c);
  } finally { await c.end(); await admin.query(`drop database ${name}`); }
}
export const idx = (needle: string) => MIGRATION_FILES.findIndex((f) => f.includes(needle));
