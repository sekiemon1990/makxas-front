/**
 * GET /api/leads/search?q=検索キーワード
 * 名前・電話・メールでリードを検索（リード変更モーダル用）
 * lead_contacts テーブルも対象にして複数連絡先に対応
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (q.length < 1) return NextResponse.json({ leads: [] });

  const supabase = createServiceClient();

  // leads テーブルを名前/電話/メールで検索
  const { data: byName } = await supabase
    .from("leads")
    .select("id, display_name, phone, email, line_user_id, first_channel, created_at, archived_at")
    .is("archived_at", null) // アーカイブ済みは除外
    .or(`display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  // lead_contacts テーブルでも検索（複数連絡先対応）
  const { data: byContact } = await supabase
    .from("lead_contacts")
    .select("lead_id, type, value, label")
    .ilike("value", `%${q}%`)
    .limit(20);

  // lead_contacts にヒットした lead_id を収集（重複除外）
  const contactLeadIds = [...new Set((byContact ?? []).map((c) => c.lead_id))];

  let additionalLeads: typeof byName = [];
  if (contactLeadIds.length > 0) {
    const alreadyFoundIds = new Set((byName ?? []).map((l) => l.id));
    const newIds = contactLeadIds.filter((id) => !alreadyFoundIds.has(id));
    if (newIds.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("id, display_name, phone, email, line_user_id, first_channel, created_at, archived_at")
        .in("id", newIds)
        .is("archived_at", null)
        .limit(10);
      additionalLeads = data ?? [];
    }
  }

  // マッチした連絡先情報をリードに紐付け（表示用）
  const contactMap = new Map<string, { type: string; value: string; label: string | null }[]>();
  for (const c of byContact ?? []) {
    const arr = contactMap.get(c.lead_id) ?? [];
    arr.push({ type: c.type, value: c.value, label: c.label });
    contactMap.set(c.lead_id, arr);
  }

  const allLeads = [...(byName ?? []), ...additionalLeads].map((lead) => ({
    ...lead,
    matched_contacts: contactMap.get(lead.id) ?? [],
  }));

  return NextResponse.json({ leads: allLeads });
}
