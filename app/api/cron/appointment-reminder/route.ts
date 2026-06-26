import * as line from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 明日（JST）の00:00〜23:59を UTC に変換
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const tomorrowJST = new Date(nowJST);
  tomorrowJST.setUTCDate(tomorrowJST.getUTCDate() + 1);
  const startUTC = new Date(
    Date.UTC(tomorrowJST.getUTCFullYear(), tomorrowJST.getUTCMonth(), tomorrowJST.getUTCDate(), -9, 0, 0),
  );
  const endUTC = new Date(
    Date.UTC(tomorrowJST.getUTCFullYear(), tomorrowJST.getUTCMonth(), tomorrowJST.getUTCDate(), 14, 59, 59),
  );

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, leads(*), inquiries(channel, line_accounts(channel_access_token))")
    .gte("scheduled_at", startUTC.toISOString())
    .lte("scheduled_at", endUTC.toISOString())
    .eq("status", "confirmed")
    .is("reminder_sent_at", null);

  if (error) {
    console.error("appointment-reminder: fetch error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const appt of appointments ?? []) {
    const lead = appt.leads as { display_name?: string | null; line_user_id?: string | null; phone?: string | null; email?: string | null } | null;
    const inquiry = appt.inquiries as { channel?: string | null; line_accounts?: { channel_access_token?: string | null } | null } | null;

    const scheduledDate = new Date(appt.scheduled_at);
    const dateStr = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      timeZone: "Asia/Tokyo",
    }).format(scheduledDate);
    const methodLabel = appt.preferred_method === "delivery" ? "宅配査定" : "訪問査定";
    const reminderMsg = `【査定前日のご確認】\n\n明日の査定のご確認です。\n\n▼査定日時\n${dateStr}\n\n▼方法\n${methodLabel}\n\nご不明な点がございましたらお気軽にご連絡ください。どうぞよろしくお願いいたします。`;

    let channelSent = false;

    // LINE 送信
    if (inquiry?.channel === "line" && lead?.line_user_id) {
      const token = inquiry.line_accounts?.channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (token) {
        try {
          const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: token });
          await client.pushMessage({ to: lead.line_user_id, messages: [{ type: "text", text: reminderMsg }] });
          channelSent = true;
        } catch (e) {
          console.error("appointment-reminder: LINE send failed", e);
        }
      }
    }

    // SMS 送信（Twilio）
    if (!channelSent && lead?.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const body = new URLSearchParams({
          From: process.env.TWILIO_FROM_NUMBER,
          To: lead.phone,
          Body: reminderMsg,
        });
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
        if (resp.ok) channelSent = true;
        else console.error("appointment-reminder: Twilio error", await resp.text());
      } catch (e) {
        console.error("appointment-reminder: SMS send failed", e);
      }
    }

    // メール送信（Gateway 経由）
    if (!channelSent && lead?.email && process.env.GATEWAY_BASE_URL) {
      try {
        const gatewayToken = process.env.GATEWAY_SHARED_TOKEN ?? '';
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@makxas.com";
        const resp = await fetch(`${process.env.GATEWAY_BASE_URL}/v1/email/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gatewayToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: lead.email,
            subject: "【査定前日のご確認】明日の査定について",
            text: reminderMsg,
          }),
        });
        if (resp.ok) channelSent = true;
        else console.error("appointment-reminder: Gateway email error", await resp.text());
      } catch (e) {
        console.error("appointment-reminder: Email send failed", e);
      }
    }

    if (channelSent) {
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
