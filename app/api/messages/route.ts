import * as line from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
    body?: string;
    subject?: string;
  } | null;

  if (!body?.inquiry_id || !body.body?.trim()) {
    return NextResponse.json(
      { error: "inquiry_id and body are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // 送信者のスタッフIDを取得
  let sentByStaffId: string | null = null;
  try {
    const authClient = await createServerClient();
    const { data: { user } } = await authClient.auth.getUser();
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

  // 反響とリード情報を取得
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, leads(line_user_id, email, display_name), line_accounts(channel_access_token)")
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
      sent_by: sentByStaffId,
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
      ai_suggested_reply: null,
    })
    .eq("id", body.inquiry_id);

  // LINEチャンネルの場合はpush送信
  const lineUserId = (
    inquiry.leads as { line_user_id: string | null } | null
  )?.line_user_id;
  if (inquiry.channel === "line" && lineUserId) {
    const lineAccount = inquiry.line_accounts as {
      channel_access_token: string | null;
    } | null;
    const channelAccessToken =
      lineAccount?.channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      return NextResponse.json({ message });
    }

    try {
      const client = new line.messagingApi.MessagingApiClient({
        channelAccessToken,
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

  // メールチャンネルの場合はResendで送信
  const isEmailChannel = ["email", "web_form", "hikakaku", "uridoki", "oikura"].includes(
    inquiry.channel ?? "",
  );
  if (isEmailChannel) {
    const leadEmail = (
      inquiry.leads as { email: string | null } | null
    )?.email;

    if (leadEmail && process.env.RESEND_API_KEY) {
      try {
        // 返信用メールアカウントを取得（brand_id or store_id でマッチ、purpose=reply）
        const { data: replyAccount } = await supabase
          .from("email_accounts")
          .select("id, email, display_name")
          .eq("purpose", "reply")
          .eq("is_active", true)
          .or(
            [
              inquiry.brand_id ? `brand_id.eq.${inquiry.brand_id}` : null,
              inquiry.store_id ? `store_id.eq.${inquiry.store_id}` : null,
            ]
              .filter(Boolean)
              .join(",") || "is_active.eq.true",
          )
          .limit(1)
          .maybeSingle();

        const fromEmail = replyAccount?.email ?? process.env.RESEND_FROM_EMAIL ?? "noreply@makxas.com";
        const fromName = replyAccount?.display_name ?? "買取マクサス";
        const emailSubject = body.subject?.trim() || inquiry.subject || "お問い合わせへのご返信";

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data: resendData, error: resendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [leadEmail],
          subject: emailSubject,
          text: body.body.trim(),
        });

        if (resendError) {
          console.error("Resend email failed:", resendError);
        } else if (resendData?.id) {
          // email_msg_id を更新
          await supabase
            .from("messages")
            .update({ email_msg_id: resendData.id })
            .eq("id", message.id);
          message.email_msg_id = resendData.id;
        }
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    }
  }

  return NextResponse.json({ message });
}
