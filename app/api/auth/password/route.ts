import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// ID・パスワード認証（ADR-0007 / AI憲法 第21条「認証経路の冗長性」）。
// Google認証(/api/auth/google)と並ぶ第2経路。既存ユーザー（callbackでstaff upsert済み）が
// 同じ auth.users 行のパスワードでログインする。新規signup口は開かない（identity単一）。
// パスワードは /auth/reset-password 導線で既存行に付与する。
export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  // CSRF 緩和（独立レビュー S2-2）: 別オリジンからの強制 POST(login CSRF)を弾く
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== requestUrl.origin) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", requestUrl), { status: 303 });
  }
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // 直リンク復帰先(ADR-0023・open-redirect ガード済み)
  const next = safeNextPath(form.get("next") as string | null);

  if (!email || !password) {
    return NextResponse.redirect(
      new URL("/login?error=missing_credentials", requestUrl),
      { status: 303 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 誤メール/誤パスワードは区別しない（列挙防止）
    return NextResponse.redirect(
      new URL("/login?error=invalid_credentials", requestUrl),
      { status: 303 },
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl), { status: 303 });
}
