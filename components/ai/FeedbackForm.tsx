"use client";

import { useState, useEffect } from "react";
import { Bug, Lightbulb, MessageSquare, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature" | "improvement" | "other";

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { value: "bug", label: "バグ報告", icon: <Bug className="size-4" /> },
  { value: "feature", label: "機能追加依頼", icon: <Sparkles className="size-4" /> },
  { value: "improvement", label: "改善提案", icon: <Lightbulb className="size-4" /> },
  { value: "other", label: "その他", icon: <MessageSquare className="size-4" /> },
];

const AUTHOR_KEY = "feedback_author_name";

export function FeedbackForm() {
  const [author, setAuthor] = useState("");
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) setAuthor(saved);
  }, []);

  const submit = async () => {
    if (!title.trim() || !body.trim() || loading) return;
    if (author.trim()) localStorage.setItem(AUTHOR_KEY, author.trim());
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          author: author.trim() || null,
          title: title.trim(),
          body: body.trim(),
          page_href: window.location.href,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "送信に失敗しました");
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <p className="text-sm font-medium text-zinc-900">フィードバックを送信しました</p>
        <p className="text-xs text-zinc-500">ご報告ありがとうございます</p>
        <button
          className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-800"
          onClick={() => { setSubmitted(false); setTitle(""); setBody(""); }}
          type="button"
        >
          続けて送る
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* お名前 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">お名前（任意）</label>
        <input
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="例: 田中"
          type="text"
          value={author}
        />
      </div>

      {/* 種別 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">種別</label>
        <div className="grid grid-cols-2 gap-2">
          {FEEDBACK_TYPES.map((ft) => (
            <button
              key={ft.value}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                type === ft.value
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
              )}
              onClick={() => setType(ft.value)}
              type="button"
            >
              {ft.icon}
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {/* タイトル */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">タイトル <span className="text-red-500">*</span></label>
        <input
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 反響一覧が表示されない"
          type="text"
          value={title}
        />
      </div>

      {/* 詳細 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">詳細 <span className="text-red-500">*</span></label>
        <textarea
          className="resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          onChange={(e) => setBody(e.target.value)}
          placeholder="再現手順・期待する動作・スクリーンショットの説明など"
          rows={4}
          value={body}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      ) : null}

      <button
        className="flex items-center justify-center gap-2 rounded-lg bg-zinc-950 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40"
        disabled={!title.trim() || !body.trim() || loading}
        onClick={submit}
        type="button"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        送信する
      </button>
    </div>
  );
}
