import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    tag?: string;
  } | null;

  const tag = body?.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("inquiry_tags")
    .upsert({ inquiry_id: id, tag }, { onConflict: "inquiry_id,tag" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inquiry_id: id, tag });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    tag?: string;
  } | null;

  const tag = body?.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("inquiry_tags")
    .delete()
    .eq("inquiry_id", id)
    .eq("tag", tag);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
