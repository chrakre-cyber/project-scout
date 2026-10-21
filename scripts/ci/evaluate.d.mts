export type Status = "PASS" | "FAIL" | "SKIPPED" | "PARTIAL" | "NOT_RUN";
export interface Result { status: Status; notes: string[] }
export const ISOLATED_UPGRADE_TESTS: { file: string; fullName: string }[];
export const OPEN_CHECKS: string[];
export function evaluateL1(i: { startRc: number | null; resetRc: number | null; actualVersions?: string; expectedVersions?: string; pgVersion?: string; images?: string[]; tail?: string[] }): Result;
export function evaluateL2(output: string | null, rc: number | null): Result;
export interface L3aResult extends Result { knownSkipped: string[]; unknownSkipped: string[]; failed: number }
export interface L3bResult extends Result { passedIds: string[] }
export function evaluateL3a(report: string | null, rc: number | null): L3aResult;
export function evaluateL3b(i: { report: string | null; rc: number | null | undefined; binariesMissing?: boolean; upgradeOk?: boolean; pgVersion?: string }): L3bResult;
export const L4_L6_TESTS: { L4a: { file: string; fullName: string }[]; L6: { file: string; fullName: string }[] };
export function evaluateGroup(key: "L4a" | "L6", report: string | null, rc: number | null): Result;
export const E2E_PLAN: Record<string, { title: string; script: string; wrapperArg: string; logins: number; timeoutSec: number; checks: string[]; partialInReal: string[]; optionalOneOf?: string[][] }>;
export function evaluateE2E(key: "l4" | "econ006" | "econ006d", output: string | null, rc: number | null): Result;
export function combineL5(a: Result, b: Result): Result;
export function combineL3(a: L3aResult, b: L3bResult): Result;
export function evaluateL7(output: string | null, rc: number | null, buildRc: number | null): Result;
export function overall(results: Record<"L1" | "L2" | "L3" | "L4a" | "L4b" | "L5" | "L6" | "L7", Result>): "PASS" | "IKKE FULLT BESTÅTT";
export function buildReport(results: Record<"L1" | "L2" | "L3" | "L4a" | "L4b" | "L5" | "L6" | "L7", Result> & { L3a?: Result; L3b?: Result; L5a?: Result; L5b?: Result }, meta?: { preflight?: string[] }): string;
export function evaluateDir(dir: string): { results: Record<"L1" | "L2" | "L3" | "L4a" | "L4b" | "L5" | "L6" | "L7", Result> & { L3a?: Result; L3b?: Result; L5a?: Result; L5b?: Result }; report: string; verdict: "PASS" | "IKKE FULLT BESTÅTT"; suppressed: boolean };
export function l3bFromDir(dir: string): L3bResult;
