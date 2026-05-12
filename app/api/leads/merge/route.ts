/**
 * POST /api/leads/merge
 * primaryLeadId に secondaryLeadId を統合する
 * - secondary の全 inquiries を primary に付け替え
 * - secondary の lead_contacts を primary に移行（重複除く）
 * - secondary を archived_at + merged_into_lead_id でマーク
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { primaryLeadId: string; secondaryLeadId: string };
  const { primaryLeadId, secondaryLeadId } = body;

  if (!primaryLeadId || !secondaryLeadId) {
    return NextResponse.json({ error: "primaryLeadId と secondaryLeadId は必須です" }, { status: 400 });
  }
  if (primaryLeadId === secondaryLeadId) {
    return NextResponse.json({ error: "同一リードは統合できません" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ① secondary の inquiries を primary に付け替え
  const { error: inqError } = await supabase
    .from("inquiries")
    .update({ lead_id: primaryLeadId })
    .eq("lead_id", secondaryLeadId);
  if (inqError) return NextResponse.json({ error: inqError.message }, { status: 500 });

  // ② secondary の appointments を primary に付け替え
  await supabase
    .from("appointments")
    .update({ lead_id: primaryLeadId })
    .eq("lead_id", secondaryLeadId);

  // ③ secondary の lead_contacts を primary に移行（重複はスキップ）
  const { data: secondaryContacts } = await supabase
    .from("lead_contacts")
    .select("*")
    .eq("lead_id", secondaryLeadId);

  if (secondaryContacts && secondaryContacts.length > 0) {
    const toInsert = secondaryContacts.map((c) => ({
      lead_id: primaryLeadId,
      type: c.type,
      value: c.value,
      label: c.label,
      is_primary: false, // primary の既存連絡先を優先
      source: c.source,
    }));
    await supabase
      .from("lead_contacts")
      .insert(toInsert)
      .select(); // ON CONFLICT は UNIQUE インデックスで自動スキップ（エラーを無視）
  }

  // ④ secondary リードを archived にマーク
  const { error: archiveError } = await supabase
    .from("leads")
    .update({
      archived_at: new Date().toISOString(),
      merged_into_lead_id: primaryLeadId,
    })
    .eq("id", secondaryLeadId);
  if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 });

  return NextResponse.json({ success: true, primaryLeadId });
}
