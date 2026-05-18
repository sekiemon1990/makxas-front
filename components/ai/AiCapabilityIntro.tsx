"use client";

/**
 * AI に何ができるかを初見の人にわかりやすく説明する Intro UI。
 *
 * チャットが空の状態（messages.length === 0）の時に表示される。
 * カテゴリ別の「できること」と、すぐに試せる「質問の例」をクリッカブルなチップで提示。
 * チップをクリックすると ChatPanel の textarea に質問が入力される（送信は手動）。
 *
 * makxas-front の AI は Tool Use により以下を実行できる:
 *   - get_summary:  リード・反響・アポ集計
 *   - search_data:  キーワード検索
 */
import { type LucideIcon } from "lucide-react";

export type CapabilityCategory = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  examples: string[];
  /** Tailwind 色クラス */
  tone?: string;
};

type Props = {
  title?: string;
  lead?: string;
  categories: CapabilityCategory[];
  onPickExample?: (example: string) => void;
  compact?: boolean;
};

function fillTextarea(example: string) {
  const els = document.querySelectorAll("textarea");
  const el = els[els.length - 1] as HTMLTextAreaElement | undefined;
  if (!el) return;
  const proto = Object.getPrototypeOf(el) as object;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) descriptor.set.call(el, example);
  else el.value = example;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

export function AiCapabilityIntro({
  title = "AIに何ができる？",
  lead = "下のカテゴリ別に試せる質問があります。クリックで入力欄に挿入され、送信ボタンで実行できます。",
  categories,
  onPickExample,
  compact = false,
}: Props) {
  const handlePick = (example: string) => {
    if (onPickExample) onPickExample(example);
    else fillTextarea(example);
  };

  return (
    <div className={`w-full ${compact ? "px-2 py-3" : "px-4 py-6"}`}>
      <div className={`mx-auto ${compact ? "max-w-full" : "max-w-3xl"} flex flex-col gap-4`}>
        <div className="text-center">
          <h3 className={`font-bold text-zinc-900 ${compact ? "text-sm" : "text-base lg:text-lg"}`}>
            {title}
          </h3>
          <p className={`text-zinc-500 leading-relaxed mt-1 ${compact ? "text-[11px]" : "text-xs lg:text-sm"}`}>
            {lead}
          </p>
        </div>

        <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const tone = cat.tone ?? "text-blue-600 bg-blue-50";
            return (
              <div key={cat.id} className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-zinc-900 ${compact ? "text-xs" : "text-sm"}`}>
                      {cat.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-tight">{cat.description}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {cat.examples.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePick(ex)}
                      className="text-left text-[11px] text-zinc-700 bg-zinc-50 hover:bg-blue-50 hover:text-blue-700 px-2.5 py-1.5 rounded-md border border-zinc-200 transition-colors leading-snug"
                    >
                      💬 {ex}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className={`text-center text-zinc-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          自由な日本語で質問できます。AIが必要に応じてリード・反響データを検索・参照します。
        </p>
      </div>
    </div>
  );
}
