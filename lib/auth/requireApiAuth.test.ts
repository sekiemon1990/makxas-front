/**
 * requireApiAuth の単体テスト。
 *
 * recording (makxas-ast) の requireApprovedAdmin.test.ts と同方針:
 *   - vi.hoisted() でモックを巻き上げる (vi.mock factory 内参照のため)
 *   - 主要パスを網羅: DEMO_MODE / CRON_SECRET / Supabase user / role
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockGetUser, mockStaffSingle, mockSupabaseFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStaffSingle: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockSupabaseFrom,
  }),
}));

function mockReq(opts: { authorization?: string } = {}): Request {
  const headers = new Headers();
  if (opts.authorization) headers.set("authorization", opts.authorization);
  return new Request("http://localhost/api/test", { method: "POST", headers });
}

function uniqueSecret(suffix: string): string {
  return `test-cron-${Date.now()}-${Math.random().toString(36).slice(2)}-${suffix}`;
}

describe("requireApiAuth: DEMO_MODE bypass", () => {
  const originalDemo = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
  });
  afterEach(() => {
    if (originalDemo === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemo;
  });

  it("DEMO_MODE=true なら token / cookie 無くても super_admin として通す", async () => {
    const { requireApiAuth } = await import("./requireApiAuth");
    const result = await requireApiAuth(mockReq());
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === "user") {
      expect(result.role).toBe("super_admin");
    }
  });
});

describe("requireApiAuth: CRON_SECRET shortcut", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalDemo = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    mockGetUser.mockReset();
    mockSupabaseFrom.mockReset();
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalDemo === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemo;
    vi.restoreAllMocks();
  });

  it("allowCronSecret:true + CRON_SECRET 一致 → mode:cron で通す", async () => {
    const secret = uniqueSecret("ok");
    process.env.CRON_SECRET = secret;
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(
      mockReq({ authorization: `Bearer ${secret}` }),
      { allowCronSecret: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("cron");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("allowCronSecret 未指定なら CRON_SECRET 一致でも通常認証経路に流れる", async () => {
    const secret = uniqueSecret("no-opt");
    process.env.CRON_SECRET = secret;
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(
      mockReq({ authorization: `Bearer ${secret}` }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("不一致トークンは Supabase 経路にフォールスルー (401)", async () => {
    process.env.CRON_SECRET = uniqueSecret("env");
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(
      mockReq({ authorization: `Bearer ${uniqueSecret("req")}` }),
      { allowCronSecret: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("長さの違うトークンでも timing-safe で false (クラッシュしない)", async () => {
    process.env.CRON_SECRET = "secret-of-some-length";
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(
      mockReq({ authorization: "Bearer x" }),
      { allowCronSecret: true },
    );
    expect(result.ok).toBe(false);
  });
});

describe("requireApiAuth: Supabase user + role", () => {
  const originalDemo = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    mockGetUser.mockReset();
    mockStaffSingle.mockReset();
    mockSupabaseFrom.mockReset();
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: mockStaffSingle,
        }),
      }),
    });
  });
  afterEach(() => {
    if (originalDemo === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemo;
    vi.restoreAllMocks();
  });

  it("未ログイン → 401", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("ログイン + role 制限なし → viewer 相当で通す (staff 参照なし)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "test@example.com" } },
      error: null,
    });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq());
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === "user") {
      expect(result.role).toBe("viewer");
      expect(result.email).toBe("test@example.com");
    }
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it("role 制限あり + staff 未登録 → 403", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u2", email: "x@x" } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({ data: null });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq(), { requiredRole: "admin" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("role 制限あり + is_active=false → 403", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u3", email: "x@x" } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: "admin", is_active: false },
    });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq(), { requiredRole: "admin" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("operator < admin → 403", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u4", email: "x@x" } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: "operator", is_active: true },
    });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq(), { requiredRole: "admin" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("admin >= admin → OK", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u5", email: "a@a" } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: "admin", is_active: true },
    });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq(), { requiredRole: "admin" });
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === "user") expect(result.role).toBe("admin");
  });

  it("super_admin > admin → OK", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u6", email: "sa@sa" } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: "super_admin", is_active: true },
    });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq(), { requiredRole: "admin" });
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === "user") expect(result.role).toBe("super_admin");
  });

  it("viewer < operator → 403", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u7", email: "v@v" } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: "viewer", is_active: true },
    });
    const { requireApiAuth } = await import("./requireApiAuth");

    const result = await requireApiAuth(mockReq(), { requiredRole: "operator" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});
