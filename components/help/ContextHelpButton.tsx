"use client";

/**
 * 各画面ヘッダー右上に配置するコンテキストヘルプボタン。
 * 現在パスにマッチする HelpChapter を popover 表示。
 * 「ヘルプセンターで開く」リンクで /help?chapter=<id> へ遷移。
 */
import { HelpCircle, ExternalLink, X as XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findChapterByPath, HELP_CHAPTERS } from "@/lib/help/manual";

export function ContextHelpButton() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const chapter =
    findChapterByPath(pathname) ??
    HELP_CHAPTERS.find((c) => c.id === "overview") ??
    HELP_CHAPTERS[0]!;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
        title="この画面のヘルプ"
        aria-label="この画面のヘルプを開く"
      >
        <HelpCircle size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="コンテキストヘルプ"
          className="absolute right-0 top-full mt-2 w-[360px] max-w-[90vw] bg-white border border-zinc-200 rounded-xl shadow-lg z-50 flex flex-col max-h-[70vh]"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 shrink-0">
            <HelpCircle size={14} className="text-violet-600" />
            <h3 className="text-sm font-semibold text-zinc-900 flex-1">
              {chapter.title}
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 p-1"
              aria-label="閉じる"
            >
              <XIcon size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-zinc-900">
            <article className="leading-relaxed flex flex-col gap-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-base font-bold mt-1 mb-1">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-[13px] font-semibold mt-2 mb-0.5">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => <p className="text-[13px]">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 flex flex-col gap-0.5 text-[13px]">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 flex flex-col gap-0.5 text-[13px]">
                      {children}
                    </ol>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  code: ({ children }) => (
                    <code className="text-violet-700 bg-zinc-100 px-1 rounded text-[12px]">
                      {children}
                    </code>
                  ),
                  hr: () => <hr className="border-zinc-200 my-2" />,
                  table: ({ children }) => (
                    <table className="text-[12px] w-full">{children}</table>
                  ),
                }}
              >
                {chapter.content}
              </ReactMarkdown>
            </article>
          </div>

          <div className="border-t border-zinc-200 px-4 py-2.5 shrink-0">
            <Link
              href={`/help?chapter=${chapter.id}`}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
            >
              ヘルプセンターで開く
              <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
