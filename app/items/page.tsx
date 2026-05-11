import Link from "next/link";
import { Package } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge } from "@/components/badges";
import { createServiceClient } from "@/lib/supabase/service";
import type { InquiryItemCondition } from "@/types/database";

export const dynamic = "force-dynamic";

const CONDITION_LABELS: Record<InquiryItemCondition, string> = {
  N: "新品未使用",
  S: "未使用に近い",
  A: "目立った傷なし",
  B: "少し傷あり",
  C: "傷・汚れあり",
  D: "かなり傷あり",
  J: "ジャンク",
  不明: "不明",
  その他: "その他",
};

const CONDITION_COLORS: Record<InquiryItemCondition, string> = {
  N: "bg-emerald-100 text-emerald-800",
  S: "bg-green-100 text-green-800",
  A: "bg-sky-100 text-sky-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  J: "bg-red-100 text-red-800",
  不明: "bg-zinc-100 text-zinc-600",
  その他: "bg-zinc-100 text-zinc-600",
};

type QuoteType = "upper" | "around" | "exact" | "range";

function formatQuote(
  quoteType: QuoteType | null,
  priceMin: number | null,
  priceMax: number | null,
): string | null {
  if (!quoteType || priceMin == null) return null;
  const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  switch (quoteType) {
    case "upper":  return `最大 ${fmt(priceMin)}`;
    case "around": return `${fmt(priceMin)} 前後`;
    case "exact":  return fmt(priceMin);
    case "range":
      return priceMax != null ? `${fmt(priceMin)}〜${fmt(priceMax)}` : `${fmt(priceMin)}〜`;
  }
}

type ItemRow = {
  id: string;
  inquiry_id: string;
  lead_id: string | null;
  item_name: string;
  brand: string | null;
  model_number: string | null;
  condition: string | null;
  accessories: string | null;
  estimated_price_min: number | null;
  quote_type: string | null;
  quote_price_min: number | null;
  quote_price_max: number | null;
  notes: string | null;
  ai_extracted: boolean;
  created_at: string;
  // joined
  inquiry_channel: string | null;
  inquiry_subject: string | null;
  lead_name: string | null;
  lead_phone: string | null;
};

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filterCondition = (typeof sp.condition === "string" ? sp.condition : "") || "";
  const filterQuote = sp.quote === "1";
  const filterSearch = (typeof sp.q === "string" ? sp.q : "") || "";

  const supabase = createServiceClient();

  // inquiry_items と inquiry・lead を JOIN して取得
  const { data: rawItems } = await supabase
    .from("inquiry_items")
    .select(
      `*,
      inquiries(id, channel, subject, lead_id,
        leads(id, display_name, phone, email)
      )`
    )
    .order("created_at", { ascending: false });

  // フラット化
  const items: ItemRow[] = (rawItems ?? []).map((r) => {
    const inq = r.inquiries as {
      id: string;
      channel: string;
      subject: string | null;
      lead_id: string | null;
      leads: { id: string; display_name: string | null; phone: string | null; email: string | null } | null;
    } | null;
    const lead = inq?.leads ?? null;
    return {
      id: r.id,
      inquiry_id: r.inquiry_id,
      lead_id: inq?.lead_id ?? null,
      item_name: r.item_name,
      brand: r.brand,
      model_number: r.model_number,
      condition: r.condition,
      accessories: r.accessories,
      estimated_price_min: r.estimated_price_min,
      quote_type: r.quote_type,
      quote_price_min: r.quote_price_min,
      quote_price_max: r.quote_price_max,
      notes: r.notes,
      ai_extracted: r.ai_extracted,
      created_at: r.created_at,
      inquiry_channel: inq?.channel ?? null,
      inquiry_subject: inq?.subject ?? null,
      lead_name: lead?.display_name ?? lead?.phone ?? lead?.email ?? null,
      lead_phone: lead?.phone ?? null,
    };
  });

  // フィルタリング
  const filtered = items.filter((item) => {
    if (filterCondition && item.condition !== filterCondition) return false;
    if (filterQuote && !item.quote_type) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const hit =
        item.item_name.toLowerCase().includes(q) ||
        (item.brand ?? "").toLowerCase().includes(q) ||
        (item.model_number ?? "").toLowerCase().includes(q) ||
        (item.lead_name ?? "").toLowerCase().includes(q) ||
        (item.lead_phone ?? "").includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // 統計
  const totalItems = items.length;
  const quotedItems = items.filter((i) => !!i.quote_type).length;
  const aiItems = items.filter((i) => i.ai_extracted).length;

  // ブランド一覧（フィルター用）
  const brands = [...new Set(items.map((i) => i.brand).filter(Boolean))] as string[];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ── ヘッダー ─────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Package className="size-6 text-violet-500" />
              商品一覧
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              全リードからの問い合わせ商品 · AI抽出・手動入力を含む
            </p>
          </div>
        </div>

        {/* ── 統計カード ───────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">総商品数</div>
            <div className="text-3xl font-bold text-zinc-900">{totalItems}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">事前査定あり</div>
            <div className="text-3xl font-bold text-emerald-700">{quotedItems}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">AI抽出</div>
            <div className="text-3xl font-bold text-violet-700">{aiItems}</div>
          </div>
        </div>

        {/* ── フィルターバー ───────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* 検索 */}
          <form method="GET" className="flex gap-2 flex-1 min-w-[200px] max-w-xs">
            <input
              type="text"
              name="q"
              defaultValue={filterSearch}
              placeholder="商品名・ブランド・顧客名で検索"
              className="h-8 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            {filterCondition && <input type="hidden" name="condition" value={filterCondition} />}
            {filterQuote && <input type="hidden" name="quote" value="1" />}
            <button type="submit" className="h-8 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700">
              検索
            </button>
          </form>

          {/* 状態フィルター */}
          <div className="flex flex-wrap gap-1.5">
            {filterCondition || filterQuote || filterSearch ? (
              <Link
                href="/items"
                className="flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
              >
                ✕ フィルター解除
              </Link>
            ) : null}
            {(["N","S","A","B","C","D","J"] as InquiryItemCondition[]).map((c) => (
              <Link
                key={c}
                href={`/items?condition=${c}${filterSearch ? `&q=${encodeURIComponent(filterSearch)}` : ""}`}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${
                  filterCondition === c
                    ? CONDITION_COLORS[c] + " border-current"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {c}
              </Link>
            ))}
            <Link
              href={`/items?quote=1${filterSearch ? `&q=${encodeURIComponent(filterSearch)}` : ""}`}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${
                filterQuote
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              💰 事前査定あり
            </Link>
          </div>
        </div>

        {/* ── 結果件数 ─────────────────────────────────────── */}
        <p className="mb-3 text-xs text-zinc-500">
          {filtered.length} 件表示
          {filtered.length < totalItems ? ` / 全 ${totalItems} 件` : ""}
        </p>

        {/* ── 商品テーブル ─────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            商品が見つかりませんでした
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                  <th className="px-4 py-2.5 text-left font-medium">商品名</th>
                  <th className="px-4 py-2.5 text-left font-medium">状態</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">ブランド / 型番</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">事前査定額</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">顧客</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">チャネル</th>
                  <th className="px-4 py-2.5 text-right font-medium">日付</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((item) => {
                  const quoteStr = formatQuote(
                    item.quote_type as QuoteType | null,
                    item.quote_price_min,
                    item.quote_price_max,
                  );
                  const condVal = item.condition as InquiryItemCondition | null;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors">
                      {/* 商品名 */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-800">{item.item_name}</div>
                        {item.accessories && (
                          <div className="text-[11px] text-zinc-400 mt-0.5">📦 {item.accessories}</div>
                        )}
                        {item.ai_extracted && (
                          <span className="mt-0.5 inline-block rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600">AI</span>
                        )}
                      </td>

                      {/* 状態 */}
                      <td className="px-4 py-3">
                        {condVal ? (
                          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${CONDITION_COLORS[condVal]}`}>
                            {condVal}
                            <span className="ml-1 font-normal hidden xl:inline">{CONDITION_LABELS[condVal]}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* ブランド/型番 */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-xs text-zinc-700">{item.brand ?? "—"}</div>
                        {item.model_number && (
                          <div className="text-[11px] text-zinc-400">{item.model_number}</div>
                        )}
                      </td>

                      {/* 事前査定額 */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {quoteStr ? (
                          <span className="text-sm font-medium text-emerald-700">{quoteStr}</span>
                        ) : (
                          <span className="text-zinc-300 text-xs">未査定</span>
                        )}
                      </td>

                      {/* 顧客 */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {item.lead_id ? (
                          <Link
                            href={`/leads/${item.lead_id}`}
                            className="text-xs text-violet-700 hover:underline font-medium"
                          >
                            {item.lead_name ?? "名前未登録"}
                          </Link>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      {/* チャネル */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {item.inquiry_channel ? (
                          <Link href={`/inbox?id=${item.inquiry_id}`} className="inline-flex items-center gap-1 hover:opacity-80">
                            <ChannelBadge channel={item.inquiry_channel as Parameters<typeof ChannelBadge>[0]["channel"]} />
                            {item.inquiry_subject && (
                              <span className="text-[11px] text-zinc-500 truncate max-w-[100px]">{item.inquiry_subject}</span>
                            )}
                          </Link>
                        ) : null}
                      </td>

                      {/* 日付 */}
                      <td className="px-4 py-3 text-right text-[11px] text-zinc-400 whitespace-nowrap">
                        {new Intl.DateTimeFormat("ja-JP", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(item.created_at))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
