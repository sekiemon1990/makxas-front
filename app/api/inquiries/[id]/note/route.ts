import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    internal_note?: string;
  } | null;

  if (body === null) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("inquiries")
    .update({ internal_note: body.internal_note ?? null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
