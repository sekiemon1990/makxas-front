/**
 * PR33: マクサスコアからの結果フィードバック受信
 *
 * POST /api/webhooks/core/result
 *
 * core-rails 側で査定結果（成約・失注）が確定したときに呼ばれる webhook。
 * appointments / inquiries のステータスを自動更新し、core_sync_log に記録する。
 *
 * 認証: Authorization: Token <CORE_API_TOKEN>（送信側と同一トークン）
 *
 * 期待ペイロード:
 * {
 *   "core_appointment_id": "string",   // core側のID（必須）
 *   "result": "won" | "lost",          // 成約結果（必須）
 *   "amount": 50000,                   // 買取総額（成約時のみ・任意）
 *   "memo": "string"                   // 自由メモ（任意）
 * }
 *
 * 応答:
 *   200 OK { ok: true, updated: { appointment_id, inquiry_id } }
 *   400 invalid payload
 *   401 unauthorized
 *   404 appointment not found
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit/log";

type ResultPayload = {
  core_appointment_id?: string;
  result?: "won" | "lost";
  amount?: number;
  memo?: string;
};

export async function POST(request: NextRequest) {
  // 認証
  const auth = request.headers.get("authorization") ?? "";
  const expected = process.env.CORE_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "CORE_API_TOKEN not configured" },
      { status: 500 },
    );
  }
  if (auth !== `Token ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ResultPayload | null;
  if (!body?.core_appointment_id || !body.result) {
    return NextResponse.json(
      { error: "core_appointment_id and result required" },
      { status: 400 },
    );
  }
  if (body.result !== "won" && body.result !== "lost") {
    return NextResponse.json(
      { error: "result must be 'won' or 'lost'" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // core_appointment_id から対象アポを検索
  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select("id, inquiry_id, status")
    .eq("core_appointment_id", body.core_appointment_id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json(
      { error: `appointment not found for core_appointment_id=${body.core_appointment_id}` },
      { status: 404 },
    );
  }

  // appointments.status と core 結果データを更新
  const newApptStatus = body.result === "won" ? "completed" : "cancelled";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("appointments")
    .update({
      status: newApptStatus,
      core_result_amount: body.amount ?? null,
      core_result_memo: body.memo ?? null,
      core_result_received_at: new Date().toISOString(),
    })
    .eq("id", appt.id);

  // inquiries.status を更新
  const newInqStatus = body.result === "won" ? "closed" : "lost";
  await supabase
    .from("inquiries")
    .update({ status: newInqStatus })
    .eq("id", appt.inquiry_id);

  // core_sync_log に記録
  await supabase.from("core_sync_log").insert({
    direction: "from_core",
    entity_type: "appointment",
    entity_id: appt.id,
    payload: body as never,
    status: "success",
  });

  // 監査ログ
  void logAudit({
    entityType: "appointment",
    entityId: appt.id,
    action: "status_change",
    field: "status",
    beforeValue: appt.status,
    afterValue: newApptStatus,
    changedByEmail: "core-rails:webhook",
    note: `core webhook: result=${body.result}${body.amount ? ` amount=${body.amount}` : ""}`,
  });
  void logAudit({
    entityType: "inquiry",
    entityId: appt.inquiry_id,
    action: "status_change",
    field: "status",
    afterValue: newInqStatus,
    changedByEmail: "core-rails:webhook",
    note: `from_core webhook (${body.result})`,
  });

  return NextResponse.json({
    ok: true,
    updated: {
      appointment_id: appt.id,
      inquiry_id: appt.inquiry_id,
      appt_status: newApptStatus,
      inquiry_status: newInqStatus,
    },
  });
}
