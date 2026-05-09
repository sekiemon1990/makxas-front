import * as line from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { syncAppointmentToCore } from "@/lib/core/sync";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, InquiryWithLead } from "@/types/database";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
    scheduled_at?: string;
    item_category?: string;
    item_description?: string;
    address?: string;
    preferred_method?: "visit" | "delivery";
    staff_id?: string | null;
  } | null;

  if (!body?.inquiry_id || !body.scheduled_at) {
    return NextResponse.json(
      { error: "inquiry_id and scheduled_at are required" },
      { status: 400 },
    );
  }

  if (
    body.preferred_method &&
    !["visit", "delivery"].includes(body.preferred_method)
  ) {
    return NextResponse.json(
      { error: "preferred_method must be visit or delivery" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: inquiry, error: inquiryError } = await supabase
    .from("inquiries")
    .select(
      "*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag), line_accounts(channel_access_token)",
    )
    .eq("id", body.inquiry_id)
    .single();

  const inquiryWithLead = inquiry as unknown as InquiryWithLead | null;

  if (inquiryError || !inquiryWithLead?.lead_id) {
    return NextResponse.json(
      { error: inquiryError?.message ?? "Inquiry or lead not found" },
      { status: 404 },
    );
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      inquiry_id: inquiryWithLead.id,
      lead_id: inquiryWithLead.lead_id,
      scheduled_at: body.scheduled_at,
      item_category: body.item_category ?? null,
      item_description: body.item_description ?? null,
      address: body.address ?? null,
      preferred_method: body.preferred_method ?? "visit",
      staff_id: body.staff_id ?? staff?.id ?? null,
    })
    .select("*")
    .single();

  if (appointmentError || !appointment) {
    return NextResponse.json(
      { error: appointmentError?.message ?? "Failed to create appointment" },
      { status: 500 },
    );
  }

  const { data: updatedInquiry } = await supabase
    .from("inquiries")
    .update({ status: "appointment_set" })
    .eq("id", inquiryWithLead.id)
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .single();

  await syncAppointmentToCore({
    appointment: appointment as Appointment,
    inquiry: (updatedInquiry as unknown as InquiryWithLead | null) ?? inquiryWithLead,
  });

  // LINE チャンネルの場合はアポ確認メッセージを自動送信
  if (inquiryWithLead.channel === "line") {
    const lineUserId = (
      inquiryWithLead.leads as { line_user_id: string | null } | null
    )?.line_user_id;
    const lineAccount = (inquiry as unknown as { line_accounts?: { channel_access_token?: string | null } | null }).line_accounts;
    const channelAccessToken =
      lineAccount?.channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (lineUserId && channelAccessToken) {
      const scheduledDate = new Date(body.scheduled_at);
      const dateStr = new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
      }).format(scheduledDate);
      const methodLabel =
        body.preferred_method === "delivery" ? "宅配査定" : "訪問査定";
      const confirmMsg = `【査定予約確定のご連絡】\n\n査定のご予約を承りました。\n\n▼査定日時\n${dateStr}\n\n▼方法\n${methodLabel}\n\n当日はよろしくお願いいたします。ご不明な点がございましたらお気軽にご連絡ください。`;

      try {
        const client = new line.messagingApi.MessagingApiClient({
          channelAccessToken,
        });
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: "text", text: confirmMsg }],
        });
      } catch (lineError) {
        console.error("LINE appointment confirmation failed:", lineError);
      }
    }
  }

  return NextResponse.json({
    appointment: appointment as Appointment,
    inquiry: updatedInquiry as unknown as InquiryWithLead,
  });
}
