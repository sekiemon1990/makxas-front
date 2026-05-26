import { sendChatworkMessageOrSkip } from "@makxas/chatwork-client";
import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

const UNANSWERED_THRESHOLD_MINUTES = 60;

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CHATWORK_API_TOKEN || !process.env.CHATWORK_ROOM_ID) {
    return NextResponse.json(
      { error: "Chatwork env vars not set" },
      { status: 500 },
    );
  }

  const supabase = createServiceClient();
  const thresholdTime = new Date(
    Date.now() - UNANSWERED_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  // 対応中で最後のメッセージが顧客からで、閾値時間以上返信なしの反響を取得
  const { data: inquiries, error } = await supabase
    .from("inquiries")
    .select(
      "id, subject, channel, created_at, leads(display_name, phone, email), stores(name)",
    )
    .in("status", ["new", "in_progress"])
    .lt("updated_at", thresholdTime);

  if (error) {
    console.error("check-unanswered query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!inquiries || inquiries.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  // 各反響の最後のメッセージが inbound かチェック
  const unanswered: typeof inquiries = [];
  for (const inquiry of inquiries) {
    const { data: lastMessage } = await supabase
      .from("messages")
      .select("direction, created_at")
      .eq("inquiry_id", inquiry.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // メッセージがない（新規）か、最後が inbound なら未返信
    if (!lastMessage || lastMessage.direction === "inbound") {
      unanswered.push(inquiry);
    }
  }

  if (unanswered.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  const lines = unanswered.map((inquiry) => {
    const lead = inquiry.leads as
      | { display_name?: string; phone?: string; email?: string }
      | null
      | undefined;
    const store = inquiry.stores as { name?: string } | null | undefined;
    const customerName =
      lead?.display_name ?? lead?.email ?? lead?.phone ?? "未登録";
    const storeName = store?.name ?? "未設定";
    return `・[${inquiry.channel.toUpperCase()}] ${customerName}（${storeName}）— ${inquiry.subject ?? "件名なし"}`;
  });

  const message = `[info][title]⚠️ 未返信アラート（${unanswered.length}件）[/title]${UNANSWERED_THRESHOLD_MINUTES}分以上返信されていない反響があります。\n\n${lines.join("\n")}\n\nhttps://makxas-front.vercel.app/inbox[/info]`;

  const result = await sendChatworkMessageOrSkip(message);

  if (!result.ok) {
    console.error("Chatwork notify failed", result.error);
    return NextResponse.json(
      { error: "Chatwork failed", detail: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ notified: unanswered.length });
}
