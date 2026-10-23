/**
 * Kjøretidslasting av rettighetsprofiler (DATA-002D). Server-modul.
 *
 * Profilene hentes fra den autoritative tabellen via den betrodde, skrivebeskyttede veien (`trustedRightsProfiles`, rollen `scout_ingest`) og
 * tolkes av domenet (`buildRuntimeRights`). Syntetiske kodeprofiler gjelder alltid (demo uten Supabase); sandbox-/live-rettigheter kan bare komme
 * fra databasen. Lesing feiler lukket: databasen konfigurert men utilgjengelig ⇒ bare syntetisk, alt leverandørbasert nektes.
 *
 * Ingen cache mellom kall: en tilbakekalling/utløp skal gjelde umiddelbart (DEC-028). Kostnaden (ett kort oppslag per visningsforespørsel) er et åpent
 * punkt, ikke en grunn til å svekke ferskheten.
 *
 * Denne modulen importerer ikke `trusted-ingest` statisk (den er `server-only` og eneste leser av tilkoblingsstrengen); standardleseren laster den ved behov.
 */
import { REGISTERED_PROFILES } from "@/domain/provider-rights";
import type { ProviderRightsProfile } from "@/domain/provider-rights";
import { buildRuntimeRights } from "@/domain/rights-runtime";
import type { RuntimeRights } from "@/domain/rights-runtime";
import { profileDigest } from "./public-ids";

/** `null` = ikke konfigurert. Kaster ved feil (fanges og gir `database_unavailable`). */
export type RightsRowReader = () => Promise<readonly unknown[] | null>;

const defaultReader: RightsRowReader = async () => (await import("./trusted-ingest")).trustedRightsProfiles();

export interface LoadOptions {
  reader?: RightsRowReader;
  codeProfiles?: readonly ProviderRightsProfile[];
  now?: Date;
}

export async function loadRuntimeRights(o: LoadOptions = {}): Promise<RuntimeRights> {
  const now = o.now ?? new Date();
  let database: readonly unknown[] | null | "unavailable";
  try { database = await (o.reader ?? defaultReader)(); } catch { database = "unavailable"; } // aldri feiltekst videre (kan inneholde tilkoblingsdetaljer)
  return buildRuntimeRights({ codeProfiles: o.codeProfiles ?? REGISTERED_PROFILES, database, now, digestOf: profileDigest });
}

/** Profilene som kan vurderes nå (blokkerte leverandører fjernet). Standardkilden for visningsgrensen når kalleren ikke oppgir profiler. */
export async function loadRuntimeProfiles(o: LoadOptions = {}): Promise<readonly ProviderRightsProfile[]> {
  return (await loadRuntimeRights(o)).profiles;
}
