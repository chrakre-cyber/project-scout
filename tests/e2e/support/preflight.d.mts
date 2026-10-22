export class TargetError extends Error {}
export function preflightTargets(opts?: { mode?: "real" | "emulator"; env?: Record<string, string | undefined> }): { mode: "real" | "emulator"; dbUrl: string; apiUrl: string | null; hasPublishableKey: boolean };
