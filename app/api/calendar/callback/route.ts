import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`,
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const staffId = searchParams.get("state"); // staff_id を state に埋め込んだ
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !staffId) {
    return NextResponse.redirect(new URL(`/settings?calendar_error=${error ?? "missing_code"}`, appUrl));
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/settings?calendar_error=no_refresh_token", appUrl));
    }

    // Googleアカウントのメールアドレスを取得
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const googleEmail = userInfo.email ?? "";

    const service = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).from("google_calendar_connections").upsert({
      staff_id: staffId,
      google_account_email: googleEmail,
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      calendar_id: "primary",
      sync_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "staff_id" });

    return NextResponse.redirect(new URL("/settings?calendar_connected=1", appUrl));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/settings?calendar_error=${encodeURIComponent(msg)}`, appUrl));
  }
}
