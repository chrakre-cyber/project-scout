import type { Classification, RepoMigration } from "./migrations.mjs";
export const TEST_EMAIL_SUFFIX: string;
export const DATA002D_VERSION: string;
export interface InspectReport {
  schemaVersion: 1; kind: "hosted-inspect"; takenAt: string; mode: string; target: { fingerprint: string }; repoHash: string; repoMigrations: number;
  migrations: { historyTable: boolean; appliedCount: number; classification: Classification["kind"]; pending: string[]; unknownApplied: string[] };
  schema: { publicTables: number; privateTables: number }; counts: Record<string, number | null>; auth: { users: number | null; nonTestUsers: number | null };
  data002d: { status: string; invalidProfiles: number | null; note: string; profiles?: string[] }; state: string; nothingToApply: boolean; verdict: "OK" | "STOPP"; stopReasons: string[];
}
export function inspectDatabase(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, o: { repoList: RepoMigration[]; mode: string; target: { fingerprint: string }; now?: Date }): Promise<InspectReport>;
