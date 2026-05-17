"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Clock,
  History,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  User,
  Zap,
} from "lucide-react";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { FeedbackForm } from "@/components/ai/FeedbackForm";
import { AppShell } from "@/components/app-shell";
import { useAiChats, type AiChat, type AiChatMessage } from "@/lib/supabase/aiChats";
import { cn } from "@/lib/utils";

type Tab = "chat" | "history" | "feedback";

const EXAMPLE_QUESTIONS = [
  "今日の新着反響を教えて",
  "田中さんという顧客を検索して",
  "今週のアポ取得数を集計して",
  "対応中の反響一覧を見せて",
  "リード登録数の合計を教えて",
  "ステータス別の件数サマリーを出して",
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export default function AiPage() {
  const [tab, setTab] = useState<Tab>("chat");
  const [chatKey, setChatKey] = useState(0);

  return (
    <AppShell>
      <div className="flex h-full flex-col">
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

        {/* タブ */}
        <div className="flex border-b border-zinc-200 bg-white px-4">
          {(["chat", "history", "feedback"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors",
                tab === t
                  ? "border-b-2 border-zinc-950 text-zinc-950"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              {t === "chat" && <><Bot className="size-4" />AIチャット</>}
              {t === "history" && <><History className="size-4" />履歴</>}
              {t === "feedback" && <><MessageSquarePlus className="size-4" />フィードバック</>}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          {/* チャットタブ */}
          {tab === "chat" && (
            <div className="flex h-full min-h-[480px] flex-col gap-4 md:flex-row">
              {/* チャットパネル */}
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
                  <Zap className="size-3.5 text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-900">チャット</span>
                  <button
                    type="button"
                    onClick={() => setChatKey((k) => k + 1)}
                    className="ml-auto rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    会話をリセット
                  </button>
                </div>
                <div className="h-[calc(100%-48px)]">
                  <ChatPanel
                    key={chatKey}
                    fixedHeight="100%"
                    pageContext="AIアシスタントページ"
                  />
                </div>
              </div>

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
                        type="button"
                        className="rounded-lg px-3 py-2 text-left text-xs text-zinc-700 transition hover:bg-zinc-100"
                        onClick={() => {
                          const el = document.querySelector("textarea");
                          if (el) {
                            el.value = q;
                            el.dispatchEvent(new Event("input", { bubbles: true }));
                            el.focus();
                          }
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* 履歴タブ（全画面の履歴を統合表示） */}
          {tab === "history" && <AiChatHistory />}

          {/* フィードバックタブ */}
          {tab === "feedback" && (
            <div className="max-w-xl">
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <FeedbackForm />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AiChatHistory() {
  const { chats, isLoading, error } = useAiChats();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<AiChatMessage[]>([]);
  const requestIdRef = useRef(0);

  const selectedChat = chats.find((c) => c.chatId === selectedChatId) ?? null;

  // chats が更新されたとき選択中チャットのメッセージを同期
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedChatId) return;
    const latest = chats.find((c) => c.chatId === selectedChatId);
    if (!latest) { setSelectedChatId(null); setSelectedMessages([]); return; }
    setSelectedMessages(latest.messages);
  }, [chats, selectedChatId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function selectChat(chat: AiChat) {
    const rid = ++requestIdRef.current;
    setSelectedChatId(chat.chatId);
    if (requestIdRef.current === rid) setSelectedMessages(chat.messages);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* 左：チャット一覧 */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
          <History className="size-3.5 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-900">質問履歴</span>
          {!isLoading && (
            <span className="ml-auto text-xs text-zinc-400 tabular-nums">{chats.length}件</span>
          )}
        </div>
        <div className="p-3">
          {isLoading ? (
            <HistoryListSkeleton />
          ) : error ? (
            <div className="py-8 text-center text-xs text-red-500">
              履歴の読み込みに失敗しました
            </div>
          ) : chats.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              まだ質問履歴がありません
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {chats.map((chat) => (
                <button
                  key={chat.chatId}
                  type="button"
                  onClick={() => selectChat(chat)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selectedChatId === chat.chatId
                      ? "border-zinc-950 bg-zinc-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <Clock className="size-2.5" />
                    <span>{formatTime(chat.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-800">
                    {chat.firstQuestion || "（質問なし）"}
                  </p>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-zinc-400">
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <MessageSquare className="size-2.5" />
                      {chat.messages.length}件
                    </span>
                    <span className="truncate">・{chat.pageContext}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 右：会話全文 */}
      <section className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {selectedChat ? (
          <>
            <div className="shrink-0 border-b border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-3.5 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-900">会話全文</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                <span>{formatTime(selectedChat.createdAt)}</span>
                <span>{selectedChat.pageContext}</span>
              </div>
            </div>

            {selectedMessages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-zinc-400">
                メッセージがありません
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
                {selectedMessages.map((msg, i) => (
                  <HistoryMessageBubble key={`${msg.createdAt}-${i}`} message={msg} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-zinc-400">
            <History className="size-8 opacity-30" />
            <p className="text-sm">履歴を選択すると会話全文を表示します</p>
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-zinc-200 p-3">
          <div className="h-3 w-28 rounded bg-zinc-200" />
          <div className="mt-2 h-4 w-full rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-40 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

function HistoryMessageBubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-500",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-zinc-950 text-white"
            : "rounded-tl-sm bg-zinc-100 text-zinc-800",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
