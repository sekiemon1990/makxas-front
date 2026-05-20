/**
 * PR43: 引継ぎノート生成ボタン
 *
 * 反響詳細パネルから AI に引継ぎノートを生成させ、モーダル表示。
 * コピーボタンで Chatwork やメモ帳に貼り付け可能。
 */
"use client";

import { useState } from "react";
import { ClipboardCheck, Copy, FileText, X } from "lucide-react";

export function HandoverSummaryButton({ inquiryId }: { inquiryId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setSummary(null);
    setOpen(true);
    try {
      const r = await fetch("/api/ai/handover-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inquiry_id: inquiryId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "生成失敗");
      } else {
        setSummary(d.summary ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失敗");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50 transition-colors"
        title="次の担当者向けに引継ぎノートを AI 生成"
      >
        <FileText className="size-3" />
        {loading ? "生成中..." : "引継ぎノート"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="size-4 text-cyan-700" />
                引継ぎノート (AI生成)
              </h2>
              <div className="flex items-center gap-2">
                {summary ? (
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs hover:bg-zinc-50"
                  >
                    {copied ? (
                      <>
                        <ClipboardCheck className="size-3.5 text-emerald-600" />
                        コピー済
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        コピー
                      </>
                    )}
                  </button>
                ) : null}
                <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="text-zinc-500 hover:text-zinc-700">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {loading ? (
                <p className="text-sm text-zinc-500">AI が会話履歴を要約しています…</p>
              ) : error ? (
                <p className="text-sm text-red-600">生成失敗: {error}</p>
              ) : summary ? (
                <pre className="whitespace-pre-wrap text-sm text-zinc-800 font-sans">{summary}</pre>
              ) : null}
            </div>
            <div className="border-t border-zinc-100 px-5 py-3 text-[10px] text-zinc-400">
              ※ AI生成のサマリーです。Chatworkで担当者にコピペで共有可能。
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
