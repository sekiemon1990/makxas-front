/**
 * PR42: CSAT アンケート公開API
 *
 * GET /api/public/survey/[token]  → アンケート対象情報取得
 * POST /api/public/survey/[token] → 回答保存
 *
 * 認証不要（token がランダム UUID で保護）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("appointments")
    .select(
      "id, scheduled_at, csat_score, csat_responded_at, inquiry:inquiry_id(brands(name)), lead:lead_id(display_name)",
    )
    .eq("csat_token", token)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    brand_name: data.inquiry?.brands?.name ?? "買取マクサス",
    customer_name: data.lead?.display_name ?? null,
    already_responded: !!data.csat_responded_at,
    csat_score: data.csat_score,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    score?: number;
    nps?: number;
    comment?: string;
  } | null;
  if (!body || typeof body.score !== "number" || body.score < 1 || body.score > 5) {
    return NextResponse.json({ error: "score (1-5) required" }, { status: 400 });
  }
  if (body.nps != null && (body.nps < 0 || body.nps > 10)) {
    return NextResponse.json({ error: "nps must be 0-10" }, { status: 400 });
  }

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("appointments")
    .update({
      csat_score: body.score,
      csat_nps: body.nps ?? null,
      csat_comment: body.comment ?? null,
      csat_responded_at: new Date().toISOString(),
    })
    .eq("csat_token", token)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
