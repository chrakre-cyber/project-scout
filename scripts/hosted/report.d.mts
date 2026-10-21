import type { HostedTarget } from "./target.mjs";
export const LABEL: Record<string, string>;
export const MODE_LABEL: Record<string, string>;
type Res = { status: string; notes?: string[] };
interface InspectLike { state: string; stopReasons: string[]; migrations: { appliedCount: number }; repoMigrations: number; data002d: { status: string; invalidProfiles?: number | null }; verdict: string }
export interface Item { key: string; title: string; status: string; required?: boolean; notes?: string[] }
export function overall(items: Item[]): "PASS" | "FAIL" | "INCOMPLETE" | "NOT_RUN";
export function h2Items(i: { mode: string; inspect?: Partial<InspectLike> | null; dryRun?: Res | null; apply?: Res | null; verify?: Res | null }): Item[];
export function h3Items(i: { l4a?: Res | null; l6?: Res | null; secrets?: Res | null; browser?: Record<string, Res | undefined> }): Item[];
export function h4Items(i: { cleanupPlan?: Res | null; cleanupExecute?: Res | null; verify?: Res | null; ownerDeletion?: Res | null }): Item[];
export function formatReport(i: { stage: string; target: Pick<HostedTarget, "mode" | "fingerprint">; items: Item[]; literals?: string[]; versions?: string[] }): string;
