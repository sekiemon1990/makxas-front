/**
 * PR42: CSAT アンケート自動配信
 *
 * GET/POST /api/cron/csat-survey-send
 *
 * 査定完了から 24h 経過したアポにアンケートURLを LINE/メールで送付。
 * 重複防止のため csat_sent_at をセット。
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendMultiChannel } from "@/lib/notifications/multi-channel";

export const runtime = "nodejs";
export const maxDuration = 60;

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://makxas-front.vercel.app")
  );
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
  const baseUrl = getBaseUrl();

  // 完了から24h以上経過・未送信のアポ
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appts, error } = await (supabase as any)
    .from("appointments")
    .select(
      "id, csat_token, scheduled_at, lead:lead_id(display_name, phone, email, line_user_id), inquiry:inquiry_id(brands(name))",
    )
    .eq("status", "completed")
    .is("csat_sent_at", null)
    .lte("scheduled_at", yesterday)
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const appt of (appts ?? []) as Array<{
    id: string;
    csat_token: string;
    lead: { display_name?: string; phone?: string; email?: string; line_user_id?: string } | null;
    inquiry: { brands?: { name?: string } | null } | null;
  }>) {
    const lead = appt.lead;
    const brandName = appt.inquiry?.brands?.name ?? "買取マクサス";
    const surveyUrl = `${baseUrl}/survey/${appt.csat_token}`;

    if (!lead?.line_user_id && !lead?.email) {
      // 連絡先なし - 送信スキップしてマーク
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("appointments")
        .update({ csat_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      results.push({ id: appt.id, ok: false, error: "no channel" });
      continue;
    }

    const message = `${lead.display_name ?? "お客様"}

先日は${brandName}の出張買取をご利用いただきありがとうございました。
今後のサービス改善のため、簡単なアンケートにご協力いただけますと幸いです。

▼ アンケート (1分で完了)
${surveyUrl}

皆さまの声がより良いサービスに繋がります。
ご協力よろしくお願いいたします。`;

    const send = await sendMultiChannel(
      message,
      lead.line_user_id ? ["line"] : ["email"],
      {
        lineUserId: lead.line_user_id ?? null,
        email: lead.email ?? null,
        emailSubject: `【${brandName}】アンケートご協力のお願い`,
      },
    );

    const ok = send.some((r) => r.ok);
    if (ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("appointments")
        .update({ csat_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
    }
    results.push({
      id: appt.id,
      ok,
      error: send.filter((r) => !r.ok).map((r) => `${r.channel}:${r.error}`).join(", ") || undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    sent: results.filter((r) => r.ok).length,
    results,
  });
}
