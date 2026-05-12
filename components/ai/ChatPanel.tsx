"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appendAiChatMessage,
  createAiChat,
  type AiChatMessage,
} from "@/lib/supabase/aiChats";

type ChatMessage = { role: "user" | "assistant"; content: string };

function toSavedMessage(m: ChatMessage): AiChatMessage {
  return { ...m, createdAt: new Date().toISOString() };
}

export function ChatPanel({
  pageContext,
  systemExtra,
  fixedHeight = "500px",
  initialMessage,
  onSuggest,
  context,
}: {
  pageContext?: string;
  systemExtra?: string;
  fixedHeight?: string;
  initialMessage?: string;
  onSuggest?: (text: string) => void;
  context?: {
    subject?: string | null;
    channel?: string;
    status?: string;
    customerName?: string | null;
    storeName?: string | null;
    brandName?: string | null;
    recentMessages?: Array<{ direction: string; body: string }>;
    internalNote?: string | null;
    tags?: string[];
  };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialMessage ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Supabase保存用
  const chatIdRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<string | null>>(Promise.resolve(null));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /** チャットメッセージをSupabaseに非同期保存するキュー */
  function enqueueSave(
    message: AiChatMessage,
    opts: { createIfMissing: boolean },
  ): void {
    const task = saveQueueRef.current
      .then(async (queuedId) => {
        const activeChatId = chatIdRef.current ?? queuedId;
        if (activeChatId) {
          await appendAiChatMessage(activeChatId, message);
          return activeChatId;
        }
        if (!opts.createIfMissing) return null;
        const newId = await createAiChat({
          pageContext,
          firstMessage: message,
        });
        chatIdRef.current = newId;
        return newId;
      })
      .catch((e) => {
        console.warn("[ChatPanel] save error:", e);
        return chatIdRef.current;
      });
    saveQueueRef.current = task;
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    // ユーザーメッセージをSupabaseに保存（初回はcreate）
    enqueueSave(toSavedMessage(userMsg), { createIfMissing: true });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, pageContext, systemExtra, context }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "エラーが発生しました");
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply ?? "",
      };
      setMessages([...next, assistantMsg]);

      // AIの応答をSupabaseに保存（createIfMissing=falseでユーザーメッセージ後にのみ追記）
      enqueueSave(toSavedMessage(assistantMsg), { createIfMissing: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white"
      style={{ height: fixedHeight }}
    >
      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
            <Bot className="size-10 text-zinc-300" />
            <p className="text-sm">何でも聞いてください</p>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {msg.role === "assistant" ? (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 mt-0.5">
                  <Bot className="size-4 text-zinc-600" />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-zinc-100 px-4 py-2.5 text-sm leading-6 text-zinc-900 whitespace-pre-wrap">
                  {msg.content}
                  {onSuggest ? (
                    <button
                      className="mt-2 block text-xs text-zinc-500 underline hover:text-zinc-800"
                      onClick={() => onSuggest(msg.content)}
                      type="button"
                    >
                      返信欄にコピー
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-zinc-950 px-4 py-2.5 text-sm leading-6 text-white whitespace-pre-wrap">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading ? (
          <div className="flex items-start gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100">
              <Bot className="size-4 text-zinc-600" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              考え中…
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t border-zinc-200 p-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="メッセージを入力（Enter送信 / Shift+Enter改行）"
            rows={2}
            value={input}
          />
          <button
            className="flex shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-3 text-white transition hover:bg-zinc-800 disabled:opacity-40"
            disabled={!input.trim() || loading}
            onClick={() => void send()}
            type="button"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
