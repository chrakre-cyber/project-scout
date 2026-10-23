/**
 * Kjøretidsrettigheter (DATA-002D). Rent domene: ingen I/O, ingen DB, ingen kryptografi (avtrykk injiseres av serveren).
 *
 * Gjør om rader fra den autoritative tabellen `private.provider_rights_profiles` (levert av `private.trusted_rights_profiles()`) til typede
 * `ProviderRightsProfile`, og bygger et `RuntimeRights`-øyeblikksbilde som resten av koden spør. Prinsipper:
 *  - Fail closed: en rad som ikke kan tolkes fullt ut avvises, og leverandøren den tilhører blokkeres (en tolkbar eldre versjon skal ikke
 *    slippe gjennom i stedet for en defekt nyere). Manglende, ukjent, utløpt eller ugyldig ⇒ ingen rettigheter.
 *  - Kode kan bare levere SYNTETISKE profiler. En sandbox-/live-profil i kode avvises: ekte rettigheter kommer kun fra databasen.
 *  - Samme (leverandør, versjon) i kode og database med ulikt avtrykk er en konflikt ⇒ leverandøren blokkeres.
 *  - Databasen utilgjengelig/ugyldig ⇒ bare de syntetiske kodeprofilene gjelder; alt leverandørbasert nektes.
 */
import type { FieldRights, ProviderEnvironment, ProviderRightsProfile, ResolvedRights } from "./provider-rights";
import { ECONOMICS_FIELD_KEYS, RIGHTS_FIELD_KEYS, resolveRights, validateProfile } from "./provider-rights";

/** Rad slik databasen leverer den (snake_case). Alt er `unknown` til det er validert. */
export type RightsProfileRow = Readonly<Record<string, unknown>>;

export type RowMapResult =
  | { ok: true; profile: ProviderRightsProfile }
  | { ok: false; providerId: string | null; issues: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/**
 * Tidspunkt → kanonisk ISO 8601 UTC. Hele sekunder skrives uten millisekunder («2026-10-01T00:00:00Z»), slik kodeprofilene er skrevet, slik at samme
 * profil gir samme avtrykk uansett om den kommer fra kode eller database. Ugyldig ⇒ null.
 */
function isoUtc(v: unknown): string | null {
  const d = v instanceof Date ? v : typeof v === "string" ? new Date(v) : null;
  if (d === null || !Number.isFinite(d.getTime())) return null;
  return d.toISOString().replace(/\.000Z$/, "Z");
}

/** Boolsk kart med nøyaktig de forventede nøklene; ellers null (ingen delvis tolkning). */
function boolMap<K extends string>(v: unknown, keys: readonly K[]): Readonly<Record<K, boolean>> | null {
  if (!isRecord(v)) return null;
  const got = Object.keys(v).sort();
  if (got.join() !== [...keys].sort().join() || Object.values(v).some((x) => typeof x !== "boolean")) return null;
  return Object.freeze({ ...v }) as Readonly<Record<K, boolean>>;
}

/** Streng, total mapper fra DB-rad til profil. Aldri unntak; aldri delvis tolket profil. */
export function profileFromRow(row: unknown): RowMapResult {
  if (!isRecord(row)) return { ok: false, providerId: null, issues: ["row"] };
  const providerId = str(row.provider);
  const issues: string[] = [];
  const need = <T,>(name: string, v: T | null): T => { if (v === null) issues.push(name); return v as T; };

  const status = need("status", str(row.status)) as ProviderRightsProfile["status"];
  const environment = need("environment", str(row.environment)) as ProviderEnvironment;
  const display = boolMap(row.display_fields, RIGHTS_FIELD_KEYS);
  const matching = boolMap(row.matching_fields, RIGHTS_FIELD_KEYS);
  const allow = boolMap(row.allow_derived_economics, ECONOMICS_FIELD_KEYS);
  if (display === null) issues.push("display_fields");
  if (matching === null) issues.push("matching_fields");
  if (allow === null) issues.push("allow_derived_economics");
  const countries = Array.isArray(row.allowed_countries) && row.allowed_countries.every((c) => typeof c === "string") ? (row.allowed_countries as string[]) : null;
  if (countries === null) issues.push("allowed_countries");
  const validUntilRaw = row.effective_to;
  const validUntil = validUntilRaw === null || validUntilRaw === undefined ? null : need("effective_to", isoUtc(validUntilRaw));
  const verifiedAtRaw = row.verified_at;
  const verifiedAt = verifiedAtRaw === null || verifiedAtRaw === undefined ? null : need("verified_at", isoUtc(verifiedAtRaw));
  const onRevocation = str(row.on_revocation);
  if (onRevocation !== "hide_and_purge" && onRevocation !== "hide_only") issues.push("on_revocation");

  const p: ProviderRightsProfile = {
    providerId: need("provider", providerId) ?? "",
    environment,
    version: need("version", int(row.version)) ?? 0,
    status,
    validFrom: need("effective_from", isoUtc(row.effective_from)) ?? "",
    validUntil,
    sourceRef: need("source_ref", str(row.source_ref)) ?? "",
    verifiedBy: row.verified_by === null || row.verified_by === undefined ? null : need("verified_by", str(row.verified_by)),
    verifiedAt,
    providerName: row.provider_name === null || row.provider_name === undefined ? null : need("provider_name", str(row.provider_name)),
    display: display ?? ({} as FieldRights),
    matching: matching ?? ({} as FieldRights),
    storage: {
      retentionSeconds: need("retention_seconds", int(row.retention_seconds)) ?? -1,
      cacheSeconds: need("cache_seconds", int(row.cache_seconds)) ?? -1,
      historyRetentionSeconds: need("history_retention_seconds", int(row.history_retention_seconds)) ?? -1,
      storable: {
        price: need("allow_price", bool(row.allow_price)) ?? false, specs: need("allow_specs", bool(row.allow_specs)) ?? false,
        text: need("allow_text", bool(row.allow_text)) ?? false, images: need("allow_images", bool(row.allow_images)) ?? false,
        sellerData: need("allow_seller_data", bool(row.allow_seller_data)) ?? false,
      },
    },
    usage: {
      multiCustomerReuse: need("multi_customer_reuse", bool(row.multi_customer_reuse)) ?? false,
      reEvaluation: need("re_evaluation_allowed", bool(row.re_evaluation_allowed)) ?? false,
      alerts: need("alerts_allowed", bool(row.alerts_allowed)) ?? false,
    },
    geography: { unrestricted: need("geography_unrestricted", bool(row.geography_unrestricted)) ?? false, countries: countries ?? [] },
    attribution: {
      required: need("attribution_required", bool(row.attribution_required)) ?? true,
      text: row.attribution_text === null || row.attribution_text === undefined ? null : need("attribution_text", str(row.attribution_text)),
    },
    deepLinkRequired: need("deep_link_required", bool(row.deep_link_required)) ?? false,
    onRevocation: (onRevocation ?? "hide_and_purge") as ProviderRightsProfile["onRevocation"],
    derivedEconomics: { allow: allow ?? ({} as ProviderRightsProfile["derivedEconomics"]["allow"]), display: need("display_derived_economics", bool(row.display_derived_economics)) ?? false },
  };
  if (issues.length > 0) return { ok: false, providerId, issues };
  const structural = validateProfile(p);
  if (structural.length > 0) return { ok: false, providerId, issues: structural };
  return { ok: true, profile: Object.freeze(p) };
}

// ---------------------------------------------------------------- øyeblikksbilde

export type RuntimeRightsStatus =
  | "ok"                       // databasen ble lest og alle rader ble tolket
  | "database_not_configured"  // ingen databasevei (demo/CI): bare syntetiske kodeprofiler
  | "database_unavailable"     // lesing feilet: bare syntetiske kodeprofiler, alt leverandørbasert nektes
  | "degraded";                // databasen ble lest, men minst én rad/leverandør ble avvist (de berørte leverandørene er blokkert)

export interface RejectedProfile { providerId: string | null; version: number | null; reason: string }

export interface RuntimeRights {
  /** Profiler som kan vurderes av `resolveRights` (blokkerte leverandører er fjernet). */
  readonly profiles: readonly ProviderRightsProfile[];
  /** Leverandører som feiler lukket uansett hva som ellers finnes (defekt rad, kodekonflikt, ekte profil i kode). */
  readonly blockedProviders: ReadonlySet<string>;
  readonly status: RuntimeRightsStatus;
  readonly rejected: readonly RejectedProfile[];
  readonly loadedAt: string;
}

export interface BuildRuntimeRightsInput {
  /** Profiler definert i kode. Bare miljø `synthetic` godtas. */
  codeProfiles: readonly ProviderRightsProfile[];
  /** Rader fra databasen; `null` = ikke konfigurert, `"unavailable"` = lesing feilet. */
  database: readonly unknown[] | null | "unavailable";
  now: Date;
  /** SHA-256 (hex) av `canonicalPermissions` — injisert (domenet har ingen kryptografi). */
  digestOf: (p: ProviderRightsProfile) => string;
}

export function buildRuntimeRights(i: BuildRuntimeRightsInput): RuntimeRights {
  const rejected: RejectedProfile[] = [];
  const blocked = new Set<string>();
  const byKey = new Map<string, ProviderRightsProfile>();
  const key = (p: ProviderRightsProfile) => `${p.providerId}\u0000${p.version}`;

  for (const p of i.codeProfiles) {
    const issues = validateProfile(p);
    if (p.environment !== "synthetic") { rejected.push({ providerId: p.providerId, version: p.version, reason: "code_profile_not_synthetic" }); blocked.add(p.providerId); continue; }
    if (issues.length > 0) { rejected.push({ providerId: p.providerId, version: p.version, reason: `code_profile_invalid:${issues.join(",")}` }); blocked.add(p.providerId); continue; }
    byKey.set(key(p), p);
  }

  let status: RuntimeRightsStatus;
  if (i.database === null) status = "database_not_configured";
  else if (i.database === "unavailable") status = "database_unavailable";
  else {
    status = "ok";
    for (const row of i.database) {
      const m = profileFromRow(row);
      if (!m.ok) {
        const version = isRecord(row) ? int(row.version) : null;
        rejected.push({ providerId: m.providerId, version, reason: `row_invalid:${m.issues.join(",")}` });
        if (m.providerId !== null) blocked.add(m.providerId);
        status = "degraded";
        continue;
      }
      const existing = byKey.get(key(m.profile));
      if (existing !== undefined && i.digestOf(existing) !== i.digestOf(m.profile)) {
        rejected.push({ providerId: m.profile.providerId, version: m.profile.version, reason: "code_database_conflict" });
        blocked.add(m.profile.providerId);
        status = "degraded";
        continue;
      }
      byKey.set(key(m.profile), existing ?? m.profile);
    }
  }

  const profiles = [...byKey.values()].filter((p) => !blocked.has(p.providerId));
  return Object.freeze({ profiles: Object.freeze(profiles), blockedProviders: blocked, status, rejected: Object.freeze(rejected), loadedAt: i.now.toISOString() });
}

/** Rettigheter for en leverandør nå. Blokkert leverandør ⇒ `invalid_profile`; ellers vanlig default-deny-oppløsning. */
export function resolveRuntimeRights(rt: RuntimeRights, providerId: string, now: Date): ResolvedRights {
  if (rt.blockedProviders.has(providerId)) return { inForce: false, reason: "invalid_profile", providerId, profileVersion: 0 };
  return resolveRights(providerId, rt.profiles, now);
}
