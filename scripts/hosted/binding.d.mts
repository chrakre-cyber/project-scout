export const REPORT_MAX_AGE_MS: number;
export interface Binding { target: { fingerprint: string }; mode: string; repoHash: string; takenAt: string; [k: string]: unknown }
export function stamp(target: { fingerprint: string; mode: string }, repoHash: string, now: Date, extra?: Record<string, unknown>): Binding;
export function checkBinding(b: unknown, ctx: { target: { fingerprint: string; mode: string }; repoHash: string; now: Date; maxAgeMs?: number }): { ok: boolean; reason?: string };
