/**
 * Gmail OAuth コールバックエンドポイント
 * Google から返ってきた code を token に交換し、
 * email_accounts.oauth_tokens に保存する。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeAndSave } from "@/lib/email/gmail";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const emailAccountId = searchParams.get("state"); // connect 時に state に埋め込んだ
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !emailAccountId) {
    return NextResponse.redirect(
      new URL(`/settings?gmail_error=${encodeURIComponent(error ?? "missing_code")}`, appUrl),
    );
  }

  try {
    await exchangeCodeAndSave(code, emailAccountId);
    return NextResponse.redirect(new URL("/settings?gmail_connected=1", appUrl));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/settings?gmail_error=${encodeURIComponent(msg)}`, appUrl),
    );
  }
}
