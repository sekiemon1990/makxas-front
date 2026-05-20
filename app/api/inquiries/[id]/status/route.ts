import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
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

  // 変更前の status を取得（監査ログ用）
  const { data: prev } = await supabase
    .from("inquiries")
    .select("status")
    .eq("id", id)
    .single();
  const beforeStatus = (prev as { status?: string } | null)?.status ?? null;

  const { data, error } = await supabase
    .from("inquiries")
    .update({ status: body.status as InquiryStatus })
    .eq("id", id)
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 監査ログ記録（status が実際に変わった場合のみ）
  if (beforeStatus !== body.status) {
    // staff.auth_id から staff.id を逆引き
    const { data: staffRow } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    void logAudit({
      entityType: "inquiry",
      entityId: id,
      action: "status_change",
      field: "status",
      beforeValue: beforeStatus,
      afterValue: body.status,
      changedBy: (staffRow as { id?: string } | null)?.id ?? null,
      changedByEmail: user.email ?? null,
    });
  }

  return NextResponse.json({ inquiry: data as unknown as InquiryWithLead });
}
