export const KNOWN_NEVER_APPLIED_HOSTED: readonly string[];
export const DATA002D_VERSION: string;
export interface RepoMigration { version: string; name: string; sha256: string }
export function repoMigrationList(dir?: string): RepoMigration[];
export function repoHash(list: RepoMigration[]): string;
export interface Classification { kind: "empty" | "prefix" | "current" | "diverged"; appliedCount: number; repoCount: number; unknownApplied: string[]; pending: string[]; reason?: string }
export function classifyMigrations(applied: string[], repoList: RepoMigration[]): Classification;
export function includesDataMigration(c: Classification): boolean;
