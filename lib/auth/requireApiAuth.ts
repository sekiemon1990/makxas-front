/**
 * API route 用の認証ヘルパー。
 *
 * recording (makxas-ast) の requireApprovedAdmin を Supabase 版に移植。
 * front では Supabase Auth ベース + staff テーブルの role を使う。
 *
 * 使い方:
 *   // ログイン管理者のみ
 *   const auth = await requireApiAuth(req);
 *   if (!auth.ok) return auth.response;
 *
 *   // role 制限
 *   const auth = await requireApiAuth(req, { requiredRole: "admin" });
 *   if (!auth.ok) return auth.response;
 *
 *   // cron / 内部呼出も許可
 *   const auth = await requireApiAuth(req, { allowCronSecret: true });
 *   if (!auth.ok) return auth.response;
 */
import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type StaffRole = "super_admin" | "admin" | "operator" | "viewer";

/** role 階層: super_admin > admin > operator > viewer */
const ROLE_RANK: Record<StaffRole, number> = {
  super_admin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

export type ApiAuthResult =
  | { ok: true; mode: "user"; userId: string; email: string; role: StaffRole }
  | { ok: true; mode: "cron" }
  | { ok: false; response: NextResponse };

/** timing-safe な文字列比較 (CRON_SECRET の side-channel 漏洩防止) */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function meetsRole(actual: StaffRole, required: StaffRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

function readBearerToken(req: NextRequest | Request): string | null {
  const auth =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function requireApiAuth(
  req: NextRequest | Request,
  opts: {
    requiredRole?: StaffRole;
    allowCronSecret?: boolean;
  } = {},
): Promise<ApiAuthResult> {
  // 1) DEMO_MODE は middleware と同様にスルー (開発・preview 限定)
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return {
      ok: true,
      mode: "user",
      userId: "demo",
      email: "demo@example.com",
      role: "super_admin",
    };
  }

  // 2) CRON_SECRET 経路 (opt-in)
  //   - Vercel Cron / 内部 fetch 等で使う
  //   - opt-in にしてあるのは、漏洩時のリスク (CRON_SECRET 1 つで全 API 突破) を
  //     局所化するため。デフォルトでは Supabase Auth ユーザーのみ通す。
  if (opts.allowCronSecret) {
    const cronSecret = process.env.CRON_SECRET;
    const presented = readBearerToken(req);
    if (cronSecret && presented && safeEqual(presented, cronSecret)) {
      return { ok: true, mode: "cron" };
    }
  }

  // 3) Supabase Auth ユーザー検証
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", message: "Login required" },
        { status: 401 },
      ),
    };
  }

  // 4) role 制限が無ければ viewer 相当として通す
  if (!opts.requiredRole) {
    // staff テーブルから role を取得しない高速パス (viewer/role 制限なし用)
    return {
      ok: true,
      mode: "user",
      userId: user.id,
      email: user.email ?? "",
      role: "viewer",
    };
  }

  // 5) role 制限あり: staff テーブルから取得
  const { data: staff } = await supabase
    .from("staff")
    .select("role, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!staff) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: "Staff record not found" },
        { status: 403 },
      ),
    };
  }
  if (!staff.is_active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: "Staff account is disabled" },
        { status: 403 },
      ),
    };
  }
  if (!meetsRole(staff.role, opts.requiredRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "forbidden",
          message: `Role ${opts.requiredRole} or higher required`,
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    mode: "user",
    userId: user.id,
    email: user.email ?? "",
    role: staff.role,
  };
}
