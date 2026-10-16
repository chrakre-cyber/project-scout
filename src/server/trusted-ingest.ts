import "server-only";
import { Pool } from "pg";
import type { StoragePolicy } from "@/domain/rights";
import type { RunCounts, SearchRunErrorCode } from "@/domain/search-run";
import type { ResultRow } from "./search-pipeline";

/**
 * Betrodd skrivevei for autoritative søkeresultater (DEC-029, FU-005-1).
 *
 * Ordinære brukere kan starte en kjøring, men har ingen rett til å lagre resultater eller avslutte den. Det gjøres
 * her, over en egen databasetilkobling som den begrensede rollen `scout_ingest` (ikke service-role): rollen har ingen
 * tabellrettigheter og kan bare kjøre fem SECURITY DEFINER-funksjoner. Tilkoblingsstrengen finnes kun som
 * serverside miljøvariabel `SCOUT_INGEST_DATABASE_URL` — aldri NEXT_PUBLIC_, aldri i klientkode, git eller logger.
 *
 * Alle kall tar firma-ID som forventning; databasen avviser en kjøring som ikke tilhører firmaet eller ikke pågår.
 * Feil oversettes til en kode uten feiltekst (tilkoblingsstrengen kan ellers lekke).
 */

export type TrustedErrorCode = "not_configured" | "not_found" | "rights_blocked" | "invalid" | "failed";

export class TrustedPathError extends Error {
  constructor(readonly code: TrustedErrorCode) {
    super(code);
    this.name = "TrustedPathError";
  }
}

let pool: Pool | null = null;

export function isTrustedPathConfigured(): boolean {
  return Boolean(process.env.SCOUT_INGEST_DATABASE_URL);
}

/**
 * Forhåndssjekk før en kjøring startes: er den betrodde veien konfigurert og kan den nås med gyldig innlogging?
 * Uten det ville en kjøring bli opprettet, men aldri kunne avsluttes (stående som «pågår» til opprydding etter 5 min).
 */
export async function checkTrustedPath(): Promise<"ok" | "not_configured" | "unreachable"> {
  if (!isTrustedPathConfigured()) return "not_configured";
  try {
    await getPool().query("select 1");
    return "ok";
  } catch {
    return "unreachable";
  }
}

function getPool(): Pool {
  const url = process.env.SCOUT_INGEST_DATABASE_URL;
  if (!url) throw new TrustedPathError("not_configured");
  pool ??= new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 });
  return pool;
}

function classify(e: unknown): TrustedPathError {
  if (e instanceof TrustedPathError) return e;
  const err = e as { code?: string; message?: string };
  const msg = err.message ?? "";
  if (msg.includes("search_run_rights_")) return new TrustedPathError("rights_blocked");
  if (err.code === "P0002" || msg.includes("trusted_run_not_found")) return new TrustedPathError("not_found");
  if (err.code === "23514" || err.code === "22023" || err.code === "23505" || err.code === "23502") return new TrustedPathError("invalid");
  return new TrustedPathError("failed");
}

async function call<T>(sql: string, params: unknown[]): Promise<T[]> {
  try {
    const res = await getPool().query(sql, params);
    return res.rows as T[];
  } catch (e) {
    throw classify(e);
  }
}

export async function trustedRunPolicy(dealershipId: string, runId: string): Promise<StoragePolicy> {
  const rows = await call<{
    profile_version: number; retention_seconds: number; allow_price: boolean; allow_specs: boolean;
    allow_text: boolean; allow_images: boolean; allow_seller_data: boolean;
  }>("select * from private.trusted_run_policy($1::uuid, $2::uuid)", [dealershipId, runId]);
  const r = rows[0];
  if (!r) throw new TrustedPathError("not_found");
  return {
    profileVersion: r.profile_version, retentionSeconds: r.retention_seconds, allowPrice: r.allow_price,
    allowSpecs: r.allow_specs, allowText: r.allow_text, allowImages: r.allow_images, allowSellerData: r.allow_seller_data,
  };
}

export async function trustedStoreResults(dealershipId: string, runId: string, rows: ResultRow[]): Promise<number> {
  const payload = rows.map((r) => ({
    source: r.source, source_listing_id: r.sourceListingId, content_hash: r.contentHash, rank: r.rank,
    match_status: r.matchStatus, unknown_criteria: r.unknownCriteria, listing_snapshot: r.snapshot,
  }));
  const res = await call<{ n: number }>("select private.trusted_store_results($1::uuid, $2::uuid, $3::jsonb) as n", [dealershipId, runId, JSON.stringify(payload)]);
  return res[0]?.n ?? 0;
}

export async function trustedCompleteRun(dealershipId: string, runId: string, counts: RunCounts): Promise<void> {
  await call("select private.trusted_complete_run($1::uuid, $2::uuid, $3::jsonb)", [dealershipId, runId, JSON.stringify(counts)]);
}

export async function trustedFailRun(dealershipId: string, runId: string, code: SearchRunErrorCode): Promise<void> {
  await call("select private.trusted_fail_run($1::uuid, $2::uuid, $3::text)", [dealershipId, runId, code]);
}

/** Sletter utløpte kjøringer og resultater (DEC-028). Periodisk kjøring kommer senere; kan kalles manuelt. */
export async function purgeExpiredRuns(batch = 500): Promise<{ runsDeleted: number; resultsDeleted: number }> {
  const rows = await call<{ runs_deleted: number; results_deleted: number }>("select * from private.purge_expired_search_runs($1::integer)", [batch]);
  return { runsDeleted: rows[0]?.runs_deleted ?? 0, resultsDeleted: rows[0]?.results_deleted ?? 0 };
}
