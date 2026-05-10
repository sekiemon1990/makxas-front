import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("tag_master")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ tags: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; color?: string; sort_order?: number };
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("tag_master")
    .insert({ name: body.name.trim(), color: body.color ?? "#6b7280", sort_order: body.sort_order ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ tag: data });
}
