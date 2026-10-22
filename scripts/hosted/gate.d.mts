import type { HostedTarget } from "./target.mjs";
export const MAX_AGE_MS: number;
export function checkGate(i: { stage: string; target: HostedTarget; inspect: unknown; dryRun?: unknown; repoHash: string; now?: Date; backupConfirmed?: boolean; maxAgeMs?: number }): { allow: boolean; reasons: string[] };
