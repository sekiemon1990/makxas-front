/**
 * PR40: マルチブランド横断LTVパネル
 *
 * 同一連絡先（電話/メール/LINE）の他リードを横断集計し、全ブランド合算の
 * LTV 関連指標を表示する。
 */
"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";

type BrandStat = {
  brand: string;
  inquiry_count: number;
  appt_count: number;
  completed_count: number;
  high_value_count: number;
  additional_confirmed: number;
  estimated_total: number;
  quoted_total: number;
};
type CrossBrandData = {
  related_lead_count: number;
  totals: {
    brands: number;
    inquiry_count: number;
    appt_count: number;
    completed_count: number;
    high_value_count: number;
    additional_confirmed: number;
    estimated_total: number;
    quoted_total: number;
  };
  by_brand: BrandStat[];
};

export function CrossBrandLtvPanel({ leadId }: { leadId: string }) {
  const [data, setData] = useState<CrossBrandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leads/${leadId}/cross-brand-ltv`)
      .then((r) => r.json())
      .then((d: CrossBrandData & { error?: string }) => {
        if (!d.error) setData(d);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
        <p className="text-xs text-teal-700/80">マルチブランド集計中…</p>
      </div>
    );
  }
  if (!data) return null;

  // ブランド1つ以下なら横断LTVは表示価値が低い
  if (data.totals.brands <= 1 && data.related_lead_count <= 1) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-teal-900 flex items-center gap-1.5">
            <Layers className="size-4" />
            マルチブランド横断LTV
          </h3>
          <p className="text-[11px] text-teal-700/80">
            同一連絡先で {data.related_lead_count} 件のリード・{data.totals.brands} ブランドを集計
          </p>
        </div>
        <div className="rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">
          ¥{(data.totals.quoted_total + data.totals.estimated_total).toLocaleString("ja-JP")}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
          <p className="text-[10px] text-zinc-500">反響数</p>
          <p className="text-lg font-semibold text-zinc-900">{data.totals.inquiry_count}</p>
        </div>
        <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
          <p className="text-[10px] text-zinc-500">アポ数</p>
          <p className="text-lg font-semibold text-amber-700">{data.totals.appt_count}</p>
        </div>
        <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
          <p className="text-[10px] text-zinc-500">成約数</p>
          <p className="text-lg font-semibold text-emerald-700">{data.totals.completed_count}</p>
        </div>
        <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
          <p className="text-[10px] text-zinc-500">高単価品</p>
          <p className="text-lg font-semibold text-rose-700">{data.totals.high_value_count}</p>
        </div>
      </div>

      {data.by_brand.length > 0 ? (
        <div className="mt-3 rounded-lg bg-white border border-zinc-100 overflow-hidden">
          <div className="px-3 py-1.5 bg-zinc-50 text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">
            ブランド別内訳
          </div>
          <div className="divide-y divide-zinc-100">
            {data.by_brand.map((b) => (
              <div key={b.brand} className="px-3 py-2 grid grid-cols-5 gap-2 items-center text-xs">
                <p className="font-medium text-zinc-800 col-span-2 truncate">{b.brand}</p>
                <p className="text-zinc-500 text-center">反響{b.inquiry_count}/アポ{b.appt_count}</p>
                <p className="text-rose-700 text-center">高単価{b.high_value_count}</p>
                <p className="text-emerald-700 text-right tabular-nums">
                  ¥{(b.quoted_total + b.estimated_total).toLocaleString("ja-JP")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-[10px] text-zinc-400">
        ※ 電話/メール/LINEユーザーIDのいずれかが一致するリードを統合集計
      </p>
    </div>
  );
}
