/**
 * SEARCH-002 — versjonert søkemodell (parallell, frakoblet fra AgentFilters/AgentAssumptions).
 *
 * Ren domenekode (CLAUDE.md pkt. 2): ingen UI, database, provider, nettverk eller prototype-JS.
 * Modellen er IKKE aktiv i appen; lagring, migrasjon og integrasjon er egne oppgaver (SEARCH-001B).
 *
 * Konvensjoner (CLAUDE.md pkt. 4, DEC-017/DEC-020):
 *  - «Ikke satt» (usatt filter) er `null` / tom liste. Ukjent annonseverdi er `null` på kandidaten. De to
 *    betyr ulike ting og blandes aldri.
 *  - Penger er eksakte heltall i minste enhet (`bigint`) med eksplisitt valuta; i JSON er `amountMinor`
 *    en heltallsstreng, høyst 2^53-1 (DEC-020). Ukjent beløp er `null`, eksplisitt 0 er `0n`.
 *  - Modellversjonen (`SEARCH_MODEL_VERSION`) er adskilt fra prototypens filformat-versjon 2
 *    (`merovo.search-draft`). Prototypefiler importeres ikke her.
 */
import type { BodyType, CurrencyCode, FirstRegistration, Fuel, Transmission } from "../types";

export const SEARCH_MODEL_SCHEMA = "merovo.search-model";
export const SEARCH_MODEL_VERSION = 1;

/** Høyeste beløp (minste enhet) som kan serialiseres (DEC-020: 2^53-1). */
export const MAX_MINOR = 9_007_199_254_740_991n;

export type Priority = "must" | "nice";
export type DriveTrain = "awd" | "fwd" | "rwd";
export type VatBasis = "incl" | "excl" | "none";

export const BODY_TYPES: readonly BodyType[] = ["sedan", "estate", "suv", "hatchback", "coupe", "convertible", "van", "other"];
export const FUELS: readonly Fuel[] = ["petrol", "diesel", "electric", "hybrid", "plugin_hybrid", "other"];
export const TRANSMISSIONS: readonly Transmission[] = ["manual", "automatic"];
export const DRIVE_TRAINS: readonly DriveTrain[] = ["awd", "fwd", "rwd"];
export const VAT_BASES: readonly VatBasis[] = ["incl", "excl", "none"];
export const PRIORITIES: readonly Priority[] = ["must", "nice"];

/** Heltallsintervall; `null` på en side = ingen grense. Minst én side er satt når intervallet finnes. */
export interface IntRange {
  min: number | null;
  max: number | null;
}

/** Førstegangsregistrering fra–til. Hver side bærer sin egen presisjon (år, måned eller dato). */
export interface FirstRegistrationRange {
  from: FirstRegistration | null;
  to: FirstRegistration | null;
}

/**
 * Flervalg med ELLER innen listen og én felles prioritet for hele listen
 * (alternativene i en liste er ett kriterium; «må ha» for ett og «ønskelig» for et annet alternativ
 * i samme liste har ingen veldefinert betydning og er derfor ikke tillatt).
 */
export interface PrioritizedList {
  values: string[];
  priority: Priority;
}

/** Ett utstyrselement. Hvert element har egen prioritet; ulike «must»-elementer gjelder samtidig (OG). */
export interface EquipmentCriterion {
  key: string;
  priority: Priority;
}

export interface VehicleIdentity {
  /** Stabil katalognøkkel (ikke visningsnavn). */
  brand: string | null;
  /** Stabil katalognøkkel; krever merke. */
  model: string | null;
  /** Fritekst under gyldig modell. Avvises aldri fordi en forslagsliste ikke inneholder den. */
  variant: string | null;
}

/** Absolutte krav. Tom liste / `null` = ikke satt (ingen begrensning). */
export interface Requirements {
  modelYear: IntRange | null;
  firstRegistration: FirstRegistrationRange | null;
  maxMileageKm: number | null;
  seats: IntRange | null;
  bodyTypes: BodyType[];
  fuels: Fuel[];
  transmissions: Transmission[];
  driveTrains: DriveTrain[];
}

export interface Appearance {
  exteriorColors: PrioritizedList | null;
  interiorColors: PrioritizedList | null;
  interiorMaterials: PrioritizedList | null;
}

export type CostKind = "transport" | "travel" | "insurance" | "preparation" | "conversion" | "approval" | "custom";
/** Typer som høyst kan forekomme én gang. «custom» kan gjentas. */
export const SINGLE_COST_KINDS: readonly CostKind[] = ["transport", "travel", "insurance", "preparation", "conversion", "approval"];
export const COST_KINDS: readonly CostKind[] = [...SINGLE_COST_KINDS, "custom"];
export const MAX_COST_LINES = 30;
export const COST_LABEL_MAX = 60;

/**
 * Forhandlerens kostnadsforutsetning. Beløp og valuta er adskilt slik at valutaen bevares også når
 * beløpet er ukjent (`amountMinor === null`). 0n er et uttrykkelig valg og ikke det samme som ukjent.
 * Linjene er forutsetninger: de øker aldri budsjettgrensen (se budget.ts).
 */
export interface CostLine {
  /** Stabil id innen søket (^[a-z0-9][a-z0-9_-]{0,39}$). */
  id: string;
  kind: CostKind;
  label: string;
  currency: CurrencyCode;
  amountMinor: bigint | null;
  vatBasis: VatBasis | null;
  includedInBudget: boolean;
}

export interface BudgetSpec {
  /** Maks innkjøpskostnad til Norge i NOK (øre), > 0. `null` = ikke satt. */
  maxTotalNokMinor: bigint | null;
  /** Prisavvik i basispunkter (0–10 000 = 0–100 %). `null` = avslått (standard). */
  deviationBasisPoints: number | null;
  costs: CostLine[];
}

/**
 * Forhandlerens ØNSKE om norsk registrering/bruk. Dette er verken bilens nåværende kategori eller en
 * bekreftet registrerings-/beregningsprofil, og det beviser ikke at en bil kan godkjennes som varebil
 * eller gir noen bestemt avgiftsbehandling. Ombygging/godkjenning føres som kostnadslinjer
 * (kind «conversion»/«approval»).
 */
export type PlannedRegistrationScenario = "passenger" | "van" | "unspecified";
export const PLANNED_SCENARIOS: readonly PlannedRegistrationScenario[] = ["passenger", "van", "unspecified"];

export interface PlannedRegistration {
  requested: PlannedRegistrationScenario;
}

export interface SearchSpec {
  vehicle: VehicleIdentity;
  requirements: Requirements;
  appearance: Appearance;
  equipment: EquipmentCriterion[];
  budget: BudgetSpec;
  plannedRegistration: PlannedRegistration;
}

// ---------------------------------------------------------------- katalog- og kapasitetskontrakt

/**
 * Kontrollert, injiserbar katalog. Domenet kjenner ingen konkret katalog. En demokatalog (fixture) er
 * ikke produksjonsfasit. Variant er ikke en del av kontrakten: fritekst under gyldig modell er alltid tillatt.
 */
export interface SearchCatalog {
  /** Identifiserer katalogen i feilmeldinger og logg (f.eks. «test-fixture-v1»). */
  readonly id: string;
  hasBrand(brand: string): boolean;
  hasModel(brand: string, model: string): boolean;
  hasEquipment(key: string): boolean;
  hasExteriorColor(key: string): boolean;
  hasInteriorColor(key: string): boolean;
  hasInteriorMaterial(key: string): boolean;
}

/** Kriterier som den første operative modellen kan vurdere. */
export type CriterionId =
  | "brand" | "model" | "variant" | "modelYear" | "firstRegistration" | "maxMileage" | "seats"
  | "bodyTypes" | "fuels" | "transmissions" | "driveTrains"
  | "exteriorColors" | "interiorColors" | "interiorMaterials"
  | `equipment:${string}`;

/**
 * Hva en annonsekilde faktisk kan levere. Brukes før aktivering til å opplyse om kriterier kilden
 * verken kan hente eller vurdere (MEROVO_SEARCH_SPEC §4). `false` eller manglende = kan ikke leveres.
 */
export interface SourceCapabilities {
  readonly id: string;
  /** Kriterie-id → kan kilden levere dataene? Utstyr styres av `equipment`. */
  readonly fields: Readonly<Partial<Record<Exclude<CriterionId, `equipment:${string}`>, boolean>>>;
  readonly equipment: boolean;
}

// ---------------------------------------------------------------- kandidat

/**
 * Utstyrsopplysninger fra kilden. `null` på kandidaten = ingenting er opplyst om utstyr.
 * Fravær av omtale er IKKE fravær av utstyr: «mangler» krever `absent` eller `listComplete`.
 */
export interface EquipmentFacts {
  present: string[];
  /** Kilden har uttrykkelig bekreftet at utstyret ikke finnes. */
  absent: string[];
  /** Kilden har levert en fullstendig utstyrsliste (kjent fravær av alt som ikke står i `present`). */
  listComplete: boolean;
}

/** Kandidat (annonse) normalisert til katalognøkler. Mapping fra kildens tekst er en senere adapter. */
export interface CandidateV2 {
  id: string;
  /** Revisjon av kandidaten (f.eks. annonserevisjon). En vurdering gjelder én bestemt id + versjon. */
  version: string;
  /** Katalognøkkel; `null` = ikke oppgitt eller ikke mappet. */
  brandKey: string | null;
  modelKey: string | null;
  variant: string | null;
  /** Modellår — egen opplysning, aldri utledet av registreringsår. */
  modelYear: number | null;
  firstRegistration: FirstRegistration | null;
  mileageKm: number | null;
  seats: number | null;
  bodyType: BodyType | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  driveTrain: DriveTrain | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  interiorMaterial: string | null;
  equipment: EquipmentFacts | null;
  /** Modellpakker (kildens tekst). Beviser aldri enkeltutstyr og vurderes ikke i modellversjon 1. */
  packages: string[] | null;
  /** Bilens NÅVÆRENDE kategori hos kilden. Påvirker ingen kravvurdering. */
  currentCategory: "passenger" | "van" | "other" | null;
}

// ---------------------------------------------------------------- vurdering

export type CriterionStatus = "fulfilled" | "not_fulfilled" | "unknown";

export interface CriterionExplanation {
  criterion: CriterionId;
  priority: Priority;
  status: CriterionStatus;
  /** Maskinlesbar grunn, f.eks. «below_min», «candidate_value_missing», «source_list_incomplete». */
  reason: string;
}

export type VehicleStatus = "match" | "needs_review" | "excluded";

export interface VehicleEvaluation {
  status: VehicleStatus;
  /** Alle vurderte kriterier, i fast rekkefølge. */
  criteria: CriterionExplanation[];
  /** «Must»-kriterier med kjent brudd. */
  excludedBy: CriterionId[];
  /** «Must»-kriterier der opplysningen mangler. */
  unknownMust: CriterionId[];
  /** Ønskene (priority «nice») gruppert etter utfall; påvirker aldri `status`. */
  wishes: {
    fulfilled: CriterionId[];
    notFulfilled: CriterionId[];
    unknown: CriterionId[];
  };
}

// ---------------------------------------------------------------- budsjett

/** Fast budsjettbasis for modellversjon 1: total innkjøpskostnad til Norge inkl. beregnede norske avgifter og inkluderte kostnadslinjer. */
export const BUDGET_BASIS = "total_cost_to_norway_incl_calculated_norwegian_taxes";

export type BudgetStatus = "within_budget" | "within_deviation" | "over_limit" | "not_calculated";

export type NotCalculatedReason =
  | "no_budget"
  | "no_assessment"
  | "assessment_invalid"
  | "assessment_not_validated"
  | "assessment_incomplete"
  | "assessment_stale"
  | "currency_not_nok"
  | "basis_mismatch"
  | "scenario_unspecified"
  | "scenario_mismatch"
  | "included_cost_unknown"
  | "included_cost_not_covered"
  | "cost_basis_changed"
  | "candidate_mismatch"
  | "candidate_version_mismatch";

/** Identitet og revisjon for kandidaten en kostnadsvurdering skal brukes for. */
export interface CandidateRef {
  id: string;
  version: string;
}

/**
 * Forhåndsvurdert kandidatkostnad fra et FREMTIDIG beregningslag (finnes ikke ennå). Domenet her
 * regner ikke avgifter; det tar bare imot en eksplisitt, validert vurdering og klassifiserer den.
 */
export interface CostAssessment {
  totalMinor: bigint;
  currency: CurrencyCode;
  basis: string;
  /** Registreringsscenarioet totalen er beregnet for. */
  registrationScenario: "passenger" | "van";
  /** Bare «complete_validated» kan gi budsjettstatus. */
  status: "complete_validated" | "incomplete" | "unvalidated";
  /** Referanse til profil/versjon som ble brukt (sporbarhet). Må være ikke-tom. */
  profileRef: string;
  /** UTC ISO 8601. Vurderingen er foreldet når `now >= validUntil`. */
  validUntil: string;
  /** Id-ene til kostnadslinjene (med includedInBudget) som totalen faktisk dekker. */
  coveredCostLineIds: string[];
  /**
   * Kandidaten totalen er beregnet for (id + revisjon). En annen bils total, eller en annen revisjon av samme
   * annonse, er ikke «samme vurdering» og gir `candidate_mismatch` / `candidate_version_mismatch`.
   */
  candidateId: string;
  candidateVersion: string;
  /**
   * Beregningsgrunnlaget for kostnadsforutsetningene totalen bygger på: nøyaktig strengen `costBasisOf(spec)`
   * ga da vurderingen ble laget (se budget.ts). Avviker den fra gjeldende søk → `cost_basis_changed`.
   */
  costBasis: string;
}

export interface BudgetClassification {
  status: BudgetStatus;
  reason: NotCalculatedReason | null;
  /** Budsjettet og øvre grense i øre når budsjett finnes (uavhengig av om kandidaten kunne vurderes). */
  budgetMinor: bigint | null;
  upperLimitMinor: bigint | null;
}

export interface CandidateAssessment {
  vehicle: VehicleEvaluation;
  budget: BudgetClassification;
  /** Fullt treff = kjøretøyet er `match` OG budsjettet er innenfor budsjett/valgt avvik. Pris opphever aldri kravbrudd. */
  isFullHit: boolean;
}

// ---------------------------------------------------------------- resultat og feil

export interface Issue {
  /** Sti i inndata, f.eks. «requirements.seats.max» eller «budget.costs[2].currency». */
  path: string;
  code: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };
