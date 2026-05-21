/**
 * PR45: AI品質ダッシュボード
 *
 * 各 AI 機能 (suggest/coaching/extract-items/auto-tag/inquiry-priority/etc) の
 * リクエスト数・コスト・トークン消費・モデル別内訳を可視化。
 *
 * MAKXAS思想：AI 9機能のうちどこが過剰コストか・どこが効いていないかを定量把握。
 */
import { AppShell } from "@/components/app-shell";
import { createServiceClient } from "@/lib/supabase/service";
import { CATEGORY_LABELS } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

type UsageRow = {
  category: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
  created_at: string;
};

const USD_TO_JPY = 155;

function jpy(usd: number): string {
  return `¥${Math.round(usd * USD_TO_JPY).toLocaleString("ja-JP")}`;
}

export default async function AiQualityDashboard() {
  const supabase = createServiceClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows30 } = await (supabase as any)
    .from("api_usage_logs")
    .select("category, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd, created_at")
    .gte("created_at", since30)
    .limit(50000);

  const all30 = (rows30 ?? []) as UsageRow[];
  const all7 = all30.filter((r) => r.created_at >= since7);

  // カテゴリ別集計
  const byCat: Record<string, {
    category: string;
    requests: number;
    input: number;
    output: number;
    cache_creation: number;
    cache_read: number;
    cost: number;
    models: Set<string>;
  }> = {};

  for (const r of all30) {
    if (!byCat[r.category]) {
      byCat[r.category] = {
        category: r.category,
        requests: 0,
        input: 0,
        output: 0,
        cache_creation: 0,
        cache_read: 0,
        cost: 0,
        models: new Set(),
      };
    }
    const c = byCat[r.category];
    c.requests++;
    c.input += r.input_tokens;
    c.output += r.output_tokens;
    c.cache_creation += r.cache_creation_tokens ?? 0;
    c.cache_read += r.cache_read_tokens ?? 0;
    c.cost += Number(r.cost_usd ?? 0);
    c.models.add(r.model);
  }

  const catStats = Object.values(byCat).sort((a, b) => b.cost - a.cost);
  const totalCost30 = all30.reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
  const totalCost7 = all7.reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
  const totalReq30 = all30.length;
  const totalReq7 = all7.length;

  // モデル別集計
  const byModel: Record<string, { model: string; requests: number; cost: number }> = {};
  for (const r of all30) {
    if (!byModel[r.model]) byModel[r.model] = { model: r.model, requests: 0, cost: 0 };
    byModel[r.model].requests++;
    byModel[r.model].cost += Number(r.cost_usd ?? 0);
  }
  const modelStats = Object.values(byModel).sort((a, b) => b.cost - a.cost);

  // 直近7日 vs 過去23日の伸び
  const oldPeriod = all30.filter((r) => r.created_at < since7);
  const oldCost = oldPeriod.reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
  const dailyOld = oldCost / 23;
  const dailyNew = totalCost7 / 7;
  const trendPct = dailyOld > 0 ? Math.round(((dailyNew - dailyOld) / dailyOld) * 100) : null;

  return (
    <AppShell>
      <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold tracking-tight">AI品質・コストダッシュボード</h1>
          <p className="mt-1 text-sm text-zinc-500">過去 30 日間の AI 9 機能の使用状況</p>

          {/* サマリーカード */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">30日コスト</p>
              <p className="text-2xl font-bold text-zinc-900">{jpy(totalCost30)}</p>
              <p className="mt-1 text-[10px] text-zinc-400">${totalCost30.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">7日コスト</p>
              <p className="text-2xl font-bold text-amber-700">{jpy(totalCost7)}</p>
              {trendPct !== null ? (
                <p className={`mt-1 text-[10px] font-semibold ${trendPct > 20 ? "text-red-600" : trendPct < -20 ? "text-emerald-600" : "text-zinc-500"}`}>
                  日次比 {trendPct > 0 ? "+" : ""}{trendPct}%
                </p>
              ) : <p className="mt-1 text-[10px] text-zinc-400">—</p>}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">30日リクエスト</p>
              <p className="text-2xl font-bold text-zinc-900">{totalReq30.toLocaleString("ja-JP")}</p>
              <p className="mt-1 text-[10px] text-zinc-400">直近7日 {totalReq7.toLocaleString("ja-JP")}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">1リクエスト平均</p>
              <p className="text-2xl font-bold text-zinc-900">
                {totalReq30 > 0 ? jpy(totalCost30 / totalReq30) : "—"}
              </p>
              <p className="mt-1 text-[10px] text-zinc-400">直近30日平均</p>
            </div>
          </div>

          {/* カテゴリ別 */}
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">AI機能別 (過去30日)</h2>
            <p className="text-[11px] text-zinc-500">コスト降順</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                    <th className="py-2 pr-3 font-medium">機能</th>
                    <th className="py-2 pr-3 text-right font-medium">リクエスト</th>
                    <th className="py-2 pr-3 text-right font-medium">入力tok</th>
                    <th className="py-2 pr-3 text-right font-medium">出力tok</th>
                    <th className="py-2 pr-3 text-right font-medium">cache読</th>
                    <th className="py-2 pr-3 text-right font-medium">コスト</th>
                    <th className="py-2 pr-3 text-right font-medium">1件あたり</th>
                  </tr>
                </thead>
                <tbody>
                  {catStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-xs text-zinc-400">過去30日に使用記録なし</td>
                    </tr>
                  ) : catStats.map((c) => {
                    const label = (CATEGORY_LABELS as Record<string, string>)[c.category] ?? c.category;
                    const perReq = c.requests > 0 ? c.cost / c.requests : 0;
                    return (
                      <tr key={c.category} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-zinc-800">{label}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{c.requests.toLocaleString("ja-JP")}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-600">{Math.round(c.input / 1000).toLocaleString("ja-JP")}k</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-600">{Math.round(c.output / 1000).toLocaleString("ja-JP")}k</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">
                          {c.cache_read > 0 ? `${Math.round(c.cache_read / 1000).toLocaleString("ja-JP")}k` : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-amber-700">{jpy(c.cost)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-500">{jpy(perReq)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* モデル別 */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">モデル別内訳 (過去30日)</h2>
            <div className="mt-3 space-y-2">
              {modelStats.length === 0 ? (
                <p className="text-xs text-zinc-400">使用記録なし</p>
              ) : modelStats.map((m) => {
                const sharePct = totalCost30 > 0 ? Math.round((m.cost / totalCost30) * 100) : 0;
                return (
                  <div key={m.model} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-mono text-xs text-zinc-700">{m.model}</span>
                      <span className="tabular-nums text-zinc-700">
                        {m.requests.toLocaleString("ja-JP")} req | {jpy(m.cost)} ({sharePct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100">
                      <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${sharePct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-[10px] text-zinc-400">
            ※ コスト換算は $1 = ¥{USD_TO_JPY} 想定。cache読 が増えるほどコスト効率が上がります。
          </p>
        </div>
      </div>
    </AppShell>
  );
}
