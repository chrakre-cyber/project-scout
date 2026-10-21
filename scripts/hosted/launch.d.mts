export class LaunchError extends Error { category: string }
export const NODE_TOOLS: readonly string[];
interface Fs { readFileSync: (p: string, enc: "utf8") => string; existsSync: (p: string) => boolean }
interface PathMod { join: (...p: string[]) => string; resolve: (...p: string[]) => string; extname: (p: string) => string; normalize: (p: string) => string }
export function nodeToolEntry(pkg: string, o: { root: string; fs: Fs; pathMod: PathMod }): string;
export function findBash(o: { platform: string; env: Record<string, string | undefined>; fs: Fs; pathMod: PathMod }): string;
export interface RunResult { code: number; out: string; launchError?: string }
export function createLauncher(o?: { platform?: string; root?: string; env?: Record<string, string | undefined>; execPath?: string; fs?: Fs; pathMod?: PathMod; spawnImpl?: (file: string, args: string[], opts: Record<string, unknown>) => unknown }): {
  resolve: (tool: string, args: string[]) => { file: string; args: string[] };
  run: (tool: string, args: string[], extraEnv?: Record<string, string>) => Promise<RunResult>;
  runFile: (file: string, args: string[], extraEnv?: Record<string, string>) => Promise<RunResult>;
};
export function isMainModule(metaUrl: string, argv1: string | undefined, toUrl?: (p: string) => { href: string }): boolean;
