export function normalizeCheckName(s: string): string;
export function parseE2E(output: string | null, knownNames?: string[]): { modeLine: string; summary: string; items: { kind: "OK" | "FEIL" | "HOPP"; name: string; extra: string }[] };
