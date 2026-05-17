/**
 * Gmail API クライアント
 * email_accounts.oauth_tokens に保存された OAuth トークンを使い
 * Gmail の受信メールを取得する。
 */

import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase/service";

export type GmailMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: Date;
  snippet: string;
};

type OAuthTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
};

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_EMAIL_CLIENT_ID,
    process.env.GOOGLE_EMAIL_CLIENT_SECRET,
    process.env.GOOGLE_EMAIL_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
  );
}

/**
 * email_accounts テーブルのトークンを使い、未読メールを取得する。
 * 取得後は既読にマークする。
 * @param emailAccountId email_accounts.id
 * @param query Gmail 検索クエリ（デフォルト: "is:unread"）
 * @param maxResults 最大取得件数（デフォルト: 20）
 */
export async function fetchUnreadEmails(
  emailAccountId: string,
  query = "is:unread",
  maxResults = 20,
): Promise<GmailMessage[]> {
  const supabase = createServiceClient();

  type AccountRow = { oauth_tokens: OAuthTokens | null; email: string };
  const { data: accountRaw, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("email_accounts" as any)
    .select("oauth_tokens, email")
    .eq("id", emailAccountId)
    .single();

  if (error || !accountRaw) {
    throw new Error(`email_accounts not found: ${emailAccountId}`);
  }

  const account = accountRaw as unknown as AccountRow;
  const tokens = account.oauth_tokens;
  if (!tokens?.refresh_token) {
    throw new Error(`Gmail OAuth not connected for account: ${account.email}`);
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  // トークンが更新されたら DB に保存
  oauth2Client.on("tokens", async (newTokens) => {
    const updated: OAuthTokens = {
      ...tokens,
      access_token: newTokens.access_token ?? tokens.access_token,
      expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
    };
    if (newTokens.refresh_token) updated.refresh_token = newTokens.refresh_token;
    await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("email_accounts" as any)
      .update({ oauth_tokens: updated })
      .eq("id", emailAccountId);
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // メッセージID一覧を取得
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messageIds = listRes.data.messages ?? [];
  if (messageIds.length === 0) return [];

  const messages: GmailMessage[] = [];

  for (const { id } of messageIds) {
    if (!id) continue;
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const payload = msgRes.data.payload;
    if (!payload) continue;

    const headers = payload.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const from = getHeader("From");
    const subject = getHeader("Subject");
    const dateStr = getHeader("Date");
    const receivedAt = dateStr ? new Date(dateStr) : new Date();

    // メール本文を取得（text/plain 優先）
    const body = extractPlainText(payload);

    messages.push({
      id,
      threadId: msgRes.data.threadId ?? "",
      from,
      subject,
      body,
      receivedAt,
      snippet: msgRes.data.snippet ?? "",
    });

    // 既読にマーク
    await gmail.users.messages.modify({
      userId: "me",
      id,
      requestBody: { removeLabelIds: ["UNREAD"] },
    }).catch(() => {
      // 既読マークの失敗は無視（次回ポーリング時に重複処理される可能性があるが許容）
    });
  }

  return messages;
}

/**
 * Gmail OAuth 認可 URL を生成する
 */
export function generateGmailAuthUrl(emailAccountId: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify", // 既読マークのため
    ],
    prompt: "consent",
    state: emailAccountId,
  });
}

/**
 * OAuth コールバックコードをトークンに交換して DB に保存する
 */
export async function exchangeCodeAndSave(
  code: string,
  emailAccountId: string,
): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("refresh_token が取得できませんでした（consent 画面を再表示してください）");
  }

  const supabase = createServiceClient();
  await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("email_accounts" as any)
    .update({
      oauth_tokens: {
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date ?? null,
      },
      provider: "gmail",
    })
    .eq("id", emailAccountId);
}

// ========== ユーティリティ ==========

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

function extractPlainText(payload: GmailPart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  // text/plain がなければ text/html から取得してタグを除去
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf-8");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}
