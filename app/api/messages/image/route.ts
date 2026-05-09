import * as line from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const inquiryId = formData.get("inquiry_id") as string | null;
  const files = formData.getAll("images") as File[];

  if (!inquiryId || files.length === 0) {
    return NextResponse.json(
      { error: "inquiry_id and at least one image are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // 送信者のスタッフIDを取得
  let sentByStaffId: string | null = null;
  try {
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();
      sentByStaffId = staffRow?.id ?? null;
    }
  } catch {
    // 取得失敗時はnullのまま続行
  }

  // 反響情報を取得
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, leads(line_user_id), line_accounts(channel_access_token)")
    .eq("id", inquiryId)
    .maybeSingle();

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const lineUserId = (
    inquiry.leads as { line_user_id: string | null } | null
  )?.line_user_id;

  const lineAccount = inquiry.line_accounts as {
    channel_access_token: string | null;
  } | null;
  const channelAccessToken =
    lineAccount?.channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const savedMessages: { id: string; media_urls: string[] }[] = [];

  for (const file of files) {
    // Supabase Storage にアップロード
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `inquiry-images/${inquiryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("messages")
      .upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("messages").getPublicUrl(storagePath);

    // DBにメッセージ保存
    const { data: message, error: dbError } = await supabase
      .from("messages")
      .insert({
        inquiry_id: inquiryId,
        direction: "outbound",
        body: `[画像] ${file.name}`,
        media_urls: [publicUrl],
        sent_by: sentByStaffId,
      })
      .select("id, media_urls")
      .single();

    if (dbError) {
      console.error("DB insert failed:", dbError);
      continue;
    }

    savedMessages.push({ id: message.id, media_urls: message.media_urls ?? [] });

    // LINE送信
    if (inquiry.channel === "line" && lineUserId && channelAccessToken) {
      try {
        const client = new line.messagingApi.MessagingApiClient({
          channelAccessToken,
        });
        await client.pushMessage({
          to: lineUserId,
          messages: [
            {
              type: "image",
              originalContentUrl: publicUrl,
              previewImageUrl: publicUrl,
            },
          ],
        });
      } catch (lineError) {
        console.error("LINE image push failed:", lineError);
      }
    }
  }

  // updated_at を更新
  await supabase
    .from("inquiries")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  return NextResponse.json({ messages: savedMessages });
}
