/**
 * Gmail OAuth 接続開始エンドポイント
 * クエリパラメータ: email_account_id（email_accounts テーブルの ID）
 * Google の認可画面にリダイレクトする。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateGmailAuthUrl } from "@/lib/email/gmail";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const emailAccountId = searchParams.get("email_account_id");
  if (!emailAccountId) {
    return NextResponse.json({ error: "email_account_id required" }, { status: 400 });
  }

  if (!process.env.GOOGLE_EMAIL_CLIENT_ID || !process.env.GOOGLE_EMAIL_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "GOOGLE_EMAIL_CLIENT_ID / GOOGLE_EMAIL_CLIENT_SECRET が未設定です" },
      { status: 503 },
    );
  }

  const authUrl = generateGmailAuthUrl(emailAccountId);
  return NextResponse.redirect(authUrl);
}
