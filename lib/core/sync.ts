/**
 * マクサスコア（core-rails）連携モジュール
 *
 * 接続優先順:
 * 1. core-rails REST API (POST /api/front/appointments) ← 小湊さんに作成依頼が必要
 * 2. Google Sheets フォールバック（Phase 1 暫定）
 *
 * 認証: Authorization: Token <CORE_API_TOKEN> (HTTP Token Auth)
 * トークン: core-rails/config/initializers/002_constants.rb の MAKXAS_CORE_API_TOKEN
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { Appointment, InquiryWithLead } from "@/types/database";

type SyncAppointmentInput = {
  appointment: Appointment;
  inquiry: InquiryWithLead;
};

/** core-rails に渡すアポ連携ペイロード */
type CoreAppointmentPayload = {
  appointment: {
    sourceId: string;
    sourceType: "inside_sales";
    scheduledAt: string;
    itemCategory: string | null;
    itemDescription: string | null;
    address: string | null;
    preferredMethod: "visit" | "delivery";
    additionalItemsConfirmed: Record<string, boolean> | null;
  };
  lead: {
    displayName: string | null;
    phone: string | null;
    email: string | null;
    lineUserId: string | null;
  };
  inquiry: {
    id: string;
    channel: string;
    internalNote: string | null;
    sourceSite: string | null;
    frontUrl: string;
  };
};

/**
 * core-rails REST API 経由でアポ情報を送信
 *
 * POST /api/front/appointments
 * ※ このエンドポイントは現在 core-rails に未実装。
 *   小湊さんへの依頼内容は AGENTS.md「マクサスコア連携」を参照。
 */
async function syncViaApi(
  payload: CoreAppointmentPayload,
): Promise<{ coreAppointmentId?: string; coreProjectUrl?: string }> {
  const coreUrl = process.env.CORE_RAILS_URL;
  const coreToken = process.env.CORE_API_TOKEN;

  if (!coreUrl || !coreToken) {
    throw new Error("CORE_RAILS_URL または CORE_API_TOKEN が未設定です");
  }

  const endpoint = `${coreUrl}/api/front/appointments`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${coreToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`core-rails API エラー: ${res.status} ${body}`);
  }

  return await res.json();
}

/**
 * Google Sheets フォールバック（Phase 1 暫定）
 */
async function syncViaGoogleSheets(
  appointment: Appointment,
  inquiry: InquiryWithLead,
): Promise<void> {
  const spreadsheetId = process.env.CORE_SYNC_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error(
      "Google Sheets 環境変数が未設定です（CORE_SYNC_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY）",
    );
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A:L",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          appointment.id,
          appointment.inquiry_id,
          inquiry.leads?.display_name ?? "",
          inquiry.leads?.phone ?? "",
          inquiry.leads?.email ?? "",
          appointment.scheduled_at,
          appointment.item_category ?? "",
          appointment.item_description ?? "",
          appointment.address ?? "",
          appointment.preferred_method === "delivery" ? "宅配査定" : "訪問査定",
          inquiry.channel,
          appointment.created_at,
        ],
      ],
    },
  });
}

/**
 * アポ情報をマクサスコアへ同期
 *
 * 優先: core-rails API → フォールバック: Google Sheets
 */
export async function syncAppointmentToCore({
  appointment,
  inquiry,
}: SyncAppointmentInput) {
  const supabase = createServiceClient();

  const payload: CoreAppointmentPayload = {
    appointment: {
      sourceId: appointment.id,
      sourceType: "inside_sales",
      scheduledAt: appointment.scheduled_at,
      itemCategory: appointment.item_category ?? null,
      itemDescription: appointment.item_description ?? null,
      address: appointment.address ?? null,
      preferredMethod:
        appointment.preferred_method === "delivery" ? "delivery" : "visit",
      additionalItemsConfirmed:
        (appointment.additional_items_confirmed as Record<
          string,
          boolean
        > | null) ?? null,
    },
    lead: {
      displayName: inquiry.leads?.display_name ?? null,
      phone: inquiry.leads?.phone ?? null,
      email: inquiry.leads?.email ?? null,
      lineUserId: inquiry.leads?.line_user_id ?? null,
    },
    inquiry: {
      id: inquiry.id,
      channel: inquiry.channel,
      internalNote: inquiry.internal_note ?? null,
      sourceSite: inquiry.source_site ?? null,
      frontUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://front.makxas.com"}/inbox/${inquiry.id}`,
    },
  };

  // --- Step 1: core-rails API を試みる ---
  const coreUrl = process.env.CORE_RAILS_URL;
  const coreToken = process.env.CORE_API_TOKEN;

  if (coreUrl && coreToken) {
    try {
      const result = await syncViaApi(payload);

      // core_synced_at と core_appointment_id を更新
      await supabase
        .from("appointments")
        .update({
          core_synced_at: new Date().toISOString(),
          ...(result.coreAppointmentId
            ? { core_appointment_id: result.coreAppointmentId }
            : {}),
        })
        .eq("id", appointment.id);

      await supabase.from("core_sync_log").insert({
        direction: "to_core",
        entity_type: "appointment",
        entity_id: appointment.id,
        payload: payload as never,
        status: "success",
      });

      console.log(
        `[core-sync] アポ ${appointment.id} → core-rails 連携成功`,
        result,
      );
      return;
    } catch (apiError) {
      const errorMsg =
        apiError instanceof Error ? apiError.message : String(apiError);

      // 404 = エンドポイント未作成 → フォールバック（警告のみ）
      // その他エラー → ログに記録してフォールバック
      console.warn(
        `[core-sync] core-rails API 失敗（Google Sheets にフォールバック）: ${errorMsg}`,
      );

      await supabase.from("core_sync_log").insert({
        direction: "to_core",
        entity_type: "appointment",
        entity_id: appointment.id,
        payload: payload as never,
        status: "failed",
        error_message: `[API失敗・Sheetsフォールバック] ${errorMsg}`,
      });
    }
  }

  // --- Step 2: Google Sheets フォールバック ---
  try {
    await syncViaGoogleSheets(appointment, inquiry);

    await supabase
      .from("appointments")
      .update({ core_synced_at: new Date().toISOString() })
      .eq("id", appointment.id);

    await supabase.from("core_sync_log").insert({
      direction: "to_core",
      entity_type: "appointment",
      entity_id: appointment.id,
      payload: payload as never,
      status: "success",
      error_message: "Google Sheets フォールバック経由",
    });

    console.log(
      `[core-sync] アポ ${appointment.id} → Google Sheets 書き出し完了（暫定）`,
    );
  } catch (sheetsError) {
    const errorMsg =
      sheetsError instanceof Error ? sheetsError.message : String(sheetsError);
    console.error(`[core-sync] Google Sheets 書き出しも失敗: ${errorMsg}`);

    await supabase.from("core_sync_log").insert({
      direction: "to_core",
      entity_type: "appointment",
      entity_id: appointment.id,
      payload: payload as never,
      status: "failed",
      error_message: `[API失敗 + Sheets失敗] ${errorMsg}`,
    });
  }
}

/**
 * core-rails への疎通確認
 * GET /api/banks を呼んで 200 が返れば接続OK
 */
export async function pingCoreRails(): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  const coreUrl = process.env.CORE_RAILS_URL;
  const coreToken = process.env.CORE_API_TOKEN;

  if (!coreUrl || !coreToken) {
    return { ok: false, error: "CORE_RAILS_URL または CORE_API_TOKEN が未設定" };
  }

  try {
    const res = await fetch(`${coreUrl}/api/banks`, {
      headers: { Authorization: `Token ${coreToken}` },
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
