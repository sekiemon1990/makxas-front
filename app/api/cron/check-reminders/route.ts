import { NextResponse, type NextRequest } from "next/server";

import { hasChatworkGatewayEnv, notifyChatwork } from "@/lib/chatwork";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasChatworkGatewayEnv()) {
    return NextResponse.json({ error: "Gateway comms env vars not set" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id, inquiry_id, note, remind_at, staff(name), inquiries(subject)")
    .eq("is_done", false)
    .lte("remind_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://makxas-front.vercel.app";

  for (const reminder of reminders) {
    const staffName = (reminder.staff as { name?: string } | null)?.name ?? "スタッフ";
    const subject = (reminder.inquiries as { subject?: string | null } | null)?.subject ?? "件名なし";
    const noteText = reminder.note ? `\nメモ: ${reminder.note}` : "";
    const message = `【フォローアップリマインダー】\n@${staffName} さん、以下の反響のフォローアップ時間です。\n\n反響: ${subject}${noteText}\n確認: ${appUrl}/inbox?id=${reminder.inquiry_id}`;

    await notifyChatwork(message);
  }

  // 通知済みフラグを立てる
  const ids = reminders.map((r) => r.id);
  await supabase.from("reminders").update({ is_done: true }).in("id", ids);

  return NextResponse.json({ notified: reminders.length });
}
