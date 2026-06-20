/**
 * マルチチャネル通知送信ライブラリ (PR18)
 *
 * アポ確認メッセージなど、リードへの能動通知を LINE / Email / SMS の
 * いずれか or 複数チャネルで送信する共通モジュール。
 *
 * - LINE: @line/bot-sdk の pushMessage
 * - Email: Resend
 * - SMS: Twilio REST API（Messages リソース）
 *
 * 失敗したチャネルは記録するが、他チャネルの送信は止めない（並列実行）。
 */
import * as line from "@line/bot-sdk";

export type NotificationChannel = "line" | "email" | "sms";

export const DELIVERY_TARGET_TENANT_MISMATCH_ERROR =
  "lead_contact_delivery_target_tenant_mismatch";

export type RecipientInfo = {
  /** Current tenant executing the notification. */
  tenantId?: string | null;
  /** Tenant owner of the lead row, when known. */
  leadTenantId?: string | null;
  /** Tenant owner of the selected lead_contacts row, when known. */
  contactOwnerTenantId?: string | null;
  /** Explicit Gateway-style delivery target owner tenant id. */
  deliveryTargetOwnerTenantId?: string | null;
  /** LINE userId (Uxxxx...) */
  lineUserId?: string | null;
  /** LINE Channel Access Token（テナント別/フォールバック .env LINE_CHANNEL_ACCESS_TOKEN） */
  lineChannelAccessToken?: string | null;
  /** メールアドレス */
  email?: string | null;
  /** 電話番号（E.164 推奨。日本の0発信は +81 に変換） */
  phone?: string | null;
  /** Resend 送信元（"買取マクサス <noreply@example.com>" など） */
  emailFrom?: string;
  /** メール件名 */
  emailSubject?: string;
};

export type SendResult = {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
  detail?: string;
};

export function resolveRecipientOwnerTenantId(
  recipient: Pick<
    RecipientInfo,
    | "tenantId"
    | "leadTenantId"
    | "contactOwnerTenantId"
    | "deliveryTargetOwnerTenantId"
  >,
): string | null {
  return (
    cleanString(recipient.deliveryTargetOwnerTenantId) ??
    cleanString(recipient.contactOwnerTenantId) ??
    cleanString(recipient.leadTenantId) ??
    cleanString(recipient.tenantId)
  );
}

export function hasDeliveryTargetTenantMismatch(
  recipient: Pick<
    RecipientInfo,
    | "tenantId"
    | "leadTenantId"
    | "contactOwnerTenantId"
    | "deliveryTargetOwnerTenantId"
  >,
): boolean {
  const tenantId = cleanString(recipient.tenantId);
  const ownerTenantId = resolveRecipientOwnerTenantId(recipient);
  return Boolean(tenantId && ownerTenantId && tenantId !== ownerTenantId);
}

/**
 * 日本の電話番号を E.164（+81）形式に正規化。
 * 0発信を国コード81に置換。不正な番号は null。
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("0")) return `+81${digits.slice(1)}`;
  if (digits.startsWith("81")) return `+${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^+0-9]/g, "");
  return `+${digits}`;
}

async function sendLine(
  message: string,
  recipient: RecipientInfo,
): Promise<SendResult> {
  if (!recipient.lineUserId) {
    return { channel: "line", ok: false, error: "LINE userId 未登録" };
  }
  const token =
    recipient.lineChannelAccessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { channel: "line", ok: false, error: "LINE channel access token 未設定" };
  }
  try {
    const client = new line.messagingApi.MessagingApiClient({
      channelAccessToken: token,
    });
    await client.pushMessage({
      to: recipient.lineUserId,
      messages: [{ type: "text", text: message }],
    });
    return { channel: "line", ok: true };
  } catch (e) {
    return {
      channel: "line",
      ok: false,
      error: e instanceof Error ? e.message : "LINE送信失敗",
    };
  }
}

async function sendEmail(
  message: string,
  recipient: RecipientInfo,
): Promise<SendResult> {
  if (!recipient.email) {
    return { channel: "email", ok: false, error: "メールアドレス未登録" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { channel: "email", ok: false, error: "RESEND_API_KEY 未設定" };
  }
  const from = recipient.emailFrom ?? "買取マクサス <noreply@makxas.com>";
  const subject = recipient.emailSubject ?? "ご予約のご確認";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient.email],
        subject,
        text: message,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { channel: "email", ok: false, error: `Resend ${res.status}`, detail };
    }
    return { channel: "email", ok: true };
  } catch (e) {
    return {
      channel: "email",
      ok: false,
      error: e instanceof Error ? e.message : "メール送信失敗",
    };
  }
}

async function sendSms(
  message: string,
  recipient: RecipientInfo,
): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    return {
      channel: "sms",
      ok: false,
      error: "Twilio 環境変数未設定 (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)",
    };
  }
  const to = normalizePhone(recipient.phone);
  if (!to) {
    return { channel: "sms", ok: false, error: "電話番号未登録または不正" };
  }
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      return { channel: "sms", ok: false, error: `Twilio ${res.status}`, detail };
    }
    return { channel: "sms", ok: true };
  } catch (e) {
    return {
      channel: "sms",
      ok: false,
      error: e instanceof Error ? e.message : "SMS送信失敗",
    };
  }
}

/**
 * 複数チャネルへ並列送信。
 * 各チャネルの成否を SendResult[] で返す。
 */
export async function sendMultiChannel(
  message: string,
  channels: NotificationChannel[],
  recipient: RecipientInfo,
): Promise<SendResult[]> {
  if (hasDeliveryTargetTenantMismatch(recipient)) {
    return channels.map((channel) => ({
      channel,
      ok: false,
      error: DELIVERY_TARGET_TENANT_MISMATCH_ERROR,
    }));
  }

  const tasks: Promise<SendResult>[] = [];
  for (const ch of channels) {
    if (ch === "line") tasks.push(sendLine(message, recipient));
    else if (ch === "email") tasks.push(sendEmail(message, recipient));
    else if (ch === "sms") tasks.push(sendSms(message, recipient));
  }
  return Promise.all(tasks);
}

function cleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * デフォルトのアポ確認メッセージ生成
 */
export function buildAppointmentConfirmation(args: {
  customerName?: string | null;
  brandName?: string | null;
  scheduledAt: string;
  itemCategory?: string | null;
  address?: string | null;
  preferredMethod?: "visit" | "delivery" | string | null;
}): string {
  const dt = new Date(args.scheduledAt);
  const dtJp = dt.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const brand = args.brandName ?? "買取マクサス";
  const methodLabel =
    args.preferredMethod === "delivery"
      ? "宅配買取"
      : args.preferredMethod === "visit"
      ? "出張買取"
      : "ご予約";
  const lines = [
    `${args.customerName ?? "お客様"}\n`,
    `この度は${brand}にお問い合わせいただきありがとうございます。`,
    `下記内容で${methodLabel}のご予約を承りました。\n`,
    `■ 日時: ${dtJp}`,
  ];
  if (args.itemCategory) lines.push(`■ 品目: ${args.itemCategory}`);
  if (args.address) lines.push(`■ ご住所: ${args.address}`);
  lines.push(
    "",
    "当日は担当者よりお伺いさせていただきます。",
    "ご不明点がございましたらご返信ください。",
    "",
    `${brand}`,
  );
  return lines.join("\n");
}
