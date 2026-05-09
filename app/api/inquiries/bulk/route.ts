import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { InquiryStatus } from "@/types/database";

const VALID_STATUSES: InquiryStatus[] = [
  "new",
  "in_progress",
  "pending",
  "appointment_set",
  "transferred",
  "lost",
  "closed",
];

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    ids?: string[];
    status?: string;
    assigned_to?: string | null;
  } | null;

  if (!body?.ids || body.ids.length === 0) {
    return NextResponse.json({ error: "ids are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasStatus =
    body.status && VALID_STATUSES.includes(body.status as InquiryStatus);
  const hasAssign = typeof body.assigned_to !== "undefined";

  if (!hasStatus && !hasAssign) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const assignedTo = hasAssign
    ? body.assigned_to && body.assigned_to !== "unassigned"
      ? body.assigned_to
      : null
    : undefined;

  const { error, count } = await supabase
    .from("inquiries")
    .update({
      ...(hasStatus ? { status: body.status as InquiryStatus } : {}),
      ...(hasAssign ? { assigned_to: assignedTo } : {}),
    })
    .in("id", body.ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: count ?? body.ids.length });
}
