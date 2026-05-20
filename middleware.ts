import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

const PUBLIC_PREFIXES = [
  "/login",
  "/inquiry",
  "/appointment", // PR37: 顧客向けアポ照会（トークン認証で別途保護）
  "/api/public", // PR37: 顧客向け公開API
  "/auth/callback",
  "/api/auth/google",
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
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/inbox";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
