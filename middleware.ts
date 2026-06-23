import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  canWriteWithRole,
  isApiWriteGuardTarget,
} from "@/lib/auth/apiWritePolicy";
import { safeNextPath } from "@/lib/safe-next";
import type { Database } from "@/types/database";

const PUBLIC_PREFIXES = [
  "/login",
  "/inquiry",
  "/manifest.webmanifest",
  "/appointment", // PR37: 顧客向けアポ照会（トークン認証で別途保護）
  "/survey", // PR42: 顧客向けアンケート（トークン認証で別途保護）
  "/api/public", // PR37: 顧客向け公開API
  "/api/health",
  "/api/support/aggregate", // Bearer token guarded aggregate-only CS read contract
  "/auth/callback",
  "/api/auth/google",
  "/api/auth/password", // ADR-0007: ID・パスワード認証
  "/api/auth/reset", // ADR-0007: パスワード設定/再設定の要求
  "/auth/reset-callback", // ADR-0007: パスワードリセット専用コールバック
  "/auth/reset-password", // ADR-0007: パスワード設定/再設定の画面
  "/api/webhooks",
  "/api/cron",
  // 以下 3 つは middleware の cookie 認証をスキップする代わりに、
  // route.ts 内で requireApiAuth() による CRON_SECRET / staff role 認証を行う。
  // (cron / 内部 fetch では cookie がないため middleware では通せない)
  "/api/ai/learning/run",
  "/api/ai/analyze-edit",
  "/api/ai/extract-items",
  "/phone-preview.html",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  // デモモード（NEXT_PUBLIC_DEMO_MODE=true）の場合は認証チェックを完全にスキップ。
  // Phase 1.5（実運用開始）までの暫定。Vercel の Preview 環境のみ ON にする想定。
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!user && !isPublic) {
    // 直リンク到達性(ADR-0023): 元のパス(+クエリ)を next に保持し、ログイン後に復帰させる
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    isApiWriteGuardTarget({
      pathname,
      method: request.method,
      skipsMiddlewareAuth: isPublic,
    })
  ) {
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("role, is_active")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (staffError || !staff?.is_active || !canWriteWithRole(staff.role)) {
      return NextResponse.json(
        {
          error: "read_only_write_denied",
          message: "読み取り専用アカウントでは変更操作はできません。",
        },
        { status: 403 },
      );
    }
  }

  if (user && pathname === "/login") {
    // ログイン済みで /login に来た場合、next 指定があればその画面へ（open-redirect ガード済み）
    const dest = safeNextPath(request.nextUrl.searchParams.get("next"));
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = dest.split("?")[0];
    redirectUrl.search = dest.includes("?") ? `?${dest.split("?").slice(1).join("?")}` : "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
