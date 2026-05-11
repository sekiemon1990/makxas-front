import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  // 対象プロンプトを取得
  const { data: target } = await supabase
    .from("prompt_versions")
    .select("msg_category, theme")
    .eq("id", id)
    .single();

  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const targetRow = target as { msg_category: string; theme: string | null };

  // 同カテゴリ×テーマの既存アクティブを無効化
  await supabase
    .from("prompt_versions")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("msg_category", targetRow.msg_category)
    .eq("is_active", true)
    .neq("id", id);

  // 対象を有効化
  const { data, error } = await supabase
    .from("prompt_versions")
    .update({ is_active: true, activated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
