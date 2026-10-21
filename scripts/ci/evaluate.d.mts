export type Status = "PASS" | "FAIL" | "SKIPPED" | "NOT_RUN";
export interface Result { status: Status; notes: string[] }
export const KNOWN_ISOLATED_ONLY: string[];
export const OPEN_CHECKS: string[];
export function evaluateL1(i: { startRc: number | null; resetRc: number | null; actualVersions?: string; expectedVersions?: string; pgVersion?: string; images?: string[]; tail?: string[] }): Result;
export function evaluateL2(output: string | null, rc: number | null): Result;
export function evaluateL3(report: string | null, rc: number | null): Result;
export function evaluateL7(output: string | null, rc: number | null, buildRc: number | null): Result;
export function overall(results: Record<"L1" | "L2" | "L3" | "L7", Result>): "PASS" | "IKKE FULLT BESTÅTT";
export function buildReport(results: Record<"L1" | "L2" | "L3" | "L7", Result>, meta?: { preflight?: string[] }): string;
export function evaluateDir(dir: string): { results: Record<"L1" | "L2" | "L3" | "L7", Result>; report: string; verdict: "PASS" | "IKKE FULLT BESTÅTT"; suppressed: boolean };
