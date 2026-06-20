import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // ADR-0007: パスワードリセット(recovery)時は next=/auth/reset-password/update へ。既定は /inbox。
  const nextParam = requestUrl.searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/inbox";

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

  if (user?.email) {
    const metadata = user.user_metadata ?? {};
    const name =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : user.email;

    await supabase.from("staff").upsert(
      {
        auth_id: user.id,
        email: user.email,
        name,
        is_active: true,
      },
      { onConflict: "email" },
    );
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl));
}
