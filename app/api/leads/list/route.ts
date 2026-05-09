import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();

  const [{ data: leads }, { data: inquiries }, { data: appointments }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, display_name, phone, email, line_user_id, first_channel, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("inquiries")
      .select("lead_id, channel, created_at")
      .not("lead_id", "is", null),
    supabase
      .from("appointments")
      .select("lead_id"),
  ]);

  return NextResponse.json({
    leads: leads ?? [],
    inquiries: inquiries ?? [],
    appointments: appointments ?? [],
  });
}
