import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: staff } = await service
    .from("staff")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ ok: true }); // スタッフ未登録でもエラーにしない

  await service
    .from("inquiry_reads")
    .upsert({ inquiry_id: id, staff_id: staff.id, read_at: new Date().toISOString() }, { onConflict: "inquiry_id,staff_id" });

  return NextResponse.json({ ok: true });
}
