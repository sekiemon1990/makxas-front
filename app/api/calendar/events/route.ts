import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to   = searchParams.get("to");   // YYYY-MM-DD
  const staffId = searchParams.get("staff_id");

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (service as any)
    .from("calendar_events")
    .select("*, staff:staff_id(id,name,team)")
    .neq("status", "cancelled")
    .order("start_at", { ascending: true });

  if (from) query = query.gte("start_at", `${from}T00:00:00+00:00`);
  if (to)   query = query.lte("start_at", `${to}T23:59:59+00:00`);
  if (staffId) query = query.eq("staff_id", staffId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
