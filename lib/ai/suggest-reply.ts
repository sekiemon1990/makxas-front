import Anthropic from "@anthropic-ai/sdk";

import type { createServiceClient } from "@/lib/supabase/service";
import type { Inquiry, MessageDirection } from "@/types/database";

const MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_BRAND_NAME = "買取サービス";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type SuggestReplyMessage = {
  direction: "inbound" | "outbound";
  body: string;
};

export async function suggestReply({
  brandName,
  channel,
  messages,
}: {
  messages: SuggestReplyMessage[];
  brandName: string;
  channel: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const conversation = messages
    .filter((message) => message.body.trim().length > 0)
    .map(
      (message) =>
        `${message.direction === "inbound" ? "顧客" : "担当者"}: ${
          message.body
        }`,
    )
    .join("\n");

  if (!apiKey || !conversation) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `あなたは「${brandName}」の買取インサイドセールス担当です。
顧客からの問い合わせに対して、丁寧かつ簡潔な返信案を1つ作成してください。
- 査定依頼には品物の詳細（種類・ブランド・状態）を聞く
- アポ希望には日程を確認する
- 価格の質問には「査定後にご案内」と伝える
- 返信は150文字以内で自然な日本語で
- 返信文のみを出力し、説明や補足は不要`,
      messages: [
        {
          role: "user",
          content: `チャネル: ${channel}\n会話履歴:\n${conversation}`,
        },
      ],
    });

    const reply = response.content
      .map((content) => (content.type === "text" ? content.text : ""))
      .join("")
      .trim();

    return reply || null;
  } catch (error) {
    console.error("Claude reply suggestion failed", error);
    return null;
  }
}

export async function updateInquirySuggestedReply(
  supabase: ServiceClient,
  inquiryId: string,
) {
  const { data: inquiry, error: inquiryError } = await supabase
    .from("inquiries")
    .select("id, brand_id, store_id, channel")
    .eq("id", inquiryId)
    .maybeSingle();

  if (inquiryError || !inquiry) {
    console.error(
      "AI reply suggestion inquiry fetch failed",
      inquiryError ?? inquiryId,
    );
    return;
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("messages")
    .select("direction, body")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (messagesError) {
    console.error("AI reply suggestion messages fetch failed", messagesError);
    return;
  }

  const messages = (messageRows ?? [])
    .reverse()
    .filter(
      (
        message,
      ): message is {
        direction: Extract<MessageDirection, "inbound" | "outbound">;
        body: string;
      } =>
        (message.direction === "inbound" ||
          message.direction === "outbound") &&
        typeof message.body === "string" &&
        message.body.trim().length > 0,
    )
    .map((message) => ({
      direction: message.direction,
      body: message.body,
    }));

  const brandName = await resolveBrandName(supabase, inquiry);
  const suggestedReply = await suggestReply({
    messages,
    brandName,
    channel: inquiry.channel,
  });

  const { error: updateError } = await supabase
    .from("inquiries")
    .update({ ai_suggested_reply: suggestedReply })
    .eq("id", inquiryId);

  if (updateError) {
    console.error("AI reply suggestion update failed", updateError);
  }
}

async function resolveBrandName(
  supabase: ServiceClient,
  inquiry: Pick<Inquiry, "brand_id" | "store_id">,
) {
  if (inquiry.brand_id) {
    const { data: brand, error } = await supabase
      .from("brands")
      .select("name")
      .eq("id", inquiry.brand_id)
      .maybeSingle();

    if (error) {
      console.error("AI reply suggestion brand fetch failed", error);
    }

    if (brand?.name) return brand.name;
  }

  if (!inquiry.store_id) return DEFAULT_BRAND_NAME;

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("brand_id")
    .eq("id", inquiry.store_id)
    .maybeSingle();

  if (storeError) {
    console.error("AI reply suggestion store fetch failed", storeError);
    return DEFAULT_BRAND_NAME;
  }

  if (!store?.brand_id) return DEFAULT_BRAND_NAME;

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("name")
    .eq("id", store.brand_id)
    .maybeSingle();

  if (brandError) {
    console.error("AI reply suggestion store brand fetch failed", brandError);
  }

  return brand?.name ?? DEFAULT_BRAND_NAME;
}
