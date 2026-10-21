export const EXPIRED_TOKEN_TEST: string;
export const H3_TEST_FILES: string[];
export function literalsOf(env: Record<string, string | undefined>): string[];
export function hostedGroup(key: "L4a" | "L6", report: string | null, rc: number | null, opts?: { excluded?: string[] }): { status: string; notes: string[] };
export function hostedL7(out: string, rc: number | null | undefined, buildRc: number | null | undefined): { status: string; notes: string[] };
export function main(argv: string[], env: Record<string, string | undefined>, deps?: unknown): Promise<number>;
