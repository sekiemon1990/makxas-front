import { google } from "googleapis";

import { createServiceClient } from "@/lib/supabase/service";
import type { Appointment, InquiryWithLead } from "@/types/database";

type SyncAppointmentInput = {
  appointment: Appointment;
  inquiry: InquiryWithLead;
};

export async function syncAppointmentToCore({
  appointment,
  inquiry,
}: SyncAppointmentInput) {
  const supabase = createServiceClient();
  const spreadsheetId = process.env.CORE_SYNC_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  const payload = {
    appointment,
    inquiry,
  };

  if (!spreadsheetId || !clientEmail || !privateKey) {
    await supabase.from("core_sync_log").insert({
      direction: "to_core",
      entity_type: "appointment",
      entity_id: appointment.id,
      payload,
      status: "failed",
      error_message: "Google Sheets environment variables are missing",
    });
    return;
  }

  try {
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

    const syncedAt = new Date().toISOString();
    await supabase
      .from("appointments")
      .update({ core_synced_at: syncedAt })
      .eq("id", appointment.id);

    await supabase.from("core_sync_log").insert({
      direction: "to_core",
      entity_type: "appointment",
      entity_id: appointment.id,
      payload,
      status: "success",
    });
  } catch (error) {
    await supabase.from("core_sync_log").insert({
      direction: "to_core",
      entity_type: "appointment",
      entity_id: appointment.id,
      payload,
      status: "failed",
      error_message:
        error instanceof Error ? error.message : "Unknown Google Sheets error",
    });
  }
}
