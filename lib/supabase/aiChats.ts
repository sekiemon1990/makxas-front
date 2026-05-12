"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ローカルの匿名ID（Supabase Auth未ログイン時のフォールバック）
function getOrCreateAnonymousId(): string {
  if (typeof window === "undefined") return "server";
  const key = "makxas_anon_uid";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? getOrCreateAnonymousId();
  } catch {
    return getOrCreateAnonymousId();
  }
}

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AiChat = {
  chatId: string;
  userId: string;
  pageContext: string;
  recordingId: string | null;
  firstQuestion: string;
  messages: AiChatMessage[];
  createdAt: string;
  updatedAt: string;
};

type DbAiChat = {
  chat_id: string;
  user_id: string;
  page_context: string;
  recording_id: string | null;
  first_question: string;
  messages: unknown;
  created_at: string;
  updated_at: string;
};

function isAiChatMessage(value: unknown): value is AiChatMessage {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    (r.role === "user" || r.role === "assistant") &&
    typeof r.content === "string" &&
    typeof r.createdAt === "string"
  );
}

function normalizeMessages(value: unknown): AiChatMessage[] {
  return Array.isArray(value) ? value.filter(isAiChatMessage) : [];
}

function toAiChat(row: DbAiChat): AiChat {
  return {
    chatId: row.chat_id,
    userId: row.user_id,
    pageContext: row.page_context,
    recordingId: row.recording_id,
    firstQuestion: row.first_question,
    messages: normalizeMessages(row.messages),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CreateAiChatInput = {
  pageContext?: string;
  recordingId?: string | null;
  firstMessage: AiChatMessage;
};

export async function createAiChat(input: CreateAiChatInput): Promise<string> {
  const supabase = createClient();
  const chatId = crypto.randomUUID();
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("ai_chats").insert({
    chat_id: chatId,
    user_id: userId,
    page_context: input.pageContext ?? "不明なページ",
    recording_id: input.recordingId ?? null,
    first_question: input.firstMessage.content.slice(0, 100),
    messages: [input.firstMessage],
  });
  if (error) throw error;
  return chatId;
}

export async function appendAiChatMessage(
  chatId: string,
  message: AiChatMessage,
): Promise<void> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: fetchError } = await (supabase as any)
    .from("ai_chats")
    .select("messages")
    .eq("chat_id", chatId)
    .single() as { data: { messages: unknown } | null; error: { message: string } | null };
  if (fetchError) throw fetchError;
  const currentMessages = normalizeMessages(data?.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("ai_chats")
    .update({ messages: [...currentMessages, message] })
    .eq("chat_id", chatId);
  if (error) throw error;
}

export function useAiChats(): {
  chats: AiChat[];
  isLoading: boolean;
  error: string | null;
} {
  const [chats, setChats] = useState<AiChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let userId = "";

    async function fetchChats() {
      if (!userId) userId = await getCurrentUserId();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from("ai_chats")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100) as { data: DbAiChat[] | null; error: { message: string } | null };
      if (fetchError) {
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }
      setChats((data ?? []).map(toAiChat));
      setIsLoading(false);
    }

    void fetchChats();

    // Realtime subscription
    const channel = supabase
      .channel("ai_chats_user")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "ai_chats" }, () => {
        void fetchChats();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { chats, isLoading, error };
}

export function useAllAiChats(): {
  chats: AiChat[];
  isLoading: boolean;
  error: string | null;
} {
  const [chats, setChats] = useState<AiChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchAllChats() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from("ai_chats")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500) as { data: DbAiChat[] | null; error: { message: string } | null };
      if (fetchError) {
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }
      setChats((data ?? []).map(toAiChat));
      setIsLoading(false);
    }

    void fetchAllChats();

    const channel = supabase
      .channel("ai_chats_all")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "ai_chats" }, () => {
        void fetchAllChats();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { chats, isLoading, error };
}
