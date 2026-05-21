/**
 * PR46: Playwright 自動回帰テスト設定
 *
 * 本番デプロイ後の主要ユーザーフロー smoke test を実行。
 * - CI で `npm run test:e2e` 実行想定
 * - PLAYWRIGHT_BASE_URL でテスト先を切替（既定: 本番URL）
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://makxas-front.vercel.app",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
