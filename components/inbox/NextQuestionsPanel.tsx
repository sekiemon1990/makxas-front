/**
 * PR29: 次の質問予測パネル
 *
 * 顧客が次に聞きそうな質問を 3 件予測表示し、推奨回答も併記する。
 * 対応漏れ防止 + 先回り提案で応答品質を上げる。
 */
"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

type NextQuestion = { q: string; why?: string; suggested_reply?: string };

export function NextQuestionsPanel({ inquiryId }: { inquiryId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<NextQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchPredictions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/next-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inquiry_id: inquiryId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "予測失敗");
      } else {
        setQuestions(d.questions ?? []);
        setOpen(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "予測失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={fetchPredictions}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
        title="顧客が次に聞きそうな質問をAIが予測"
      >
        <Sparkles className="size-3" />
        {loading ? "予測中..." : "次の質問予測"}
      </button>

      {open && questions ? (
        <div className="border-b border-violet-200 bg-violet-50/40">
          <div className="px-5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-violet-900">
                💭 顧客が次に聞きそうな質問（対応漏れ予測）
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-violet-700 hover:text-violet-900"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {questions.length === 0 ? (
              <p className="text-[11px] text-zinc-500">予測候補なし</p>
            ) : (
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-violet-200 bg-white px-2.5 py-2 text-[11px]"
                  >
                    <p className="font-medium text-zinc-800">Q. {q.q}</p>
                    {q.why ? (
                      <p className="mt-0.5 text-[10px] text-zinc-500">予測根拠: {q.why}</p>
                    ) : null}
                    {q.suggested_reply ? (
                      <p className="mt-1 rounded bg-violet-50 px-2 py-1 text-[10px] text-violet-900">
                        💡 推奨回答: {q.suggested_reply}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-[11px] text-red-700">
          予測失敗: {error}
        </div>
      ) : null}
    </>
  );
}
