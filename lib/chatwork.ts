/**
 * Chatwork 通知ヘルパー。
 *
 * 外部 API トークンは各アプリで持たず、makxas-integrations-gateway の
 * Comms Send endpoint 経由で送信する。
 *
 * 環境変数:
 *   MAKXAS_INTEGRATIONS_GATEWAY_URL
 *   MAKXAS_COMMS_GATEWAY_TOKEN または MAKXAS_GATEWAY_API_KEY_MAKXAS_FRONT
 *   MAKXAS_COMMS_CHATWORK_CHANNEL_ID（未設定時は chatwork_dev_shared）
 *   MAKXAS_COMMS_CHATWORK_ROOM_ID または CHATWORK_ROOM_ID
 *   MAKXAS_COMMS_DRY_RUN=1（任意）
 */

type SendChatworkOptions = {
  roomId?: string;
  selfUnread?: boolean;
};

type SendChatworkResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

type GatewaySendResponse = {
  ok?: boolean;
  audit_id?: string;
  provider_request_id?: string;
  message_id?: string;
  error?: string;
};

export const cw = {
  to(accountId: string | number): string {
    return `[To:${accountId}]`;
  },
  code(value: string): string {
    return `[code]${value}[/code]`;
  },
  info(input: { title: string; body: string } | string, body?: string): string {
    const title = typeof input === "string" ? input : input.title;
    const text = typeof input === "string" ? (body ?? "") : input.body;
    return `[info][title]${title}[/title]${text}[/info]`;
  },
};

function gatewayBaseUrl(): string | null {
  const value = process.env.MAKXAS_INTEGRATIONS_GATEWAY_URL?.trim();
  return value ? value.replace(/\/+$/, "") : null;
}

function gatewayToken(): string | null {
  const value =
    process.env.MAKXAS_COMMS_GATEWAY_TOKEN ??
    process.env.MAKXAS_GATEWAY_API_KEY_MAKXAS_FRONT ??
    process.env.MAKXAS_INTEGRATIONS_GATEWAY_TOKEN;
  return value?.trim() || null;
}

function chatworkChannelId(): string {
  return process.env.MAKXAS_COMMS_CHATWORK_CHANNEL_ID?.trim() || "chatwork_dev_shared";
}

function chatworkRoomId(roomId?: string): string | null {
  const value =
    roomId ??
    process.env.MAKXAS_COMMS_CHATWORK_ROOM_ID ??
    process.env.CHATWORK_ROOM_ID;
  return value?.trim() || null;
}

export function hasChatworkGatewayEnv(options?: { roomId?: string }): boolean {
  return Boolean(gatewayBaseUrl() && gatewayToken() && chatworkRoomId(options?.roomId));
}

export async function sendChatworkMessageOrSkip(
  message: string,
  options?: SendChatworkOptions,
): Promise<SendChatworkResult> {
  const baseUrl = gatewayBaseUrl();
  const token = gatewayToken();
  const roomId = chatworkRoomId(options?.roomId);

  if (!baseUrl || !token || !roomId) {
    return { ok: false, error: "Gateway comms env vars not set" };
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  if (process.env.MAKXAS_COMMS_DRY_RUN === "1") {
    headers["x-dry-run"] = "1";
  }

  const response = await fetch(
    `${baseUrl}/v1/comms/send/${encodeURIComponent(chatworkChannelId())}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipient: { kind: "chatwork_room_id", id: roomId },
        message: { type: "text", text: message },
      }),
    },
  );

  const text = await response.text();
  let payload: GatewaySendResponse = {};
  if (text) {
    try {
      payload = JSON.parse(text) as GatewaySendResponse;
    } catch {
      payload = {};
    }
  }

  if (!response.ok || payload.ok === false) {
    return {
      ok: false,
      error: payload.error || `Gateway comms request failed (${response.status})`,
    };
  }

  return {
    ok: true,
    messageId: payload.provider_request_id ?? payload.audit_id ?? payload.message_id,
  };
}

/**
 * Chatwork にメッセージを送信。
 * - Gateway env 未設定なら no-op
 * - 失敗してもエラーを投げない（送信失敗で業務処理を止めない）
 * - roomId を指定すれば任意のルームへ送信可能
 */
export async function notifyChatwork(
  message: string,
  options?: { roomId?: string; selfUnread?: boolean }
): Promise<void> {
  const result = await sendChatworkMessageOrSkip(message, {
    roomId: options?.roomId,
    selfUnread: options?.selfUnread,
  }).catch((e) => {
    console.error("[gateway-comms] notify failed:", e);
    return { ok: false as const, error: String(e) };
  });

  if (!result.ok) {
    console.error("[gateway-comms] notify failed:", result.error);
  }
}
