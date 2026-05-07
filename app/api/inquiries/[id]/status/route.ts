import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { InquiryStatus, InquiryWithLead } from "@/types/database";

const allowedStatuses = new Set<InquiryStatus>([
  "new",
  "in_progress",
  "pending",
  "appointment_set",
  "transferred",
  "lost",
  "closed",
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    status?: string;
  } | null;

  if (!body?.status || !allowedStatuses.has(body.status as InquiryStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("inquiries")
    .update({ status: body.status as InquiryStatus })
    .eq("id", id)
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inquiry: data as unknown as InquiryWithLead });
}
