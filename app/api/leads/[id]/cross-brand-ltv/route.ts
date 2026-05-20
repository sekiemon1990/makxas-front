/**
 * PR40: マルチブランド横断LTV
 *
 * GET /api/leads/[id]/cross-brand-ltv
 *
 * 指定リードと同一連絡先（電話/メール/LINE）の他リードを横断的に集計し、
 * 全ブランド合算の LTV 関連指標を返す。
 *
 * MAKXAS思想：同一顧客が複数ブランド（買取マクサス・銀座リパール・
 * ブックリバー・カグウル）に問い合わせている場合、レバー2機会は
 * ブランド横断で評価すべき。
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const HIGH_VALUE_CATEGORIES = new Set(["貴金属", "時計", "ブランド品", "骨董品"]);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceClient();

  // 主リード取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (supabase as any)
    .from("leads")
    .select("id, display_name, phone, email, line_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  // 同一連絡先の他リード抽出（OR条件）
  const orConditions: string[] = [];
  if (lead.phone) orConditions.push(`phone.eq.${lead.phone}`);
  if (lead.email) orConditions.push(`email.eq.${lead.email}`);
  if (lead.line_user_id) orConditions.push(`line_user_id.eq.${lead.line_user_id}`);

  let relatedLeads: Array<{ id: string; display_name: string | null; first_channel: string | null }> = [];
  if (orConditions.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("leads")
      .select("id, display_name, first_channel")
      .or(orConditions.join(","));
    relatedLeads = (data ?? []) as typeof relatedLeads;
  } else {
    relatedLeads = [{ id: lead.id, display_name: lead.display_name, first_channel: null }];
  }

  const leadIds = relatedLeads.map((l) => l.id);

  // 関連反響・アポ・査定商品を一括取得
  const [inqRes, apptRes, itemRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("inquiries")
      .select("id, lead_id, channel, status, stores(name), brands(name), created_at")
      .in("lead_id", leadIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("appointments")
      .select("id, lead_id, status, item_category, additional_items_confirmed, scheduled_at")
      .in("lead_id", leadIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("inquiry_items")
      .select("inquiry_id, item_name, brand, estimated_price_min, quote_price_min")
      .in("inquiry_id", []),
  ]);

  const inquiries = (inqRes.data ?? []) as Array<{
    id: string;
    lead_id: string;
    channel: string;
    status: string;
    stores: { name: string } | null;
    brands: { name: string } | null;
    created_at: string;
  }>;
  const appts = (apptRes.data ?? []) as Array<{
    id: string;
    lead_id: string;
    status: string;
    item_category: string | null;
    additional_items_confirmed: Record<string, boolean> | null;
    scheduled_at: string;
  }>;

  // アイテムは inquiries.id ベースで再取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemsData } = await (supabase as any)
    .from("inquiry_items")
    .select("inquiry_id, item_name, estimated_price_min, quote_price_min")
    .in("inquiry_id", inquiries.map((i) => i.id));
  const items = (itemsData ?? []) as Array<{
    inquiry_id: string;
    estimated_price_min: number | null;
    quote_price_min: number | null;
  }>;

  // ブランド別集計
  const byBrand: Record<string, {
    brand: string;
    inquiry_count: number;
    appt_count: number;
    completed_count: number;
    high_value_count: number;
    additional_confirmed: number;
    estimated_total: number;
    quoted_total: number;
  }> = {};

  for (const inq of inquiries) {
    const brandName = inq.brands?.name ?? inq.stores?.name ?? "未分類";
    if (!byBrand[brandName]) {
      byBrand[brandName] = {
        brand: brandName,
        inquiry_count: 0,
        appt_count: 0,
        completed_count: 0,
        high_value_count: 0,
        additional_confirmed: 0,
        estimated_total: 0,
        quoted_total: 0,
      };
    }
    byBrand[brandName].inquiry_count++;
  }

  for (const a of appts) {
    // この lead_id が属する反響からブランドを逆引き
    const inq = inquiries.find((i) => i.lead_id === a.lead_id);
    const brandName = inq?.brands?.name ?? inq?.stores?.name ?? "未分類";
    if (!byBrand[brandName]) {
      byBrand[brandName] = {
        brand: brandName,
        inquiry_count: 0,
        appt_count: 0,
        completed_count: 0,
        high_value_count: 0,
        additional_confirmed: 0,
        estimated_total: 0,
        quoted_total: 0,
      };
    }
    const stat = byBrand[brandName];
    stat.appt_count++;
    if (a.status === "completed") stat.completed_count++;
    if (a.item_category && HIGH_VALUE_CATEGORIES.has(a.item_category)) {
      stat.high_value_count++;
    }
    if (
      a.additional_items_confirmed &&
      typeof a.additional_items_confirmed === "object" &&
      Object.values(a.additional_items_confirmed).some((v) => v === true)
    ) {
      stat.additional_confirmed++;
    }
  }

  for (const it of items) {
    const inq = inquiries.find((i) => i.id === it.inquiry_id);
    if (!inq) continue;
    const brandName = inq.brands?.name ?? inq.stores?.name ?? "未分類";
    if (!byBrand[brandName]) continue;
    byBrand[brandName].estimated_total += it.estimated_price_min ?? 0;
    byBrand[brandName].quoted_total += it.quote_price_min ?? 0;
  }

  const brandStats = Object.values(byBrand).sort(
    (a, b) => b.quoted_total + b.estimated_total - (a.quoted_total + a.estimated_total),
  );

  // 全体集計
  const totals = brandStats.reduce(
    (acc, b) => ({
      brands: acc.brands + 1,
      inquiry_count: acc.inquiry_count + b.inquiry_count,
      appt_count: acc.appt_count + b.appt_count,
      completed_count: acc.completed_count + b.completed_count,
      high_value_count: acc.high_value_count + b.high_value_count,
      additional_confirmed: acc.additional_confirmed + b.additional_confirmed,
      estimated_total: acc.estimated_total + b.estimated_total,
      quoted_total: acc.quoted_total + b.quoted_total,
    }),
    {
      brands: 0,
      inquiry_count: 0,
      appt_count: 0,
      completed_count: 0,
      high_value_count: 0,
      additional_confirmed: 0,
      estimated_total: 0,
      quoted_total: 0,
    },
  );

  return NextResponse.json({
    lead: { id: lead.id, display_name: lead.display_name },
    related_lead_count: relatedLeads.length,
    related_leads: relatedLeads,
    totals,
    by_brand: brandStats,
  });
}
