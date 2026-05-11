import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { staff_id?: string; team?: string } | null;
  if (!body?.staff_id || !body.team) {
    return NextResponse.json({ error: "staff_id and team are required" }, { status: 400 });
  }
  if (!["IS", "FS"].includes(body.team)) {
    return NextResponse.json({ error: "team must be IS or FS" }, { status: 400 });
  }

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from("staff")
    .update({ team: body.team })
    .eq("id", body.staff_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
