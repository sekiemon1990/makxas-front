import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    staff_id?: string;
    store_id?: string;
  } | null;

  if (!body?.staff_id || !body.store_id) {
    return NextResponse.json(
      { error: "staff_id and store_id are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff_store_access")
    .upsert(
      {
        staff_id: body.staff_id,
        store_id: body.store_id,
      },
      { onConflict: "staff_id,store_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff_store_access: data });
}
