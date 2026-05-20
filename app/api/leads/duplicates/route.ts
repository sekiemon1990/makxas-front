import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * リード重複検出 API
 *
 * 同一電話 / 同一メール / 同一 LINE userId をキーに、
 * 複数の leads レコードが存在するグループを返す。
 * マルチブランド構成で同一人物が別ブランドへ問い合わせした場合の自動統合候補として使う。
 *
 * 正規化:
 * - 電話: 数字のみ抽出（ハイフン・全角を除去）
 * - メール: lowercase + trim
 * - LINE userId: 完全一致（U で始まる32文字）
 */
export async function GET() {
  const supabase = createServiceClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, display_name, phone, email, line_user_id, first_channel, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalizePhone = (p: string | null): string | null => {
    if (!p) return null;
    const digits = p.replace(/[^0-9]/g, "");
    if (digits.length < 10) return null; // 短すぎる番号は除外
    return digits;
  };
  const normalizeEmail = (e: string | null): string | null => {
    if (!e) return null;
    const trimmed = e.trim().toLowerCase();
    return trimmed.includes("@") ? trimmed : null;
  };

  const phoneMap = new Map<string, typeof leads>();
  const emailMap = new Map<string, typeof leads>();
  const lineMap = new Map<string, typeof leads>();

  for (const lead of leads ?? []) {
    const p = normalizePhone(lead.phone);
    if (p) {
      if (!phoneMap.has(p)) phoneMap.set(p, []);
      phoneMap.get(p)!.push(lead);
    }
    const e = normalizeEmail(lead.email);
    if (e) {
      if (!emailMap.has(e)) emailMap.set(e, []);
      emailMap.get(e)!.push(lead);
    }
    if (lead.line_user_id) {
      if (!lineMap.has(lead.line_user_id)) lineMap.set(lead.line_user_id, []);
      lineMap.get(lead.line_user_id)!.push(lead);
    }
  }

  type DuplicateGroup = {
    key: string;
    matchType: "phone" | "email" | "line";
    matchValue: string;
    leads: NonNullable<typeof leads>;
  };

  const groups: DuplicateGroup[] = [];
  const seenSets = new Set<string>();

  const addGroup = (
    map: Map<string, typeof leads>,
    type: "phone" | "email" | "line",
  ) => {
    for (const [value, items] of map.entries()) {
      if (!items || items.length < 2) continue;
      // 同じリード集合を別キー（電話＋メール両方一致）で重複登録しないため signature 化
      const sig = items
        .map((l) => l.id)
        .sort()
        .join("|");
      if (seenSets.has(sig)) continue;
      seenSets.add(sig);
      groups.push({
        key: `${type}-${value}`,
        matchType: type,
        matchValue: value,
        leads: items,
      });
    }
  };
  addGroup(phoneMap, "phone");
  addGroup(emailMap, "email");
  addGroup(lineMap, "line");

  return NextResponse.json({
    totalGroups: groups.length,
    totalDuplicateLeads: groups.reduce((acc, g) => acc + g.leads.length, 0),
    groups,
  });
}
