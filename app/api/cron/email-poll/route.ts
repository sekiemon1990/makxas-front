/**
 * Gmail 受信ポーリング cron
 *
 * 処理フロー:
 * 1. email_accounts で purpose='inquiry' & provider='gmail' & is_active=true の全アカウントを取得
 * 2. 各アカウントの未読メールを取得
 * 3. 送信元・件名から比較サイト（おいくら/ウリドキ/ヒカカク）を判定
 * 4. 比較サイトメール → Claude Haiku で構造化抽出 → lead + inquiry + message を作成
 * 5. 一般メール（comparison_account_id なし） → email チャネルとして inquiry + message を作成
 * 6. 処理済みメールは既読にマーク（lib/email/gmail.ts 内で実施）
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchUnreadEmails } from "@/lib/email/gmail";
import {
  detectSiteFromSender,
  detectSiteFromSubject,
  parseComparisonEmail,
  type ComparisonSite,
} from "@/lib/email/comparison-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

type EmailAccountRow = {
  id: string;
  email: string;
  store_id: string | null;
  brand_id: string | null;
  oauth_tokens: Record<string, unknown> | null;
};

type ComparisonAccountRow = {
  id: string;
  site: ComparisonSite;
  store_id: string | null;
  brand_id: string | null;
  notification_email: string | null;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 1. 受信用メールアカウントを取得
  const { data: accounts, error: accErr } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("email_accounts" as any)
    .select("id, email, store_id, brand_id, oauth_tokens")
    .eq("purpose", "inquiry")
    .eq("provider", "gmail")
    .eq("is_active", true);

  if (accErr) {
    console.error("email-poll: fetch accounts error", accErr);
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  const emailAccounts = (accounts ?? []) as unknown as EmailAccountRow[];
  if (emailAccounts.length === 0) {
    return NextResponse.json({ message: "No inquiry Gmail accounts configured", processed: 0 });
  }

  // 2. 比較サイトアカウント一覧（notification_email → アカウント照合用）
  const { data: compAccounts } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("comparison_site_accounts" as any)
    .select("id, site, store_id, brand_id, notification_email")
    .eq("is_active", true);

  const compAccountRows = (compAccounts ?? []) as unknown as ComparisonAccountRow[];

  const results: { account: string; processed: number; errors: number }[] = [];

  for (const account of emailAccounts) {
    if (!account.oauth_tokens?.refresh_token) continue; // 未接続はスキップ

    let processedCount = 0;
    let errorCount = 0;

    try {
      const emails = await fetchUnreadEmails(
        account.id,
        "is:unread",
        30,
      );

      for (const email of emails) {
        try {
          // 比較サイト判定
          const site = detectSiteFromSender(email.from) ?? detectSiteFromSubject(email.subject);
          const compAccount = site
            ? compAccountRows.find(
                (ca) =>
                  ca.site === site &&
                  ca.notification_email?.toLowerCase() === account.email.toLowerCase(),
              )
            : undefined;

          if (site) {
            await processComparisonEmail(supabase, email, site, compAccount, account);
          } else {
            await processGeneralEmail(supabase, email, account);
          }

          processedCount++;
        } catch (e) {
          console.error("email-poll: process email error", email.id, e);
          errorCount++;
        }
      }
    } catch (e) {
      console.error("email-poll: fetch emails error", account.email, e);
      errorCount++;
    }

    results.push({ account: account.email, processed: processedCount, errors: errorCount });
  }

  const totalProcessed = results.reduce((s, r) => s + r.processed, 0);
  console.log("email-poll: done", results);

  return NextResponse.json({ processed: totalProcessed, results });
}

// =============================================================================
// 比較サイトメールの処理
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processComparisonEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  email: Awaited<ReturnType<typeof fetchUnreadEmails>>[number],
  site: ComparisonSite,
  compAccount: ComparisonAccountRow | undefined,
  emailAccount: EmailAccountRow,
) {
  // Claude Haiku でメールを構造化
  const parsed = await parseComparisonEmail(site, email.subject, email.body);

  // リードの作成 or 検索（電話番号 or メールアドレスで照合）
  let leadId: string | null = null;

  if (parsed.phone || parsed.email) {
    const query = supabase.from("leads").select("id").limit(1);
    if (parsed.phone) query.eq("phone", parsed.phone);
    else if (parsed.email) query.eq("email", parsed.email);

    const { data: existing } = await query.maybeSingle();
    leadId = existing?.id ?? null;
  }

  if (!leadId) {
    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        display_name: parsed.customerName ?? "お名前不明",
        phone: parsed.phone ?? null,
        email: parsed.email ?? null,
        first_channel: site,
      })
      .select("id")
      .single();

    if (leadErr) throw leadErr;
    leadId = newLead.id;
  }

  // 反響（inquiry）を作成
  const { data: inquiry, error: inqErr } = await supabase
    .from("inquiries")
    .insert({
      lead_id: leadId,
      channel: site,
      status: "new",
      subject: email.subject,
      internal_note: buildInternalNote(parsed, site),
      comparison_account_id: compAccount?.id ?? null,
      store_id: compAccount?.store_id ?? emailAccount.store_id ?? null,
      brand_id: compAccount?.brand_id ?? emailAccount.brand_id ?? null,
      source_site: site,
    })
    .select("id")
    .single();

  if (inqErr) throw inqErr;

  // メッセージ（本文）を保存
  await supabase.from("messages").insert({
    inquiry_id: inquiry.id,
    direction: "inbound",
    msg_type: "email",
    body: `【${SITE_LABELS[site]}からの買取依頼】\n\n件名: ${email.subject}\n\n${email.body.slice(0, 2000)}`,
  });
}

// =============================================================================
// 一般メールの処理
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processGeneralEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  email: Awaited<ReturnType<typeof fetchUnreadEmails>>[number],
  emailAccount: EmailAccountRow,
) {
  // 送信者のメールアドレスを抽出
  const senderEmail = extractEmailAddress(email.from);

  // リードを検索 or 作成
  let leadId: string | null = null;
  if (senderEmail) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("email", senderEmail)
      .maybeSingle();
    leadId = existing?.id ?? null;
  }

  if (!leadId) {
    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        display_name: extractDisplayName(email.from) ?? "メール問い合わせ",
        email: senderEmail ?? null,
        first_channel: "email",
      })
      .select("id")
      .single();

    if (leadErr) throw leadErr;
    leadId = newLead.id;
  }

  // 反響を作成
  const { data: inquiry, error: inqErr } = await supabase
    .from("inquiries")
    .insert({
      lead_id: leadId,
      channel: "email",
      status: "new",
      subject: email.subject,
      store_id: emailAccount.store_id ?? null,
      brand_id: emailAccount.brand_id ?? null,
    })
    .select("id")
    .single();

  if (inqErr) throw inqErr;

  await supabase.from("messages").insert({
    inquiry_id: inquiry.id,
    direction: "inbound",
    msg_type: "email",
    body: email.body.slice(0, 3000),
    email_msg_id: email.id,
  });
}

// =============================================================================
// ユーティリティ
// =============================================================================

const SITE_LABELS: Record<ComparisonSite, string> = {
  oikura: "おいくら",
  uridoki: "ウリドキ",
  hikakaku: "ヒカカク",
};

function buildInternalNote(
  parsed: Awaited<ReturnType<typeof parseComparisonEmail>>,
  site: ComparisonSite,
): string {
  const lines: string[] = [`【${SITE_LABELS[site]}自動取込】`];
  if (parsed.siteInquiryId) lines.push(`問い合わせID: ${parsed.siteInquiryId}`);
  if (parsed.address) lines.push(`住所: ${parsed.address}`);
  if (parsed.preferredDate) lines.push(`希望日時: ${parsed.preferredDate}`);
  if (parsed.estimatedPrice) lines.push(`希望査定額: ¥${parsed.estimatedPrice.toLocaleString()}`);
  if (parsed.notes) lines.push(`備考: ${parsed.notes}`);
  return lines.join("\n");
}

function extractEmailAddress(from: string): string | null {
  const match = from.match(/<([^>]+)>/) ?? from.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
  return match?.[1] ?? null;
}

function extractDisplayName(from: string): string | null {
  const match = from.match(/^([^<]+)</) ?? from.match(/^([^@]+@)/);
  return match?.[1]?.trim().replace(/["']/g, "") ?? null;
}
