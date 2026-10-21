export const STAGES: readonly string[];
export const MODES: readonly string[];
export class HostedTargetError extends Error { category: string }
export function fingerprintOf(ref: string): string;
export function maskRef(ref: string): string;
export interface HostedTarget { ref: string; mode: "fresh" | "upgrade"; stage: string | null; dbKind: "direct" | "pooler"; fingerprint: string; masked: string }
export function parseHostedTarget(env: Record<string, string | undefined>, opts?: { stage?: string }): HostedTarget;
export function describeTarget(t: HostedTarget): { fingerprint: string; mode: string; dbKind: string };
