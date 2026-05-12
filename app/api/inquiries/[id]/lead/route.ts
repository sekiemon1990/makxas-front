/**
 * PATCH /api/inquiries/[id]/lead
 * 反響のリード（lead_id）を変更する（手動紐付け）
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { leadId: string };
  const { leadId } = body;

  if (!leadId) return NextResponse.json({ error: "leadId は必須です" }, { status: 400 });

  const supabase = createServiceClient();

  // リードの存在確認
  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "指定されたリードが見つかりません" }, { status: 404 });

  const { error } = await supabase
    .from("inquiries")
    .update({ lead_id: leadId })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
