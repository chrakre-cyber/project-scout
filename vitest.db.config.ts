import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integrasjonstester mot LOKAL Supabase (`npm run test:db`). Se tests/db/README.md. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/db/**/*.test.ts"], environment: "node", testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
});
