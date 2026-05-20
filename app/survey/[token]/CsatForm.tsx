/**
 * PR42: CSAT アンケートフォーム（クライアントコンポーネント）
 */
"use client";

import { useState } from "react";

export function CsatForm({ token }: { token: string }) {
  const [score, setScore] = useState<number>(0);
  const [nps, setNps] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (score < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/survey/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score, nps, comment }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "送信失敗");
      } else {
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-2xl">✓</p>
        <p className="mt-2 text-sm font-semibold text-emerald-800">送信完了</p>
        <p className="mt-1 text-xs text-emerald-700">ご協力ありがとうございました</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* 満足度（星5） */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-800">
          1. 今回のサービスにどの程度ご満足いただけましたか？
        </p>
        <div className="mt-3 flex justify-between gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`flex-1 rounded-lg border-2 py-2 text-2xl transition-all ${
                score === n
                  ? "border-amber-400 bg-amber-50"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              {n <= score ? "★" : "☆"}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
          <span>不満</span>
          <span>普通</span>
          <span>大変満足</span>
        </div>
      </div>

      {/* NPS（0-10） */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-800">
          2. 友人・知人にこのサービスを薦める可能性は？
        </p>
        <div className="mt-3 grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNps(n)}
              className={`rounded-md border py-2 text-xs font-medium transition-all ${
                nps === n
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
          <span>0 全く薦めない</span>
          <span>10 必ず薦める</span>
        </div>
      </div>

      {/* コメント */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <label htmlFor="comment" className="text-sm font-medium text-zinc-800">
          3. ご意見・ご感想（任意）
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="改善のヒントになります"
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600">送信失敗: {error}</p>
      ) : null}

      <button
        type="submit"
        disabled={score < 1 || submitting}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "送信中..." : "回答を送信"}
      </button>
    </form>
  );
}
