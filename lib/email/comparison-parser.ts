/**
 * 比較サイト（おいくら・ウリドキ・ヒカカク）からの通知メールを
 * Anthropic Claude で構造化データに変換する。
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ComparisonSite = "oikura" | "uridoki" | "hikakaku";

export type ParsedInquiry = {
  /** 顧客氏名 */
  customerName: string | null;
  /** 電話番号 */
  phone: string | null;
  /** メールアドレス */
  email: string | null;
  /** 住所 */
  address: string | null;
  /** 品目カテゴリ */
  itemCategory: string | null;
  /** 品物の説明 */
  itemDescription: string | null;
  /** 見込み査定金額（円） */
  estimatedPrice: number | null;
  /** 訪問/宅配 */
  preferredMethod: "visit" | "delivery" | null;
  /** 希望日時（テキスト形式） */
  preferredDate: string | null;
  /** 比較サイト内の問い合わせID */
  siteInquiryId: string | null;
  /** 備考 */
  notes: string | null;
};

/** 送信元ドメインから比較サイトを判定する */
export function detectSiteFromSender(from: string): ComparisonSite | null {
  const lower = from.toLowerCase();
  if (lower.includes("oikura") || lower.includes("おいくら") || lower.includes("kaitori.oikura")) return "oikura";
  if (lower.includes("uridoki") || lower.includes("ウリドキ")) return "uridoki";
  if (lower.includes("hikakaku") || lower.includes("ヒカカク")) return "hikakaku";
  return null;
}

/** 件名から比較サイトを判定する（送信元で判定できない場合のフォールバック） */
export function detectSiteFromSubject(subject: string): ComparisonSite | null {
  const lower = subject.toLowerCase();
  if (lower.includes("おいくら") || lower.includes("oikura")) return "oikura";
  if (lower.includes("ウリドキ") || lower.includes("uridoki") || lower.includes("売りドキ")) return "uridoki";
  if (lower.includes("ヒカカク") || lower.includes("hikakaku") || lower.includes("比較")) return "hikakaku";
  return null;
}

const SITE_LABELS: Record<ComparisonSite, string> = {
  oikura: "おいくら",
  uridoki: "ウリドキ",
  hikakaku: "ヒカカク",
};

/**
 * 比較サイトからの通知メールを解析して構造化データを返す。
 * @param site どの比較サイトかの判定結果
 * @param subject メール件名
 * @param body メール本文
 */
export async function parseComparisonEmail(
  site: ComparisonSite,
  subject: string,
  body: string,
): Promise<ParsedInquiry> {
  const siteLabel = SITE_LABELS[site];

  const prompt = `あなたは買取会社のシステムです。${siteLabel}からの買取依頼通知メールを解析し、顧客情報と商品情報をJSON形式で抽出してください。

## メール件名
${subject}

## メール本文
${body.slice(0, 3000)}

## 抽出するJSON形式
以下のフィールドを抽出してください。不明な場合はnullにする。

{
  "customerName": "顧客氏名（姓名）",
  "phone": "電話番号（ハイフンなしの数字列、例: 09012345678）",
  "email": "メールアドレス",
  "address": "住所（都道府県から）",
  "itemCategory": "品目カテゴリ（貴金属/ブランド品/時計/スマートフォン/PC・タブレット/ゲーム機/カメラ/楽器/骨董品/その他）",
  "itemDescription": "品物の詳細説明（ブランド・型番・状態など）",
  "estimatedPrice": 査定希望金額（円の整数、不明はnull）,
  "preferredMethod": "visit（出張）またはdelivery（宅配）またはnull",
  "preferredDate": "希望日時（テキスト形式、不明はnull）",
  "siteInquiryId": "比較サイト内の問い合わせ・申込ID番号（不明はnull）",
  "notes": "その他の備考・特記事項"
}

JSONのみ返してください。余計な説明は不要です。`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  // JSON を抽出（```json ... ``` ブロックまたは生 JSON に対応）
  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ?? text.match(/(\{[\s\S]+\})/);
  if (!jsonMatch) {
    console.error("comparison-parser: JSON not found in response", text);
    return emptyResult();
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]) as Partial<ParsedInquiry>;
    return {
      customerName: parsed.customerName ?? null,
      phone: normalizePhone(parsed.phone ?? null),
      email: parsed.email ?? null,
      address: parsed.address ?? null,
      itemCategory: parsed.itemCategory ?? null,
      itemDescription: parsed.itemDescription ?? null,
      estimatedPrice: typeof parsed.estimatedPrice === "number" ? parsed.estimatedPrice : null,
      preferredMethod: parsed.preferredMethod ?? null,
      preferredDate: parsed.preferredDate ?? null,
      siteInquiryId: parsed.siteInquiryId ?? null,
      notes: parsed.notes ?? null,
    };
  } catch (e) {
    console.error("comparison-parser: JSON parse error", e, text);
    return emptyResult();
  }
}

function emptyResult(): ParsedInquiry {
  return {
    customerName: null, phone: null, email: null, address: null,
    itemCategory: null, itemDescription: null, estimatedPrice: null,
    preferredMethod: null, preferredDate: null, siteInquiryId: null, notes: null,
  };
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 10 ? digits : null;
}
