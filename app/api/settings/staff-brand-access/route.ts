import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    staff_id?: string;
    brand_id?: string;
  } | null;

  if (!body?.staff_id || !body.brand_id) {
    return NextResponse.json(
      { error: "staff_id and brand_id are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff_brand_access")
    .upsert(
      {
        staff_id: body.staff_id,
        brand_id: body.brand_id,
      },
      { onConflict: "staff_id,brand_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff_brand_access: data });
}
