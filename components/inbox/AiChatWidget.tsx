"use client";

import { useRef, useState } from "react";
import { Bot, ChevronDown, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { InquiryWithLead, Message } from "@/types/database";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AiChatWidget({
  inquiry,
  messages: threadMessages,
}: {
  inquiry: InquiryWithLead | null;
  messages: Message[];
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    setInput("");
    setLoading(true);

    const context = inquiry
      ? {
          subject: inquiry.subject,
          channel: inquiry.channel,
          status: inquiry.status,
          customerName:
            inquiry.leads?.display_name ??
            inquiry.leads?.phone ??
            inquiry.leads?.email,
          storeName: inquiry.stores?.name,
          brandName: inquiry.brands?.name,
          internalNote: inquiry.internal_note,
          tags: (inquiry.inquiry_tags ?? []).map((t) => t.tag),
          recentMessages: threadMessages
            .slice(-8)
            .map((m) => ({ direction: m.direction, body: m.body ?? "" })),
        }
      : undefined;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory, context }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply ?? "エラーが発生しました。",
      };
      setChatHistory([...nextHistory, assistantMsg]);
    } catch {
      setChatHistory([
        ...nextHistory,
        { role: "assistant", content: "通信エラーが発生しました。" },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
      {open ? (
        <div className="flex h-[min(480px,calc(100vh-6rem))] w-[min(360px,calc(100vw-2rem))] flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl">
          {/* ヘッダー */}
          <div className="flex items-center justify-between rounded-t-2xl bg-zinc-950 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <Bot className="size-4" aria-hidden="true" />
              <span className="text-sm font-semibold">AI アシスタント</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setChatHistory([])}
                title="会話をリセット"
                type="button"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                className="rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* 会話エリア */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {chatHistory.length === 0 ? (
              <div className="space-y-2">
                <p className="text-center text-xs text-zinc-400">
                  現在の反響について何でも聞いてください
                </p>
                {[
                  "この会話を要約して",
                  "返信案を作って",
                  "次にすべきアクションは？",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-600 hover:bg-zinc-50"
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="space-y-3">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-5",
                      msg.role === "user"
                        ? "bg-zinc-950 text-white"
                        : "border border-zinc-200 bg-zinc-50 text-zinc-900",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-400">
                    考え中...
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* 入力エリア */}
          <div className="border-t border-zinc-200 p-3">
            <div className="flex gap-2">
              <Textarea
                className="min-h-0 h-9 resize-none bg-white text-base md:text-xs leading-5 py-2"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="メッセージを入力（Enter で送信）"
                value={input}
              />
              <Button
                className="size-9 shrink-0"
                disabled={!input.trim() || loading}
                onClick={sendMessage}
                size="icon"
                type="button"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="flex size-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg transition hover:bg-zinc-800"
          onClick={() => setOpen(true)}
          type="button"
          title="AI アシスタント"
        >
          <Bot className="size-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
