import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Vitest 設定。
 *
 * recording (makxas-ast) と同じ設定方針:
 *   - environment: node (API route は Next.js Node runtime)
 *   - include: src 配下の *.test.ts / *.test.tsx (front では lib / app 配下)
 *   - coverage は lib/** のみを対象
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
    ],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**"],
    },
  },
});
