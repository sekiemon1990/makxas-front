import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("inquiries")
    .select("id, subject, channel, status, created_at, stores(name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ inquiries: data ?? [] });
}
