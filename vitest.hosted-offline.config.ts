import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** HOST-001 (forberedelse): DB-tester av inspeksjon og opprydding mot en ISOLERT PostgreSQL-klynge (ikke Supabase, ikke hosted). Kjøres av scripts/test-hosted-offline.sh. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/hosted-db/**/*.test.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 120_000, fileParallelism: false },
});
