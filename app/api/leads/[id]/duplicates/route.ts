import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: lead } = await supabase.from("leads").select("phone, email").eq("id", id).maybeSingle();
  if (!lead) return NextResponse.json({ duplicates: [] });

  const conditions: string[] = [];
  if (lead.phone) conditions.push(`phone.eq.${lead.phone}`);
  if (lead.email) conditions.push(`email.eq.${lead.email}`);
  if (conditions.length === 0) return NextResponse.json({ duplicates: [] });

  // lead_contacts テーブルも参照して複数連絡先に対応
  const { data: matchedContacts } = await supabase
    .from("lead_contacts")
    .select("lead_id")
    .or([
      ...(lead.phone ? [`value.eq.${lead.phone}`] : []),
      ...(lead.email ? [`value.eq.${lead.email}`] : []),
    ].join(","))
    .not("lead_id", "eq", id);

  const contactLeadIds = [...new Set((matchedContacts ?? []).map((c) => c.lead_id))];

  // leads テーブルの直接一致 + lead_contacts 経由の一致を統合
  const orConditions = [...conditions];
  const allLeadIds = contactLeadIds.filter((lid) => lid !== id);

  let duplicates: { id: string; display_name: string | null; phone: string | null; email: string | null; first_channel: string | null }[] = [];

  if (orConditions.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, display_name, phone, email, first_channel, created_at")
      .or(orConditions.join(","))
      .neq("id", id)
      .is("archived_at", null)
      .limit(5);
    duplicates = data ?? [];
  }

  if (allLeadIds.length > 0) {
    const existing = new Set(duplicates.map((d) => d.id));
    const newIds = allLeadIds.filter((lid) => !existing.has(lid));
    if (newIds.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("id, display_name, phone, email, first_channel, created_at")
        .in("id", newIds)
        .is("archived_at", null)
        .limit(5);
      duplicates = [...duplicates, ...(data ?? [])];
    }
  }

  return NextResponse.json({ duplicates });
}
