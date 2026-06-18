import { NextResponse } from "next/server";

import { isLoginAllowed } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", requestUrl));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=callback", requestUrl));
  }

  // 認証ゲート: 許可ドメイン or 許可リストに無いメールはログインさせない。
  const allowed = await isLoginAllowed(user.email);
  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unauthorized", requestUrl));
  }

  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : user.email;

  // 新規スタッフのみ作成する。既存行は更新しない
  // （管理者が is_active=false で無効化した人を再ログインで復活させないため）。
  await supabase.from("staff").upsert(
    {
      auth_id: user.id,
      email: user.email,
      name,
      is_active: true,
    },
    { onConflict: "email", ignoreDuplicates: true },
  );

  return NextResponse.redirect(new URL("/inbox", requestUrl));
}
