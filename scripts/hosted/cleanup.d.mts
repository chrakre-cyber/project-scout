type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
export interface Plan { testUsers: number; testFirms: number; blockedFirms: number; orphanFirms: number; rows: Record<string, number> }
export function planCleanup(client: Q): Promise<{ plan: Plan }>;
export function executeCleanup(client: Q): Promise<{ ok: boolean; before?: Plan; after?: Plan; note?: string; error?: string }>;
