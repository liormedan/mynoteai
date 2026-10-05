import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Security rules tests. They need the Firestore emulator: run `pnpm test:rules`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["firebase/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
