import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("prompt_versions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    msg_category?: string; theme?: string; content?: string; note?: string;
  } | null;
  if (!body?.msg_category || !body.content) {
    return NextResponse.json({ error: "msg_category and content required" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data: latest } = await supabase
    .from("prompt_versions")
    .select("version")
    .eq("msg_category", body.msg_category)
    .eq("theme", body.theme ?? null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest as { version: number } | null)?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("prompt_versions")
    .insert({
      msg_category: body.msg_category,
      theme: body.theme ?? null,
      prompt_type: "force_theme_system",
      content: body.content,
      version: nextVersion,
      is_active: false,
      created_by: "manual",
      note: body.note ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
