"use client";

import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { InquiryWithLead, Message } from "@/types/database";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AiSuggestPanel({
  open,
  onClose,
  inquiry,
  messages: threadMessages,
  onTranscribe,
  initialDraft,
  initialDraftKey,
  initialThemeName,
}: {
  open: boolean;
  onClose: () => void;
  inquiry: InquiryWithLead | null;
  messages: Message[];
  onTranscribe: (text: string) => void;
  /** テーマチップや自動提案から渡される原案テキスト */
  initialDraft?: string | null;
  /** initialDraft が変わるたびにインクリメントされるキー。変化を検知して履歴をリセットする */
  initialDraftKey?: number;
  /** 表示用テーマ名（例: "価格の目安を伝える"） */
  initialThemeName?: string | null;
}) {
  // 反響IDごとにチャット履歴を保持（コンポーネント生存中はリセットしない）
  const historiesRef = useRef(new Map<string, ChatMessage[]>());
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 最後に適用した draftKey を記録（再適用防止）
  const appliedDraftKeyRef = useRef<number | undefined>(undefined);

  // 反響を切り替えたら対応する履歴をロード
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!inquiry) { setChatHistory([]); return; }
    const hist = historiesRef.current.get(inquiry.id) ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChatHistory(hist);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry?.id]);

  // 新しい原案が届いたら履歴をリセットして原案を初期メッセージとして表示
  useEffect(() => {
    if (
      initialDraft &&
      initialDraftKey !== undefined &&
      initialDraftKey !== appliedDraftKeyRef.current &&
      inquiry
    ) {
      appliedDraftKeyRef.current = initialDraftKey;
      const initial: ChatMessage[] = [{ role: "assistant", content: initialDraft }];
      historiesRef.current.set(inquiry.id, initial);
      setChatHistory(initial);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraftKey]);

  // パネルを開いたら入力欄にフォーカス（原案なし時）
  useEffect(() => {
    if (open && !initialDraft) setTimeout(() => inputRef.current?.focus(), 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateHistory = (msgs: ChatMessage[]) => {
    if (inquiry) historiesRef.current.set(inquiry.id, msgs);
    setChatHistory(msgs);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...chatHistory, userMsg];
    updateHistory(nextHistory);
    setInput("");
    setLoading(true);

    const context = inquiry
      ? {
          subject: inquiry.subject,
          channel: inquiry.channel,
          status: inquiry.status,
          customerName:
            (inquiry.leads as { display_name?: string; phone?: string; email?: string } | null)
              ?.display_name ??
            (inquiry.leads as { phone?: string } | null)?.phone ??
            (inquiry.leads as { email?: string } | null)?.email,
          storeName: (inquiry.stores as { name: string } | null)?.name,
          brandName: (inquiry.brands as { name: string } | null)?.name,
          internalNote: inquiry.internal_note,
          tags: ((inquiry.inquiry_tags as { tag: string }[] | null) ?? []).map((t) => t.tag),
          recentMessages: threadMessages
            .slice(-10)
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
      const reply: ChatMessage = {
        role: "assistant",
        content: data.reply ?? "エラーが発生しました。",
      };
      updateHistory([...nextHistory, reply]);
    } catch {
      updateHistory([
        ...nextHistory,
        { role: "assistant", content: "通信エラーが発生しました。" },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const customerName =
    (inquiry?.leads as { display_name?: string; phone?: string; email?: string } | null)
      ?.display_name ??
    (inquiry?.leads as { phone?: string } | null)?.phone ??
    (inquiry?.leads as { email?: string } | null)?.email ??
    "顧客";

  const brandName = (inquiry?.brands as { name: string } | null)?.name;
  const storeName = (inquiry?.stores as { name: string } | null)?.name;

  // 返信欄への転記（本文をそのまま使う。---ブロックがあれば抽出）
  const handleTranscribe = (content: string) => {
    const m = content.match(/---\n?([\s\S]+?)\n?---/);
    const extracted = m ? m[1].trim() : content.trim();
    onTranscribe(extracted);
  };

  // 原案がある場合の修正クイックプロンプト / ない場合は汎用プロンプト
  const hasDraft = chatHistory.length > 0 && chatHistory[0].role === "assistant";
  const quickPrompts = hasDraft
    ? [
        "もっと短くして",
        "もっとフレンドリーな文体に",
        "絵文字を外して",
        "価格をより具体的に",
      ]
    : ["返信文を作って", "買取相場を教えて", "アポ取得の返信を作って"];

  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-0 z-20 flex w-[340px] flex-col bg-white border-l border-zinc-200 shadow-xl",
        "transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span className="text-sm font-semibold">AI返信アシスト</span>
          {initialThemeName ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
              {initialThemeName}
            </span>
          ) : (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide">
              Claude
            </span>
          )}
        </div>
        <button
          className="rounded p-1 text-white/80 hover:bg-white/20 hover:text-white"
          onClick={onClose}
          type="button"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* コンテキストバー（反響スコープ） */}
      {inquiry ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-violet-100 bg-violet-50 px-3 py-2">
          <span className="text-[10px] font-semibold text-violet-700">把握済み：</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
            👤 {customerName}
          </span>
          {inquiry.subject ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 max-w-[120px] truncate">
              📋 {inquiry.subject}
            </span>
          ) : null}
          {brandName ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
              🏷 {brandName}
            </span>
          ) : storeName ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
              🏪 {storeName}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 原案あり時のヒント */}
      {hasDraft ? (
        <div className="shrink-0 border-b border-violet-100 bg-violet-50/60 px-3 py-1.5">
          <p className="text-[10px] text-violet-600">
            ✦ AI原案を確認してください。修正したい場合は下の入力欄でお伝えください。
            問題なければ「返信欄に転記」で送信準備ができます。
          </p>
        </div>
      ) : null}

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {chatHistory.length === 0 ? (
          <div className="space-y-2">
            <p className="text-center text-xs text-zinc-400">
              {customerName}様の反響についてAIに相談できます
            </p>
            {quickPrompts.map((s) => (
              <button
                key={s}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-600 transition hover:bg-zinc-50 hover:border-violet-300 hover:text-violet-700"
                onClick={() => void sendMessage(s)}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5",
                  msg.role === "user"
                    ? "bg-indigo-500 text-white rounded-br-sm"
                    : "bg-zinc-100 text-zinc-900 rounded-bl-sm",
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {/* 返信欄への転記ボタン（アシスタントの返答すべてに表示） */}
              {msg.role === "assistant" ? (
                <button
                  className="mt-1 flex items-center gap-1 rounded border border-indigo-300 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition hover:bg-indigo-50 active:bg-indigo-100"
                  onClick={() => handleTranscribe(msg.content)}
                  type="button"
                >
                  <CornerDownLeft className="size-3" />
                  返信欄に転記
                </button>
              ) : null}
            </div>
          ))}

          {/* クイック修正ボタン（最後のアシスタントメッセージの後） */}
          {hasDraft && !loading && chatHistory[chatHistory.length - 1]?.role === "assistant" ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickPrompts.map((s) => (
                <button
                  key={s}
                  className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[10px] text-zinc-500 transition hover:border-violet-300 hover:text-violet-700"
                  onClick={() => void sendMessage(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-start">
              <div className="rounded-xl rounded-bl-sm bg-zinc-100 px-3 py-2">
                <div className="flex gap-1 items-center">
                  <span className="size-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-1.5 bg-zinc-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 入力エリア */}
      <div className="shrink-0 border-t border-zinc-200 p-3">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            className="min-h-0 h-9 resize-none bg-white text-xs py-2"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder={hasDraft ? "修正指示を入力（例: もっと短く）Enter で送信" : "AIに質問する（Enter で送信）"}
            value={input}
          />
          <Button
            className="size-9 shrink-0 bg-indigo-500 hover:bg-indigo-600"
            disabled={!input.trim() || loading}
            onClick={() => void sendMessage(input)}
            size="icon"
            type="button"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
