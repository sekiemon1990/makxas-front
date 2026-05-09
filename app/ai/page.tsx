"use client";

import { useState } from "react";
import { Bot, Zap } from "lucide-react";
import { ChatPanel } from "@/components/ai/ChatPanel";

const EXAMPLE_QUESTIONS = [
  "今日の新着反響を教えて",
  "田中さんという顧客を検索して",
  "今週のアポ取得数を集計して",
  "対応中の反響一覧を見せて",
  "リード登録数の合計を教えて",
  "ステータス別の件数サマリーを出して",
];

export default function AiPage() {
  const [initialMessage, setInitialMessage] = useState("");
  const [chatKey, setChatKey] = useState(0);

  const handleExample = (q: string) => {
    setInitialMessage(q);
    setChatKey((k) => k + 1);
  };

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col md:h-screen">
      {/* ヘッダー */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-zinc-950">
            <Bot className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900">AIアシスタント</h1>
            <p className="text-xs text-zinc-500">反響・リード検索、集計、返信文案作成を支援します</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:flex-row md:p-6">
        {/* サイドバー: 例文 */}
        <aside className="shrink-0 md:w-52">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
              <Zap className="size-3.5" />
              よく使う質問
            </div>
            <div className="flex flex-col gap-1">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="rounded-lg px-3 py-2 text-left text-xs text-zinc-700 transition hover:bg-zinc-100"
                  onClick={() => handleExample(q)}
                  type="button"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* チャットパネル */}
        <div className="min-h-0 flex-1">
          <ChatPanel
            key={chatKey}
            fixedHeight="100%"
            initialMessage={initialMessage}
            pageContext="AIアシスタントページ"
          />
        </div>
      </div>
    </div>
  );
}
