import * as line from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
    body?: string;
  } | null;

  if (!body?.inquiry_id || !body.body?.trim()) {
    return NextResponse.json(
      { error: "inquiry_id and body are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // 反響とリード情報を取得
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, leads(line_user_id)")
    .eq("id", body.inquiry_id)
    .maybeSingle();

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  // DBにメッセージ保存
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      inquiry_id: body.inquiry_id,
      direction: "outbound",
      body: body.body.trim(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // first_response_at を更新
  await supabase
    .from("inquiries")
    .update({
      updated_at: now,
      first_response_at: inquiry.first_response_at ?? now,
    })
    .eq("id", body.inquiry_id);

  // LINEチャンネルの場合はpush送信
  const lineUserId = (inquiry.leads as { line_user_id: string | null } | null)?.line_user_id;
  if (inquiry.channel === "line" && lineUserId) {
    try {
      const client = new line.messagingApi.MessagingApiClient({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
      });
      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: "text", text: body.body.trim() }],
      });
    } catch (lineError) {
      // LINE送信失敗してもDB保存は成功として返す（ログのみ）
      console.error("LINE push failed:", lineError);
    }
  }

  return NextResponse.json({ message });
}
