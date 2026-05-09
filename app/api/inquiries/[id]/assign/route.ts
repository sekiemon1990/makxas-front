import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { InquiryWithLead } from "@/types/database";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    assigned_to?: string | null;
  } | null;

  if (!body || typeof body.assigned_to === "undefined") {
    return NextResponse.json({ error: "assigned_to is required" }, { status: 400 });
  }

  const assignedTo =
    body.assigned_to && body.assigned_to !== "unassigned"
      ? body.assigned_to
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("inquiries")
    .update({ assigned_to: assignedTo })
    .eq("id", id)
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 担当者が設定された場合は Chatwork 通知
  if (assignedTo) {
    const chatworkToken = process.env.CHATWORK_API_TOKEN;
    const chatworkRoomId = process.env.CHATWORK_ROOM_ID;

    if (chatworkToken && chatworkRoomId) {
      const serviceClient = createServiceClient();
      const { data: assignedStaff } = await serviceClient
        .from("staff")
        .select("name")
        .eq("id", assignedTo)
        .maybeSingle();

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://makxas-front.vercel.app";
      const inquiry = data as unknown as InquiryWithLead;
      const subject = inquiry.subject ?? "件名なし";
      const message = `【担当者アサイン通知】\n@${assignedStaff?.name ?? "スタッフ"} さんが「${subject}」の担当者に設定されました。\n確認: ${appUrl}/inbox?id=${id}`;

      await fetch(
        `https://api.chatwork.com/v2/rooms/${chatworkRoomId}/messages`,
        {
          method: "POST",
          headers: {
            "X-ChatWorkToken": chatworkToken,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ body: message }),
        },
      ).catch(() => {});
    }
  }

  return NextResponse.json({ inquiry: data as unknown as InquiryWithLead });
}
