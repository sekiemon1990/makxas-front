"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, GripHorizontal, MessageSquarePlus, X, History, ChevronLeft, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWidgetPageContext } from "@/contexts/WidgetPageContext";
import { ChatPanel } from "./ChatPanel";
import { FeedbackForm } from "./FeedbackForm";
import { useAiChats, type AiChat } from "@/lib/supabase/aiChats";

type Tab = "chat" | "history" | "feedback";

const STORAGE_KEY = "makxas-widget-pos";
const PANEL_W = 380;
const PANEL_H = 560;
const BUTTON_SIZE = 56;
const MARGIN = 24;

type Pos = { x: number; y: number };

const DRAG_THRESHOLD = 5;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function loadPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === "object" && "x" in p && "y" in p) return p as Pos;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultPos(open: boolean): Pos {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - (open ? PANEL_W : BUTTON_SIZE) - MARGIN,
    y: window.innerHeight - (open ? PANEL_H : BUTTON_SIZE) - MARGIN,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export function FloatingWidget({ pageContext: pageContextProp }: { pageContext?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const pathname = usePathname();
  const { widgetPageInfo } = useWidgetPageContext();

  // この画面の履歴
  const { chats, isLoading: chatsLoading } = useAiChats();
  const pageChats = chats.filter((c) => c.pageContext.includes(pathname));

  // 選択中チャットの詳細
  const [selectedChat, setSelectedChat] = useState<AiChat | null>(null);

  // ページコンテキスト: propsで渡された値 > WidgetPageContext > パスから生成
  const pageContext =
    pageContextProp ?? (widgetPageInfo || `makxas-front ${pathname}`);

  // ドラッグ位置管理
  const [pos, setPos] = useState<Pos | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef<Pos>({ x: 0, y: 0 });
  const posRef = useRef<Pos>({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const dragStartPos = useRef<Pos>({ x: 0, y: 0 });
  const justDragged = useRef(false);
  // 開く前のボタン位置を保存（閉じた時に元の位置に戻すため）
  const buttonPosBeforeOpen = useRef<Pos | null>(null);

  useEffect(() => {
    const saved = loadPos();
    if (saved) {
      const c: Pos = {
        x: clamp(saved.x, 0, window.innerWidth - BUTTON_SIZE),
        y: clamp(saved.y, 0, window.innerHeight - BUTTON_SIZE),
      };
      posRef.current = c;
      setPos(c);
    } else {
      const p = defaultPos(false);
      posRef.current = p;
      setPos(p);
    }
  }, []);

  const handleOpen = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      // 開く前のボタン位置を保存
      buttonPosBeforeOpen.current = { ...posRef.current };
      // パネルが画面内に収まるようクランプ
      setPos((prev) => {
        if (!prev) return prev;
        const c: Pos = {
          x: clamp(prev.x, 0, window.innerWidth - PANEL_W),
          y: clamp(prev.y, 0, window.innerHeight - PANEL_H),
        };
        posRef.current = c;
        return c;
      });
    } else {
      // 閉じる時は開く前のボタン位置に戻す
      const restored = buttonPosBeforeOpen.current;
      buttonPosBeforeOpen.current = null;
      if (restored) {
        const c: Pos = {
          x: clamp(restored.x, 0, window.innerWidth - BUTTON_SIZE),
          y: clamp(restored.y, 0, window.innerHeight - BUTTON_SIZE),
        };
        posRef.current = c;
        setPos(c);
      } else {
        setPos((prev) => {
          if (!prev) return prev;
          const c: Pos = {
            x: clamp(prev.x, 0, window.innerWidth - BUTTON_SIZE),
            y: clamp(prev.y, 0, window.innerHeight - BUTTON_SIZE),
          };
          posRef.current = c;
          return c;
        });
      }
      setSelectedChat(null);
    }
  }, []);

  // 閉じた状態のボタン用：mousedown でドラッグ開始を準備
  const onButtonMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    dragging.current = true;
    didDrag.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  }, []);

  // 閉じた状態のボタン用：ドラッグしていなければ開く
  const onButtonClick = useCallback(() => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    handleOpen(true);
  }, [handleOpen]);

  // 開いた状態のヘッダー用：button/link 以外でドラッグ開始
  const onHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button,a")) return;
    e.preventDefault();
    dragging.current = true;
    didDrag.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      // 閾値未満の微小移動はドラッグとみなさない
      if (!didDrag.current) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        didDrag.current = true;
      }
      const next: Pos = {
        x: clamp(
          e.clientX - dragOffset.current.x,
          0,
          window.innerWidth - (open ? PANEL_W : BUTTON_SIZE),
        ),
        y: clamp(
          e.clientY - dragOffset.current.y,
          0,
          window.innerHeight - (open ? PANEL_H : BUTTON_SIZE),
        ),
      };
      posRef.current = next;
      setPos({ ...next });
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      if (didDrag.current) {
        justDragged.current = true;
        didDrag.current = false;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [open]);

  // AIページでは非表示
  if (pathname === "/ai") return null;
  if (!pos) return null;

  return (
    <>
      {/* フローティングボタン（閉じた状態） */}
      {!open ? (
        <button
          aria-label="AIアシスタントを開く"
          className="fixed z-50 flex size-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg transition hover:bg-zinc-800 hover:scale-105"
          onMouseDown={onButtonMouseDown}
          onClick={onButtonClick}
          style={{ left: pos.x, top: pos.y, cursor: "grab" }}
          type="button"
        >
          <Bot className="size-6" />
        </button>
      ) : null}

      {/* ウィジェット本体 */}
      {open ? (
        <div
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
          style={{
            left: pos.x,
            top: pos.y,
            width: Math.min(PANEL_W, typeof window !== "undefined" ? window.innerWidth - 16 : PANEL_W),
            height: Math.min(PANEL_H, typeof window !== "undefined" ? window.innerHeight - 100 : PANEL_H),
          }}
        >
          {/* ヘッダー（ドラッグハンドル） */}
          <div
            className="flex items-center justify-between border-b border-zinc-200 bg-zinc-950 px-4 py-3 select-none shrink-0"
            onMouseDown={onHeaderMouseDown}
            style={{ cursor: "grab" }}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="size-3.5 text-zinc-500 shrink-0" />
              <Bot className="size-4 text-white shrink-0" />
              <span className="text-sm font-semibold text-white">
                AIアシスタント
              </span>
            </div>
            <button
              aria-label="閉じる"
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
              onClick={() => handleOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* タブ */}
          <div className="flex border-b border-zinc-200 shrink-0">
            {(["chat", "history", "feedback"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition",
                  tab === t
                    ? "border-b-2 border-zinc-950 text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
                onClick={() => { setTab(t); setSelectedChat(null); }}
              >
                {t === "chat" && <><Bot className="size-3.5" />AIチャット</>}
                {t === "history" && <><History className="size-3.5" />この画面の履歴</>}
                {t === "feedback" && <><MessageSquarePlus className="size-3.5" />フィードバック</>}
              </button>
            ))}
          </div>

          {/* コンテンツ */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {/* チャット */}
            {tab === "chat" && (
              <ChatPanel fixedHeight="100%" pageContext={pageContext} />
            )}

            {/* この画面の履歴 */}
            {tab === "history" && (
              <div className="h-full flex flex-col overflow-hidden">
                {selectedChat ? (
                  /* 選択チャットの詳細 */
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedChat(null)}
                        className="text-zinc-400 hover:text-zinc-700 transition-colors"
                        aria-label="一覧に戻る"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <span className="text-xs text-zinc-500 flex-1 truncate">{selectedChat.firstQuestion}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
                      {selectedChat.messages.map((msg, i) => (
                          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                            <div className={cn(
                              "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                              msg.role === "user"
                                ? "bg-zinc-950 text-white rounded-tr-sm"
                                : "bg-zinc-100 text-zinc-800 rounded-tl-sm",
                            )}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  /* チャット一覧 */
                  <div className="h-full overflow-y-auto">
                    {chatsLoading ? (
                      <div className="flex items-center justify-center py-8 text-zinc-400">
                        <Loader2 className="size-4 animate-spin mr-2" />
                        <span className="text-xs">読み込み中…</span>
                      </div>
                    ) : pageChats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
                        <History className="size-7 opacity-30" />
                        <p className="text-xs text-center">この画面でのチャット履歴はまだありません</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {pageChats.map((chat) => (
                          <li key={chat.chatId}>
                            <button
                              type="button"
                              onClick={() => setSelectedChat(chat)}
                              className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors"
                            >
                              <p className="text-xs font-medium text-zinc-800 truncate">{chat.firstQuestion || "（質問なし）"}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-400">{formatTime(chat.createdAt)}</span>
                                <span className="text-[10px] text-zinc-400">{chat.messages.length}件のメッセージ</span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* フィードバック */}
            {tab === "feedback" && (
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
