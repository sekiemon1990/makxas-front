/**
 * PR38: アポ後フォロー自動化
 *
 * GET/POST /api/cron/post-appt-followup
 *
 * 査定完了済みアポを検出し、リードへ LINE/メールで「お礼 + 次回案内」を送信する。
 * MAKXAS思想：レバー2継続接点として、「次回 不要品が出たらお気軽に」の声掛けを必ず含める。
 *
 * 動作:
 *   1. status=completed AND followup_sent_at IS NULL のアポを取得
 *   2. リード情報取得 → LINE/メールで送信
 *   3. followup_sent_at をセット（重複送信防止）
 *
 * 日次実行（10:00 JST = 01:00 UTC）想定。
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendMultiChannel } from "@/lib/notifications/multi-channel";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildFollowupMessage(args: {
  customerName: string;
  brandName: string;
  hadAdditional: boolean;
}): string {
  const greeting = args.customerName ? `${args.customerName} 様` : "お客様";
  // レバー2の継続接点。押し売り厳禁・丁寧に。
  const lever2Line = args.hadAdditional
    ? "今回は追加品もご確認いただきありがとうございました。今後ご不要なお品物が出ましたら、いつでもお気軽にご連絡ください。"
    : "今後ご自宅で「これ売れるかな？」というお品物が出ましたら、お気軽にご相談ください。貴金属・時計・ブランド品・骨董品など幅広く査定いたします。";

  return `${greeting}

本日は${args.brandName}の出張買取をご利用いただき、誠にありがとうございました。
査定にご協力いただき、感謝申し上げます。

${lever2Line}

引き続き${args.brandName}をよろしくお願いいたします。`;
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const auth = await requireApiAuth(req, { allowCronSecret: true });
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();

  // 完了済みかつフォロー未送信のアポを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appts, error } = await (supabase as any)
    .from("appointments")
    .select(
      "id, scheduled_at, additional_items_confirmed, lead:lead_id(display_name, phone, email, line_user_id), inquiry:inquiry_id(brands(name))",
    )
    .eq("status", "completed")
    .is("followup_sent_at", null)
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; ok: boolean; channels: number; error?: string }[] = [];

  for (const appt of (appts ?? []) as Array<{
    id: string;
    additional_items_confirmed: Record<string, boolean> | null;
    lead: { display_name?: string; phone?: string; email?: string; line_user_id?: string } | null;
    inquiry: { brands?: { name?: string } | null } | null;
  }>) {
    const lead = appt.lead ?? null;
    const brandName = appt.inquiry?.brands?.name ?? "買取マクサス";
    if (!lead?.line_user_id && !lead?.email) {
      results.push({ id: appt.id, ok: false, channels: 0, error: "no channel" });
      // 連絡先がない場合はスキップして二度と処理しないようマーク
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("appointments")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      continue;
    }

    const hadAdditional = !!(
      appt.additional_items_confirmed &&
      typeof appt.additional_items_confirmed === "object" &&
      Object.values(appt.additional_items_confirmed).some((v) => v === true)
    );

    const message = buildFollowupMessage({
      customerName: lead.display_name ?? "",
      brandName,
      hadAdditional,
    });

    const send = await sendMultiChannel(
      message,
      lead.line_user_id ? ["line"] : ["email"],
      {
        lineUserId: lead.line_user_id ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        emailSubject: `【${brandName}】本日はありがとうございました`,
      },
    );

    const successCount = send.filter((r) => r.ok).length;
    if (successCount > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("appointments")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
    }
    results.push({
      id: appt.id,
      ok: successCount > 0,
      channels: successCount,
      error: send.filter((r) => !r.ok).map((r) => `${r.channel}:${r.error}`).join(", ") || undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
