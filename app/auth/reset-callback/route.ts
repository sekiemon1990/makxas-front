import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// パスワードリセット専用コールバック（ADR-0007・独立レビュー S2-1 対応）。
// recovery の code をセッションへ交換し、**next を一切受けず**確定画面のみへ遷移する。
// これにより「recovery セッションで確定前に /inbox 等の保護ページへ入る」経路を塞ぐ。
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/reset-password?error=missing_code", requestUrl));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/reset-password?error=expired", requestUrl));
  }

  // 確定画面のみへ。他パスへは遷移させない。
  return NextResponse.redirect(new URL("/auth/reset-password/update", requestUrl));
}
