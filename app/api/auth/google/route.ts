import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const origin = new URL(request.url).origin;

  // 直リンク復帰先(ADR-0023)を callback に引き継ぐ（open-redirect ガード済み）
  const form = await request.formData();
  const next = safeNextPath(form.get("next") as string | null);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  return NextResponse.redirect(data.url, { status: 303 });
}
