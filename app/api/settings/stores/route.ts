import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    store_code?: string;
    store_type?: "direct" | "fc";
  } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: body.name.trim(),
      store_code: body.store_code?.trim() || null,
      store_type: body.store_type ?? "fc",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ store: data });
}
