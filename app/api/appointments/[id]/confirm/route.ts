/**
 * アポ確認メッセージ送信 API (PR18)
 *
 * POST /api/appointments/:id/confirm
 * Body: { channels: ("line"|"email"|"sms")[], message?: string }
 *
 * - 指定チャネルに並列送信
 * - LINE / Email 送信は messages テーブルに inquiry_id 紐付きで記録
 * - SMS は messages テーブル外で記録（call_sessions と同じ扱いで将来分離も可）
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildAppointmentConfirmation,
  sendMultiChannel,
  type NotificationChannel,
} from "@/lib/notifications/multi-channel";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    channels?: NotificationChannel[];
    message?: string;
  } | null;

  if (!body || !Array.isArray(body.channels) || body.channels.length === 0) {
    return NextResponse.json(
      { error: "channels (array) is required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // アポ + リード + 反響 + ブランド + LINEアカウント を取得
  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, item_category, address, preferred_method, inquiry_id, lead_id, leads(id, display_name, phone, email, line_user_id), inquiries(id, channel, line_account_id, line_accounts(channel_access_token), brands(name))",
    )
    .eq("id", id)
    .single();

  if (apptErr || !appt) {
    return NextResponse.json(
      { error: apptErr?.message ?? "appointment not found" },
      { status: 404 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = appt as any;
  const lead = a.leads as {
    display_name: string | null;
    phone: string | null;
    email: string | null;
    line_user_id: string | null;
  } | null;
  const brand = a.inquiries?.brands as { name: string | null } | null;
  const lineAccessToken =
    (a.inquiries?.line_accounts?.channel_access_token as string | null) ??
    null;

  const message =
    body.message?.trim() ||
    buildAppointmentConfirmation({
      customerName: lead?.display_name,
      brandName: brand?.name,
      scheduledAt: a.scheduled_at,
      itemCategory: a.item_category,
      address: a.address,
      preferredMethod: a.preferred_method,
    });

  const results = await sendMultiChannel(message, body.channels, {
    lineUserId: lead?.line_user_id ?? null,
    lineChannelAccessToken: lineAccessToken,
    email: lead?.email ?? null,
    phone: lead?.phone ?? null,
    emailFrom: brand?.name
      ? `${brand.name} <noreply@makxas.com>`
      : undefined,
    emailSubject: "ご予約のご確認",
  });

  // 送信成功したものは messages テーブルに記録（チャネル別）
  const inquiryId = a.inquiry_id as string | null;
  if (inquiryId) {
    const successMessages = results
      .filter((r) => r.ok)
      .map((r) => ({
        inquiry_id: inquiryId,
        direction: "outbound",
        msg_type: r.channel === "sms" ? "sms" : r.channel === "email" ? "email" : "text",
        body: message,
        is_auto: true,
      }));
    if (successMessages.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("messages").insert(successMessages);
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({
    ok: allOk,
    results,
    sentMessage: message,
  });
}
