/**
 * Datasettepoke for de SYNTETISKE demodataene (ECON-006e).
 *
 * Fixturene har faste, absolutte observasjonstider og blir derfor utløpt for økonomi (rettighetsprofilens lagringstid, 7 døgn).
 * Fornyelsen er en bevisst, dokumentert handling — ikke en rullering: tidene flyttes bare til et vindu på 0–48 timer FØR en
 * eksplisitt, validert epoke. Epoken er en fast konstant i koden (`SYNTHETIC_DEFAULT_EPOCH`, satt ved siste fornyelse) og kan
 * overstyres server-side med `SCOUT_SYNTHETIC_EPOCH`. Uten ny fornyelse blir dataene utløpt igjen: utløpskontrollen
 * (`retentionExpiresAt`, `source_observation_in_future`) er uendret og vurderer epoken mot den faktiske klokken.
 *
 * Regler:
 *  - epoken må være ≤ nå. Ingen toleranse, ingen automatisk justering eller klemming; ugyldig epoke gir kildefeil (lukket).
 *  - kun observasjonstidene (`observed`) fornyes. Innhold og `modifiedAt` (→ `sourceModifiedAt`, del av revisjonsgrunnlaget) er uendret,
 *    så kandidat-id og revisjon er de samme før og etter fornyelsen.
 *  - avbildningen er monoton (heltall, ingen flyttall): rekkefølgen mellom og innen annonser bevares, og `lastSeenAt ≥ firstSeenAt`.
 *
 * Ingen nettverk og ingen secrets. Eneste sted `SCOUT_SYNTHETIC_EPOCH` leses.
 */
import { SYNTHETIC_RIGHTS_PROFILE } from "@/domain/provider-rights";
import type { SyntheticRawListing } from "./raw";

/** Siste fornyelse av standarddatasettet (UTC). Endres kun ved dokumentert fornyelse (FIXTURES.md «Fornyelse»). */
export const SYNTHETIC_DEFAULT_EPOCH = "2026-10-21T06:50:00Z";

/** Observasjonsvinduet før epoken. */
export const OBSERVATION_WINDOW_HOURS = 48;
const WINDOW_MS = BigInt(OBSERVATION_WINDOW_HOURS) * 3_600_000n;

const EPOCH_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export type EpochRefusal = "format" | "in_future" | "before_profile" | "before_dataset";

export interface EpochFloors {
  /** Tidligste tillatte starttidspunkt for observasjonsvinduet (ms): rettighetsprofilens `validFrom`. */
  profileValidFromMs: number;
  /** Seneste `modifiedAt` i datasettet (ms), eller null hvis ingen. Observasjoner skal ikke ligge før kildens endringstid. */
  datasetLatestModifiedMs: number | null;
}

export type EpochResult = { ok: true; epoch: string } | { ok: false; reason: EpochRefusal };

export const EPOCH_REFUSAL_TEXT: Record<EpochRefusal, string> = {
  format: "SCOUT_SYNTHETIC_EPOCH må være et UTC-tidspunkt på formen ÅÅÅÅ-MM-DDTTT:MM:SSZ",
  in_future: "epoken ligger i fremtiden",
  before_profile: "observasjonsvinduet starter før rettighetsprofilens gyldighet",
  before_dataset: "observasjonsvinduet starter før datasettets siste endringstid",
};

export function epochFloors(records: readonly SyntheticRawListing[]): EpochFloors {
  let latest: number | null = null;
  for (const r of records) {
    if (r?.modifiedAt == null) continue;
    const t = Date.parse(r.modifiedAt);
    if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
  }
  return { profileValidFromMs: Date.parse(SYNTHETIC_RIGHTS_PROFILE.validFrom), datasetLatestModifiedMs: latest };
}

/** Streng validering: eksakt format, ekte kalenderdato, og `epoke ≤ now` uten toleranse. */
export function validateSyntheticEpoch(value: unknown, now: Date, floors: EpochFloors): EpochResult {
  if (typeof value !== "string" || !EPOCH_FORMAT.test(value)) return { ok: false, reason: "format" };
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== `${value.slice(0, -1)}.000Z`) return { ok: false, reason: "format" };
  if (ms > now.getTime()) return { ok: false, reason: "in_future" };
  const windowStart = ms - Number(WINDOW_MS);
  if (windowStart < floors.profileValidFromMs) return { ok: false, reason: "before_profile" };
  if (floors.datasetLatestModifiedMs !== null && windowStart < floors.datasetLatestModifiedMs) return { ok: false, reason: "before_dataset" };
  return { ok: true, epoch: value };
}

/** Epoken fra server-miljøet, ellers den innebygde. Tom verdi regnes som ikke satt; alt annet valideres (ingen stille reserve). */
export function configuredSyntheticEpoch(configured: string | undefined = process.env.SCOUT_SYNTHETIC_EPOCH): string {
  return configured === undefined || configured === "" ? SYNTHETIC_DEFAULT_EPOCH : configured;
}

/**
 * Flytter `observed` for alle poster til [epoke − 48 t, epoke]. Heltallsavbildning (BigInt, hele sekunder, avrundet ned) som er
 * monoton over alle observasjonstider i datasettet. Innhold og `modifiedAt` røres ikke. Poster med ugyldige tidspunkt beholdes
 * uendret slik at normaliseringen avviser dem som før.
 */
export function renewObservations(records: readonly SyntheticRawListing[], epoch: string): SyntheticRawListing[] {
  const epochMs = BigInt(Date.parse(epoch));
  const ts = (v: unknown): bigint | null => {
    if (typeof v !== "string") return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? BigInt(t) : null;
  };
  let min: bigint | null = null;
  let max: bigint | null = null;
  for (const r of records) {
    for (const t of [ts(r?.observed?.firstSeenAt), ts(r?.observed?.lastSeenAt)]) {
      if (t === null) continue;
      if (min === null || t < min) min = t;
      if (max === null || t > max) max = t;
    }
  }
  const span = min === null || max === null ? 0n : max - min;
  const start = epochMs - WINDOW_MS;
  const map = (t: bigint): string => {
    const ms = span === 0n ? epochMs : start + ((t - min!) * WINDOW_MS) / span;
    return new Date(Number(ms - (ms % 1000n))).toISOString().replace(".000Z", "Z");
  };
  return records.map((r) => {
    const first = ts(r?.observed?.firstSeenAt);
    const last = ts(r?.observed?.lastSeenAt);
    if (first === null || last === null) return r;
    return { ...r, observed: { firstSeenAt: map(first), lastSeenAt: map(last) } };
  });
}

/** «21.10.2026» fra epoken (UTC-dato). Ingen datoformatering via Date/locale. */
export function epochDateNo(epoch: string): string {
  return `${epoch.slice(8, 10)}.${epoch.slice(5, 7)}.${epoch.slice(0, 4)}`;
}

/** Merkingen som vises sammen med de syntetiske dataene. */
export function syntheticGeneratedText(epoch: string): string {
  return `Syntetisk generert ${epochDateNo(epoch)} — ikke hentet fra leverandør`;
}
