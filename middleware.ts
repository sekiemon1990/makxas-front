import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

const PUBLIC_PREFIXES = [
  "/login",
  "/inquiry",
  "/auth/callback",
  "/api/auth/google",
  "/api/webhooks",
  "/api/cron",
  "/api/ai/learning/run",
  "/api/ai/analyze-edit",
  "/api/ai/extract-items",
  "/phone-preview.html",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

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

  // 認証ゲート: ログイン済みでも「有効な staff」でなければアクセスさせない。
  // 許可ドメイン外/許可リスト外のメールは callback で staff 化されないため、
  // ここで弾かれる。無効化(is_active=false)された staff も同様。
  if (user && (!isPublic || pathname === "/login")) {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("is_active")
      .eq("auth_id", user.id)
      .maybeSingle();

    const isActiveStaff = staffRow?.is_active === true;

    if (!isActiveStaff) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "?error=unauthorized";
      const res = NextResponse.redirect(redirectUrl);
      // signOut が response に書いた Cookie 削除をリダイレクトへ引き継ぐ。
      response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    if (pathname === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/inbox";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
