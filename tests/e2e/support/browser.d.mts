export const NOT_RUN_EXIT: number;
export function findChrome(env?: Record<string, string | undefined>, exists?: (p: string) => boolean, list?: (p: string) => string[]): string | null;
export function launchBrowser(): Promise<unknown>;
