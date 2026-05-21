/**
 * PR46: スモークテスト
 *
 * 認証なしでアクセス可能な公開ページ + リダイレクトの基本動作を検証。
 */
import { test, expect } from "@playwright/test";

test.describe("Public pages smoke test", () => {
  test("public inquiry form renders", async ({ page }) => {
    await page.goto("/inquiry");
    await expect(page.locator("body")).toContainText(/お問い合わせ|査定|フォーム/);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toContainText(/ログイン|Sign in/i);
  });

  test("dashboard requires auth (redirects)", async ({ page }) => {
    const response = await page.goto("/dashboard");
    // ログイン未済 → /login へリダイレクト
    expect(page.url()).toContain("/login");
    expect(response).toBeTruthy();
  });

  test("manifest.webmanifest is valid", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");
    expect(response?.status()).toBe(200);
    const manifest = await response?.json();
    expect(manifest?.name).toBeTruthy();
    expect(manifest?.start_url).toBeTruthy();
    expect(Array.isArray(manifest?.icons)).toBe(true);
  });

  test("appointment view returns 404 for invalid token", async ({ page }) => {
    const response = await page.goto("/appointment/not-a-uuid");
    expect(response?.status()).toBe(404);
  });

  test("survey returns 404 for invalid token", async ({ page }) => {
    const response = await page.goto("/survey/not-a-uuid");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Public API smoke test", () => {
  test("public survey API returns 404 for invalid token", async ({ request }) => {
    const response = await request.get("/api/public/survey/not-a-uuid");
    expect(response.status()).toBe(404);
  });

  test("core webhook requires auth", async ({ request }) => {
    const response = await request.post("/api/webhooks/core/result", {
      data: { core_appointment_id: "x", result: "won" },
    });
    // 認証なしなので 401 または 500 (env なし)
    expect([401, 500]).toContain(response.status());
  });
});
