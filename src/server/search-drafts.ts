import "server-only";
/**
 * Lagring av søkeutkast (SEARCH-005): `public.search_drafts`, firmaavgrenset med RLS. Kjører som innlogget bruker via Supabase
 * (publishable key) — aldri service-role. Firma kommer fra validert sesjon/membership (og avgjøres til slutt av databasen).
 *
 * Valideringsgrenser:
 *  - Serveren validerer HELE dokumentet mot katalogen (`specFromJson`) før lagring OG når et lagret dokument åpnes.
 *  - Databasen validerer struktur og grenser, ikke katalogtilhørighet (se migrasjonen).
 *  - `expectedVersion` sendes som `base_version`; databasen avviser skrivingen atomisk hvis raden er endret (konflikt).
 *
 * Penger krysser grensen som heltallsstrenger i `SearchSpecJson`; `bigint` finnes bare i den interne modellen.
 */
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { specFromJson } from "@/domain/search-v2/serialization";
import type { SearchSpecJson } from "@/domain/search-v2/serialization";
import type { Issue, SearchSpec } from "@/domain/search-v2/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapError } from "./search-draft-errors";
import type { DraftWriteError } from "./search-draft-errors";
import type { SessionContext } from "./session";

export type { DraftWriteError };

type Member = Extract<SessionContext, { status: "member" }>;

const COLUMNS = "id, dealership_id, name, spec, version, created_at, updated_at";

interface DraftRow {
  id: string;
  dealership_id: string;
  name: string;
  spec: unknown;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DraftMeta {
  id: string;
  name: string;
  /** Redigeringsversjon (settes av databasen). */
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type Draft =
  | (DraftMeta & { readable: true; spec: SearchSpec; json: SearchSpecJson })
  | (DraftMeta & { readable: false; issues: Issue[] });

export type DraftWriteResult = { ok: true; draft: Draft } | { ok: false; code: DraftWriteError };

function toDraft(row: DraftRow): Draft {
  const meta: DraftMeta = { id: row.id, name: row.name, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
  const parsed = specFromJson(row.spec, DEMO_CATALOG);
  return parsed.ok
    ? { ...meta, readable: true, spec: parsed.value, json: row.spec as SearchSpecJson }
    : { ...meta, readable: false, issues: parsed.issues };
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase er ikke konfigurert");
  return supabase;
}

/** Utkast for brukerens firma. RLS begrenser; firmafilteret er ekstra forsvar. */
export async function listDrafts(ctx: Member): Promise<Draft[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_drafts").select(COLUMNS).eq("dealership_id", ctx.dealership.id).order("updated_at", { ascending: false });
  if (error) throw new Error(`Kunne ikke hente søkeutkast (${error.code})`);
  return (data as DraftRow[]).map(toDraft);
}

export async function getDraft(ctx: Member, id: string): Promise<Draft | null> {
  if (!isUuid(id)) return null;
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_drafts").select(COLUMNS).eq("id", id).eq("dealership_id", ctx.dealership.id).maybeSingle();
  if (error) throw new Error(`Kunne ikke hente søkeutkast (${error.code})`);
  return data ? toDraft(data as DraftRow) : null;
}

/** Nytt utkast. Firma settes av databasen fra membership; det oppgis ikke her. */
export async function createDraft(_ctx: Member, name: string, json: SearchSpecJson): Promise<DraftWriteResult> {
  const supabase = await client();
  const { data, error } = await supabase.from("search_drafts").insert({ name, spec: json }).select(COLUMNS).single();
  return error ? { ok: false, code: mapError(error) } : { ok: true, draft: toDraft(data as DraftRow) };
}

/**
 * Lagrer endringer. `expectedVersion` er versjonen brukeren åpnet; databasen avviser skrivingen atomisk hvis den ikke
 * lenger er gjeldende. Ingen lesing-før-skriving i appen er nødvendig for korrektheten (den ville bare vært et kappløp).
 */
export async function updateDraft(ctx: Member, id: string, expectedVersion: number, name: string, json: SearchSpecJson): Promise<DraftWriteResult> {
  if (!isUuid(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { ok: false, code: "not_found" };
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_drafts")
    .update({ name, spec: json, base_version: expectedVersion })
    .eq("id", id).eq("dealership_id", ctx.dealership.id)
    .select(COLUMNS).maybeSingle();
  if (error) return { ok: false, code: mapError(error) };
  return data ? { ok: true, draft: toDraft(data as DraftRow) } : { ok: false, code: "not_found" };
}
