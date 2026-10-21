export const MODE: "real" | "emulator";
export function connectBackend(o: { db: unknown; dbUrl: string; users: { id: string; email: string }[]; port: number; pgModulePath: string }): Promise<{
  mode: "real" | "emulator"; url: string; publishableKey: string; log: unknown[] | null; close: () => Promise<void>;
  cleanup: (o: { firmIds: string[]; users: { id: string }[] }) => Promise<void>;
}>;
