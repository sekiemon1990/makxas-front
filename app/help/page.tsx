"use client";

/**
 * ヘルプ専用ページ /help
 *
 * 左サイドバー: カテゴリ別目次
 * 検索バー: 全章を全文検索
 * 右側: 選択章を Markdown レンダリング
 * 「チュートリアルを再生」ボタンで初回ガイドを再表示可能
 */
import {
  HELP_CHAPTERS,
  HELP_CATEGORY_LABELS,
  searchChapters,
  type HelpChapter,
} from "@/lib/help/manual";
import { BookOpen, Search as SearchIcon, X as XIcon, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resetTutorial } from "@/components/help/OnboardingTutorial";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(HELP_CHAPTERS[0]!.id);
  const searchParams = useSearchParams();

  useEffect(() => {
    const param = searchParams?.get("chapter");
    if (param && HELP_CHAPTERS.some((c) => c.id === param)) {
      setSelectedId(param);
    }
  }, [searchParams]);

  const filteredChapters = useMemo(() => searchChapters(query), [query]);
  const visibleChapters =
    filteredChapters.length > 0 ? filteredChapters : HELP_CHAPTERS;
  const effectiveSelected =
    visibleChapters.find((c) => c.id === selectedId) ?? visibleChapters[0]!;

  const groupedByCategory = useMemo(() => {
    const groups = new Map<HelpChapter["category"], HelpChapter[]>();
    for (const ch of visibleChapters) {
      const arr = groups.get(ch.category) ?? [];
      arr.push(ch);
      groups.set(ch.category, arr);
    }
    return groups;
  }, [visibleChapters]);

  function replayTutorial() {
    resetTutorial();
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <BookOpen size={22} className="text-violet-600" />
            ヘルプ・使い方ガイド
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            インサイドセールスシステムの機能・操作方法を一覧で確認できます。
          </p>
        </div>
        <button
          type="button"
          onClick={replayTutorial}
          className="inline-flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-md transition-colors"
        >
          <Play size={12} />
          チュートリアルを再生
        </button>
      </header>

      <div className="relative">
        <SearchIcon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="機能名・キーワードで検索 (例: AI 優先度、インボックス)"
          className="w-full pl-9 pr-9 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-violet-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

      {query && (
        <p className="text-xs text-zinc-500">{filteredChapters.length}件ヒット</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col gap-3 self-start sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {Array.from(groupedByCategory.entries()).map(([cat, chapters]) => (
            <div key={cat} className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-2 mt-1">
                {HELP_CATEGORY_LABELS[cat]}
              </p>
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedId(ch.id)}
                  className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                    effectiveSelected.id === ch.id
                      ? "bg-violet-50 text-violet-700 font-semibold"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="bg-white border border-zinc-200 rounded-xl p-5 lg:p-7">
          <article className="text-zinc-900 leading-relaxed text-sm lg:text-[15px] flex flex-col gap-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl lg:text-2xl font-bold text-zinc-900 mt-2 mb-3 pb-2 border-b border-zinc-200">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base lg:text-lg font-bold text-zinc-900 mt-5 mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm lg:text-base font-semibold text-zinc-900 mt-4 mb-1.5">
                    {children}
                  </h3>
                ),
                p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 flex flex-col gap-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 flex flex-col gap-1">{children}</ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="text-violet-700 bg-zinc-100 px-1 py-0.5 rounded text-[0.9em]">
                    {children}
                  </code>
                ),
                a: ({ children, href }) => (
                  <a href={href} className="text-violet-600 underline hover:no-underline">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="w-full text-sm border border-zinc-200 rounded-md">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-zinc-50">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left font-semibold border-b border-zinc-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border-b border-zinc-200">{children}</td>
                ),
                hr: () => <hr className="border-zinc-200 my-3" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-violet-500 pl-3 py-1 text-zinc-600 italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {effectiveSelected.content}
            </ReactMarkdown>
          </article>

          {effectiveSelected.tags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-400">タグ:</span>
              {effectiveSelected.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className="text-[11px] text-zinc-500 bg-zinc-50 hover:bg-violet-50 hover:text-violet-700 px-2 py-0.5 rounded-full transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
