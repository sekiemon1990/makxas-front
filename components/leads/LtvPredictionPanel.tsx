/**
 * PR32: LTV予測パネル
 *
 * リード詳細ページの LTVサマリー直下に配置。ボタン押下で AI が今後12ヶ月の
 * 追加買取見込みを推定し、tier・root cause・次のアクションを表示する。
 */
"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

type LtvPrediction = {
  predicted_ltv_12mo?: number;
  confidence?: "high" | "medium" | "low";
  tier?: "platinum" | "gold" | "silver" | "bronze";
  reasoning?: string;
  next_action?: string;
  risk_factors?: string[];
};

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  platinum: { bg: "bg-zinc-700", text: "text-white", label: "💎 PLATINUM" },
  gold: { bg: "bg-amber-500", text: "text-white", label: "🥇 GOLD" },
  silver: { bg: "bg-zinc-300", text: "text-zinc-800", label: "🥈 SILVER" },
  bronze: { bg: "bg-orange-300", text: "text-orange-900", label: "🥉 BRONZE" },
};

export function LtvPredictionPanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LtvPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function predict() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/predict-ltv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "LTV予測失敗");
      } else {
        setResult(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗");
    } finally {
      setLoading(false);
    }
  }

  const tier = result?.tier ? TIER_STYLES[result.tier] : null;

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">🔮 LTV予測（AI推定）</h3>
          <p className="text-[11px] text-indigo-700/80">今後12ヶ月の追加買取見込みを Haiku が推定</p>
        </div>
        {!result ? (
          <button
            type="button"
            onClick={predict}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="size-3.5" />
            {loading ? "推定中..." : "LTVを予測"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-indigo-700 hover:text-indigo-900"
            aria-label="閉じる"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600">予測失敗: {error}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            {tier ? (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${tier.bg} ${tier.text}`}>
                {tier.label}
              </span>
            ) : null}
            {result.predicted_ltv_12mo != null ? (
              <span className="text-2xl font-bold text-indigo-900">
                ¥{result.predicted_ltv_12mo.toLocaleString("ja-JP")}
              </span>
            ) : null}
            <span className="text-[11px] text-indigo-700">
              信頼度: {result.confidence ?? "—"}
            </span>
          </div>
          {result.reasoning ? (
            <p className="text-xs text-zinc-700">
              <span className="font-medium">予測根拠:</span> {result.reasoning}
            </p>
          ) : null}
          {result.next_action ? (
            <div className="rounded-md bg-white border border-emerald-200 px-3 py-2">
              <p className="text-[10px] font-semibold text-emerald-700">💡 推奨アクション</p>
              <p className="mt-0.5 text-xs text-zinc-800">{result.next_action}</p>
            </div>
          ) : null}
          {result.risk_factors && result.risk_factors.length > 0 ? (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
              <p className="text-[10px] font-semibold text-rose-700">⚠️ 失注リスク要因</p>
              <ul className="mt-0.5 space-y-0.5">
                {result.risk_factors.map((r, i) => (
                  <li key={i} className="text-xs text-rose-900">・{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[10px] text-zinc-400">※ AI推定値・参考値として活用</p>
        </div>
      ) : null}
    </div>
  );
}
