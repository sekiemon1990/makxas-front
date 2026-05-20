/**
 * PR24: AI即時架電キュー API (Phase 4)
 *
 * POST /api/ai-call/queue
 * Body: { inquiry_id: string, script_hint?: string, scheduled_at?: string }
 *
 * - 反響に紐づく電話を AI 自動架電キューに登録
 * - makxas-phone (Twilio + OpenAI Realtime) が後段で pull/webhook 処理する想定
 * - 重複防止: 同一 inquiry_id で queued/calling 状態のレコードがあれば既存を返す
 *
 * GET /api/ai-call/queue?inquiry_id=...
 * - 反響に紐づくキューの最新ステータスを取得
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = ["queued", "calling", "completed", "failed", "cancelled"] as const;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
    script_hint?: string;
    scheduled_at?: string;
  } | null;
  if (!body?.inquiry_id) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  const supabase = createServiceClient();

  // 反響 + リード電話番号取得
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id, lead_id, leads(id, phone)")
    .eq("id", body.inquiry_id)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lead = (inquiry as any)?.leads as { id: string; phone: string | null } | null;
  if (!inquiry || !lead?.phone) {
    return NextResponse.json(
      { error: "inquiry not found or lead phone missing" },
      { status: 404 },
    );
  }

  // 重複チェック（queued / calling）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("ai_call_queue")
    .select("*")
    .eq("inquiry_id", body.inquiry_id)
    .in("status", ["queued", "calling"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ queueItem: existing, duplicated: true });
  }

  let createdByStaffId: string | null = null;
  if (user) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    createdByStaffId = staff?.id ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: queueItem, error } = await (supabase as any)
    .from("ai_call_queue")
    .insert({
      inquiry_id: body.inquiry_id,
      lead_id: lead.id,
      phone: lead.phone,
      script_hint:
        body.script_hint ??
        "MAKXAS思想に従い、反響商品の状態確認 + 追加買取候補（レバー2）の自然な聞き出し + アポ取得を目指す",
      scheduled_at: body.scheduled_at ?? new Date().toISOString(),
      created_by: createdByStaffId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queueItem, duplicated: false });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const inquiryId = url.searchParams.get("inquiry_id");
  if (!inquiryId) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("ai_call_queue")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(10);
  return NextResponse.json({ items: items ?? [] });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: typeof ALLOWED_STATUSES[number];
  } | null;
  if (!body?.id || !body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("ai_call_queue")
    .update({
      status: body.status,
      ...(body.status === "calling" ? { started_at: new Date().toISOString() } : {}),
      ...(["completed", "failed", "cancelled"].includes(body.status)
        ? { completed_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
