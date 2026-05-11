import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { ai_edit_reason?: string };
  if (!body.ai_edit_reason) return NextResponse.json({ error: "required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("messages")
    .update({ ai_edit_reason: body.ai_edit_reason })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
