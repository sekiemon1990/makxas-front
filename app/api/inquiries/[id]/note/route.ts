import { NextResponse, type NextRequest } from "next/server";

import { notifyChatwork } from "@/lib/chatwork";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    internal_note?: string;
    mentioned_staff_ids?: string[];
    inquiry_subject?: string;
  } | null;

  if (body === null) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("inquiries")
    .update({ internal_note: body.internal_note ?? null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // @メンションされたスタッフへ Chatwork 通知
  if (body.mentioned_staff_ids && body.mentioned_staff_ids.length > 0) {
    const { data: mentionedStaff } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", body.mentioned_staff_ids);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://makxas-front.vercel.app";
    const names = (mentionedStaff ?? []).map((s) => `@${s.name}`).join(", ");
    const subject = body.inquiry_subject ?? "件名なし";
    const message = `【メンション通知】\n${names} さんへの内部メモのメンションがあります。\n\n反響: ${subject}\n確認: ${appUrl}/inbox?id=${id}`;

    await notifyChatwork(message);
  }

  return NextResponse.json({ ok: true });
}
