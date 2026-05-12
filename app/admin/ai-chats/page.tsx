"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAllAiChats, type AiChat } from "@/lib/supabase/aiChats";
import {
  addTask,
  deleteTask,
  toggleChecked,
  toggleTask,
  useAllAiChatReviews,
  type AiChatReview,
  type ImprovementTask,
} from "@/lib/supabase/aiChatReviews";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  ListTodo,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskRow({
  task,
  chatId,
}: {
  task: ImprovementTask;
  chatId: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1 group">
      <button
        type="button"
        onClick={() => void toggleTask(chatId, task.id)}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border transition",
          task.done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 hover:border-zinc-500",
        )}
      >
        {task.done ? <Check className="size-2.5" /> : null}
      </button>
      <span
        className={cn(
          "flex-1 text-xs",
          task.done ? "line-through text-zinc-400" : "text-zinc-700",
        )}
      >
        {task.text}
      </span>
      <button
        type="button"
        onClick={() => void deleteTask(chatId, task.id)}
        className="opacity-0 group-hover:opacity-100 transition text-zinc-400 hover:text-red-500"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function ChatCard({
  chat,
  review,
}: {
  chat: AiChat;
  review: AiChatReview | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [saving, setSaving] = useState(false);

  const checked = Boolean(review?.checkedAt);
  const tasks = review?.tasks ?? [];

  async function handleCheck() {
    await toggleChecked(chat.chatId);
  }

  async function handleAddTask() {
    const text = newTask.trim();
    if (!text) return;
    setSaving(true);
    await addTask(chat.chatId, text);
    setNewTask("");
    setSaving(false);
    setAddingTask(false);
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white transition",
        checked ? "border-zinc-100" : "border-zinc-200",
      )}
    >
      {/* ヘッダー */}
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => void handleCheck()}
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition",
            checked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 hover:border-zinc-500",
          )}
          title={checked ? "確認済み（クリックで戻す）" : "確認済みにする"}
        >
          {checked ? <Check className="size-3" /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm font-medium",
                checked ? "text-zinc-400 line-through" : "text-zinc-800",
              )}
            >
              {chat.firstQuestion || "（質問なし）"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDate(chat.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Bot className="size-3" />
              {chat.messages.length}件のメッセージ
            </span>
            <span className="truncate max-w-[200px]" title={chat.pageContext}>
              {chat.pageContext}
            </span>
          </div>
          {tasks.length > 0 ? (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-violet-600">
              <ListTodo className="size-3" />
              <span>
                {tasks.filter((t) => t.done).length}/{tasks.length} タスク完了
              </span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-zinc-400 hover:text-zinc-600 transition"
        >
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {/* 展開コンテンツ */}
      {expanded ? (
        <div className="border-t border-zinc-100 px-4 py-3 space-y-4">
          {/* 会話ログ */}
          <div>
            <div className="mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
              会話ログ
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {chat.messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-zinc-950 text-white rounded-tr-sm"
                        : "bg-zinc-100 text-zinc-800 rounded-tl-sm",
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 改善タスク */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                改善タスク
              </div>
              <button
                type="button"
                onClick={() => setAddingTask((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 transition"
              >
                <Plus className="size-3" />
                追加
              </button>
            </div>

            {tasks.length === 0 && !addingTask ? (
              <p className="text-xs text-zinc-400">タスクなし</p>
            ) : null}

            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} chatId={chat.chatId} />
            ))}

            {addingTask ? (
              <div className="mt-2 flex items-center gap-2">
                <Circle className="size-4 shrink-0 text-zinc-300" />
                <input
                  type="text"
                  autoFocus
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAddTask();
                    if (e.key === "Escape") {
                      setAddingTask(false);
                      setNewTask("");
                    }
                  }}
                  placeholder="タスクを入力してEnterで追加"
                  className="flex-1 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300"
                />
                <button
                  type="button"
                  disabled={!newTask.trim() || saving}
                  onClick={() => void handleAddTask()}
                  className="text-xs bg-violet-600 text-white px-2 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-40 transition"
                >
                  {saving ? "…" : "追加"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AiChatsPage() {
  const { chats, isLoading, error } = useAllAiChats();
  const { reviews } = useAllAiChatReviews();
  const [filterChecked, setFilterChecked] = useState<
    "all" | "unchecked" | "checked"
  >("all");

  const filtered = chats.filter((chat) => {
    const review = reviews.get(chat.chatId);
    const checked = Boolean(review?.checkedAt);
    if (filterChecked === "unchecked") return !checked;
    if (filterChecked === "checked") return checked;
    return true;
  });

  const uncheckedCount = chats.filter(
    (c) => !reviews.get(c.chatId)?.checkedAt,
  ).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <Bot className="size-5" />
            AI履歴管理
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            AIとのチャット履歴を確認し、改善タスクを管理します
          </p>
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-2">
          {(
            [
              { value: "all", label: `すべて（${chats.length}）` },
              {
                value: "unchecked",
                label: `未確認${uncheckedCount > 0 ? `（${uncheckedCount}）` : ""}`,
              },
              { value: "checked", label: "確認済み" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilterChecked(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                filterChecked === f.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Bot className="size-6 animate-pulse" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 py-16 text-zinc-400">
            <CheckCircle2 className="size-10 opacity-30" />
            <p className="text-sm">
              {filterChecked === "unchecked"
                ? "未確認のチャットはありません ✅"
                : "チャット履歴がありません"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((chat) => (
              <ChatCard
                key={chat.chatId}
                chat={chat}
                review={reviews.get(chat.chatId)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
