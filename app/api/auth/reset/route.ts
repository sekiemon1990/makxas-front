import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// パスワード設定/再設定の要求（ADR-0007）。既存ユーザーの同じ auth.users 行にパスワードを付与する。
// recovery リンクは /auth/callback?next=/auth/reset-password/update で code 交換され、確定画面へ。
// 列挙防止: 存在に関わらず同じ通知を返す。
export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${requestUrl.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password/update")}`,
    });
  }

  return NextResponse.redirect(
    new URL("/login?notice=reset_sent", requestUrl),
    { status: 303 },
  );
}
