import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// API-level tests: real sign-ins against a running Supabase stack
// (`npx supabase start`). Kept apart from `npm test`, which needs nothing.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
