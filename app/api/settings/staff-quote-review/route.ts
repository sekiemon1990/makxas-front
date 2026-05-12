import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// PATCH /api/settings/staff-quote-review
// body: { staff_id: string, requires_quote_review: boolean }
export async function PATCH(request: Request) {
  const body = await request.json() as {
    staff_id: string;
    requires_quote_review: boolean;
  };

  if (!body.staff_id || typeof body.requires_quote_review !== "boolean") {
    return NextResponse.json({ error: "staff_id and requires_quote_review required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff")
    .update({ requires_quote_review: body.requires_quote_review })
    .eq("id", body.staff_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
