import { messagingApi, validateSignature } from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import type { Inquiry, Lead } from "@/types/database";

export const runtime = "nodejs";

type LineEvent = {
  type: string;
  source?: {
    userId?: string;
  };
  message?: {
    id?: string;
    type: string;
    text?: string;
  };
};

type LineCallback = {
  events?: LineEvent[];
};

const activeStatuses = [
  "new",
  "in_progress",
  "pending",
  "appointment_set",
  "transferred",
] as const;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";

  if (
    !channelSecret ||
    !signature ||
    !validateSignature(rawBody, channelSecret, signature)
  ) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const payload = JSON.parse(rawBody) as LineCallback;
  const supabase = createServiceClient();
  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  });

  await Promise.all(
    (payload.events ?? []).map(async (event) => {
      const lineUserId = event.source?.userId;
      if (!lineUserId) return;

      if (event.type === "follow") {
        const lead = await upsertLineLead(supabase, lineClient, lineUserId);
        if (!lead) return;

        await supabase.from("inquiries").insert({
          lead_id: lead.id,
          channel: "line",
          status: "new",
          subject: "LINE友だち追加",
        });
        return;
      }

      if (event.type === "message") {
        const lead = await upsertLineLead(supabase, lineClient, lineUserId);
        if (!lead) return;

        const inquiry = await findOrCreateLineInquiry(supabase, lead);
        if (!inquiry) return;

        const body =
          event.message?.type === "text"
            ? event.message.text ?? ""
            : `[${event.message?.type ?? "unknown"}メッセージ]`;

        await supabase.from("messages").insert({
          inquiry_id: inquiry.id,
          direction: "inbound",
          body,
          line_msg_id: event.message?.id ?? null,
        });

        await supabase
          .from("inquiries")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", inquiry.id);
      }
    }),
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function upsertLineLead(
  supabase: ReturnType<typeof createServiceClient>,
  lineClient: messagingApi.MessagingApiClient,
  lineUserId: string,
) {
  const profile = await lineClient.getProfile(lineUserId).catch(() => null);

  const { data, error } = await supabase
    .from("leads")
    .upsert(
      {
        line_user_id: lineUserId,
        display_name: profile?.displayName ?? "LINEユーザー",
        first_channel: "line",
      },
      { onConflict: "line_user_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("LINE lead upsert failed", error);
    return null;
  }

  return data as Lead;
}

async function findOrCreateLineInquiry(
  supabase: ReturnType<typeof createServiceClient>,
  lead: Lead,
) {
  const { data: existing } = await supabase
    .from("inquiries")
    .select("*")
    .eq("lead_id", lead.id)
    .eq("channel", "line")
    .in("status", activeStatuses)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as Inquiry;

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      lead_id: lead.id,
      channel: "line",
      status: "new",
      subject: "LINEメッセージ",
    })
    .select("*")
    .single();

  if (error) {
    console.error("LINE inquiry create failed", error);
    return null;
  }

  return data as Inquiry;
}
