import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { InquiryWithLead } from "@/types/database";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    assigned_to?: string | null;
  } | null;

  if (!body || typeof body.assigned_to === "undefined") {
    return NextResponse.json({ error: "assigned_to is required" }, { status: 400 });
  }

  const assignedTo =
    body.assigned_to && body.assigned_to !== "unassigned"
      ? body.assigned_to
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("inquiries")
    .update({ assigned_to: assignedTo })
    .eq("id", id)
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inquiry: data as unknown as InquiryWithLead });
}
