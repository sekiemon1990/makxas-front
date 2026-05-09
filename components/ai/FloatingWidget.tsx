"use client";

import { useState } from "react";
import { Bot, MessageSquarePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";
import { FeedbackForm } from "./FeedbackForm";

type Tab = "chat" | "feedback";

export function FloatingWidget({ pageContext }: { pageContext?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <>
      {/* フローティングボタン */}
      {!open ? (
        <button
          className="fixed bottom-20 right-4 z-50 flex size-13 items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg transition hover:bg-zinc-800 md:bottom-6 md:right-6"
          onClick={() => setOpen(true)}
          type="button"
          aria-label="AIアシスタントを開く"
        >
          <Bot className="size-6" />
        </button>
      ) : null}

      {/* ウィジェット本体 */}
      {open ? (
        <div className="fixed bottom-16 right-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl md:bottom-6 md:right-6"
          style={{ width: "min(380px, calc(100vw - 16px))", height: "min(560px, calc(100vh - 100px))" }}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-950 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-5 text-white" />
              <span className="text-sm font-semibold text-white">AIアシスタント</span>
            </div>
            <button
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* タブ */}
          <div className="flex border-b border-zinc-200">
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition",
                tab === "chat"
                  ? "border-b-2 border-zinc-950 text-zinc-950"
                  : "text-zinc-500 hover:text-zinc-700"
              )}
              onClick={() => setTab("chat")}
              type="button"
            >
              <Bot className="size-3.5" />
              AIチャット
            </button>
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition",
                tab === "feedback"
                  ? "border-b-2 border-zinc-950 text-zinc-950"
                  : "text-zinc-500 hover:text-zinc-700"
              )}
              onClick={() => setTab("feedback")}
              type="button"
            >
              <MessageSquarePlus className="size-3.5" />
              フィードバック
            </button>
          </div>

          {/* コンテンツ */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "chat" ? (
              <ChatPanel
                fixedHeight="100%"
                pageContext={pageContext}
              />
            ) : (
              <div className="h-full overflow-y-auto">
                <FeedbackForm />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
