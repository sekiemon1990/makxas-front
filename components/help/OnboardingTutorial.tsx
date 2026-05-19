"use client";

/**
 * 初回ログイン時に自動表示されるチュートリアルモーダル。
 * 「もう表示しない」(デフォルト ON) で localStorage に保存し以降非表示。
 * /help ページから resetTutorial() で再表示可能。
 */
import { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  Inbox,
  Sparkles,
  X as XIcon,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "makxas-front-tutorial-seen";

type Step = {
  icon: typeof BookOpen;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: BookOpen,
    title: "ようこそ makxas インサイドセールスへ",
    description:
      "全買取ブランドの反響を一元管理するシステムです。AI が返信案・優先度判定・学習を支援します。",
  },
  {
    icon: Inbox,
    title: "インボックスで反響を即対応",
    description:
      "サイドメニュー「インボックス」から全チャネルの反響を一覧で確認できます。AI 優先度バッジで対応順を素早く判断。「一括判定」で未判定の反響をまとめて AI 判定。",
  },
  {
    icon: Sparkles,
    title: "AI 返信サジェスト",
    description:
      "反響を開くと AI が返信案を自動生成します。編集して送信すると、編集差分が学習データに残り、プロンプトが 7 日ごとに自動改善されます。",
  },
  {
    icon: Bot,
    title: "AI に自然言語で質問",
    description:
      "「今月の反響件数は？」「○○様の対応履歴を要約して」など、自由な日本語で質問できます。画面右下のロボットアイコン、またはサイドメニュー「AIアシスタント」から。",
  },
];

export function OnboardingTutorial() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // ignore
    }
  }, []);

  function close() {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }
    setOpen(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  }
  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!open) return null;

  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="初回チュートリアル"
    >
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "bg-violet-600 w-8"
                    : i < step
                      ? "bg-violet-300 w-4"
                      : "bg-zinc-200 w-4"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded"
            aria-label="チュートリアルを閉じる"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Icon size={32} />
          </div>
          <h2 className="text-lg lg:text-xl font-bold text-zinc-900">
            {current.title}
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-md">
            {current.description}
          </p>
        </div>

        <div className="px-6 pb-5 pt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
            >
              <ArrowLeft size={14} />
              戻る
            </button>
            <span className="text-xs text-zinc-400">
              {step + 1} / {STEPS.length}
            </span>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-md px-3 py-1.5 transition-colors"
            >
              {isLast ? (
                <>
                  はじめる
                  <CheckCircle size={14} />
                </>
              ) : (
                <>
                  次へ
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

          <label className="flex items-center justify-center gap-2 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="accent-violet-600"
            />
            次回から自動表示しない（あとで
            <Link
              href="/help"
              onClick={close}
              className="text-violet-600 hover:underline"
            >
              ヘルプ
            </Link>
            から再表示できます）
          </label>
        </div>
      </div>
    </div>
  );
}

export function resetTutorial(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
