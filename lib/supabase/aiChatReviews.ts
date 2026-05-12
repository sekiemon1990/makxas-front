"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ImprovementTask = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type AiChatReview = {
  chatId: string;
  checkedAt: string | null;
  tasks: ImprovementTask[];
};

type DbAiChatReview = {
  chat_id: string;
  checked_at: string | null;
  tasks: unknown;
};

function isTask(v: unknown): v is ImprovementTask {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.text === "string" &&
    typeof r.done === "boolean" &&
    typeof r.createdAt === "string"
  );
}

function toReview(row: DbAiChatReview): AiChatReview {
  return {
    chatId: row.chat_id,
    checkedAt: row.checked_at,
    tasks: Array.isArray(row.tasks) ? row.tasks.filter(isTask) : [],
  };
}

async function getReview(chatId: string): Promise<AiChatReview> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("ai_chat_reviews")
    .select("*")
    .eq("chat_id", chatId)
    .single() as { data: DbAiChatReview | null };
  return data
    ? toReview(data)
    : { chatId, checkedAt: null, tasks: [] };
}

export function useAllAiChatReviews(): {
  reviews: Map<string, AiChatReview>;
  isLoading: boolean;
} {
  const [reviews, setReviews] = useState<Map<string, AiChatReview>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchReviews() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("ai_chat_reviews")
        .select("*") as { data: DbAiChatReview[] | null };
      const map = new Map<string, AiChatReview>();
      (data ?? []).forEach((row) => {
        const r = toReview(row);
        map.set(r.chatId, r);
      });
      setReviews(map);
      setIsLoading(false);
    }

    void fetchReviews();

    const channel = supabase
      .channel("ai_chat_reviews_all")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "ai_chat_reviews" }, () => {
        void fetchReviews();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { reviews, isLoading };
}

export async function toggleChecked(chatId: string): Promise<void> {
  const supabase = createClient();
  const current = await getReview(chatId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("ai_chat_reviews").upsert({
    chat_id: chatId,
    checked_at: current.checkedAt ? null : new Date().toISOString(),
    tasks: current.tasks,
  });
}

export async function addTask(chatId: string, text: string): Promise<void> {
  const supabase = createClient();
  const current = await getReview(chatId);
  const task: ImprovementTask = {
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: new Date().toISOString(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("ai_chat_reviews").upsert({
    chat_id: chatId,
    checked_at: current.checkedAt,
    tasks: [...current.tasks, task],
  });
}

export async function toggleTask(chatId: string, taskId: string): Promise<void> {
  const supabase = createClient();
  const current = await getReview(chatId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("ai_chat_reviews").upsert({
    chat_id: chatId,
    checked_at: current.checkedAt,
    tasks: current.tasks.map((t) =>
      t.id === taskId ? { ...t, done: !t.done } : t,
    ),
  });
}

export async function deleteTask(chatId: string, taskId: string): Promise<void> {
  const supabase = createClient();
  const current = await getReview(chatId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("ai_chat_reviews").upsert({
    chat_id: chatId,
    checked_at: current.checkedAt,
    tasks: current.tasks.filter((t) => t.id !== taskId),
  });
}
