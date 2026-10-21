import type { createLauncher } from "./launch.mjs";
export const WEIRD_ARGS: string[];
export function runSelfTest(o?: { launcher?: ReturnType<typeof createLauncher>; platform?: string; root?: string; tmp?: string }): Promise<{ info: string[]; items: { name: string; status: "PASS" | "FAIL"; note: string }[]; ok: boolean }>;
