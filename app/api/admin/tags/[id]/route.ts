import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { name?: string; color?: string; is_active?: boolean; sort_order?: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("tag_master")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ tag: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { error } = await supabase.from("tag_master").delete().eq("id", id);
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
