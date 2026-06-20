import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // 直リンク復帰先(ADR-0023・open-redirect ガード済み)
  const next = safeNextPath(requestUrl.searchParams.get("next"));

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

  return NextResponse.redirect(new URL(next, requestUrl));
}
