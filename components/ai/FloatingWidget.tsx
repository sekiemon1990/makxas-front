"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, GripHorizontal, MessageSquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWidgetPageContext } from "@/contexts/WidgetPageContext";
import { ChatPanel } from "./ChatPanel";
import { FeedbackForm } from "./FeedbackForm";

type Tab = "chat" | "feedback";

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

export function FloatingWidget({ pageContext: pageContextProp }: { pageContext?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const pathname = usePathname();
  const { widgetPageInfo } = useWidgetPageContext();

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
    setPos((prev) => {
      if (!prev) return prev;
      const c: Pos = {
        x: clamp(
          prev.x,
          0,
          window.innerWidth - (nextOpen ? PANEL_W : BUTTON_SIZE),
        ),
        y: clamp(
          prev.y,
          0,
          window.innerHeight - (nextOpen ? PANEL_H : BUTTON_SIZE),
        ),
      };
      posRef.current = c;
      return c;
    });
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
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition",
                tab === "chat"
                  ? "border-b-2 border-zinc-950 text-zinc-950"
                  : "text-zinc-500 hover:text-zinc-700",
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
                  : "text-zinc-500 hover:text-zinc-700",
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
              <ChatPanel fixedHeight="100%" pageContext={pageContext} />
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
