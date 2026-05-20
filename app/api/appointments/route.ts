import { NextResponse, type NextRequest } from "next/server";

import { syncAppointmentToCore } from "@/lib/core/sync";
import { createClient } from "@/lib/supabase/server";
import {
  buildAppointmentConfirmation,
  sendMultiChannel,
  type NotificationChannel,
} from "@/lib/notifications/multi-channel";
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
    /** PR18: アポ確認メッセージ送信チャネル。省略時は元の "line" のみ（後方互換） */
    confirmation_channels?: NotificationChannel[];
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
      "*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag), line_accounts(channel_access_token), brands(name)",
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

  // PR18: アポ確認メッセージ送信（マルチチャネル）
  // confirmation_channels が指定された場合のみ送信。後方互換で省略時は元LINEチャンネルのみ自動送信
  const channels: NotificationChannel[] =
    body.confirmation_channels && body.confirmation_channels.length > 0
      ? body.confirmation_channels
      : inquiryWithLead.channel === "line"
      ? ["line"]
      : [];

  const sendResults: Awaited<ReturnType<typeof sendMultiChannel>> = [];
  if (channels.length > 0) {
    const lead = inquiryWithLead.leads as {
      display_name: string | null;
      line_user_id: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    const lineAccount = (
      inquiry as unknown as {
        line_accounts?: { channel_access_token?: string | null } | null;
      }
    ).line_accounts;
    const brand = (
      inquiry as unknown as { brands?: { name?: string | null } | null }
    ).brands;
    const confirmMsg = buildAppointmentConfirmation({
      customerName: lead?.display_name,
      brandName: brand?.name,
      scheduledAt: body.scheduled_at,
      itemCategory: body.item_category,
      address: body.address,
      preferredMethod: body.preferred_method,
    });

    const results = await sendMultiChannel(confirmMsg, channels, {
      lineUserId: lead?.line_user_id ?? null,
      lineChannelAccessToken: lineAccount?.channel_access_token ?? null,
      email: lead?.email ?? null,
      phone: lead?.phone ?? null,
      emailFrom: brand?.name ? `${brand.name} <noreply@makxas.com>` : undefined,
      emailSubject: "ご予約のご確認",
    });
    sendResults.push(...results);
    // 失敗時のログ
    for (const r of results) {
      if (!r.ok) {
        console.error(`Confirmation send failed (${r.channel}):`, r.error, r.detail);
      }
    }
  }

  return NextResponse.json({
    appointment: appointment as Appointment,
    inquiry: updatedInquiry as unknown as InquiryWithLead,
    confirmationResults: sendResults,
  });
}
