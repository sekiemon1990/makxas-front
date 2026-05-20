"use client";

/**
 * UI/UXレビュー D3: グローバル・キーボードショートカット一覧モーダル
 *
 * `?` キー押下でモーダルを開く。Esc または背景クリックで閉じる。
 * フォーム入力中（input/textarea/contenteditable）は反応しない。
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const SHORTCUTS: Array<{ category: string; items: Array<{ keys: string[]; desc: string }> }> = [
  {
    category: "グローバル",
    items: [
      { keys: ["?"], desc: "このショートカット一覧を表示" },
      { keys: ["Esc"], desc: "モーダル・パネルを閉じる" },
    ],
  },
  {
    category: "インボックス",
    items: [
      { keys: ["r"], desc: "返信入力欄にフォーカス" },
      { keys: ["⌘", "Enter"], desc: "返信を送信" },
      { keys: ["←", "→"], desc: "前後の反響に切り替え（モバイル: スワイプ）" },
    ],
  },
  {
    category: "リード・商品一覧",
    items: [
      { keys: ["Tab"], desc: "次の要素にフォーカス（紫枠で表示）" },
      { keys: ["Enter"], desc: "選択中の行を開く" },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // フォーム入力中は無視
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <h2 id="shortcuts-title" className="text-sm font-semibold text-zinc-900">
            キーボードショートカット
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {SHORTCUTS.map((group) => (
            <div key={group.category}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {group.category}
              </p>
              <div className="space-y-1.5">
                {group.items.map((s) => (
                  <div key={s.desc} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1.5 text-[10px] font-medium text-zinc-700"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-100 px-5 py-2.5 text-[10px] text-zinc-400">
          いつでも <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">?</kbd> で開けます
        </div>
      </div>
    </div>
  );
}
