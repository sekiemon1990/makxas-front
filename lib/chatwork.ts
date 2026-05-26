/**
 * Chatwork 通知ヘルパー (SDK ラッパー)
 *
 * 内部実装は @makxas/chatwork-client (SDK) を使用。
 * makxas-front のルート (api/inquiries / api/ai / api/cron 配下) は本 lib 経由で送信する。
 *
 * 環境変数 (SDK が自動参照):
 *   CHATWORK_API_TOKEN - Chatwork API トークン
 *   CHATWORK_ROOM_ID   - デフォルト通知先ルーム ID
 *
 * 未設定なら no-op（送信失敗してもアプリ本体は止めない）。
 */

import {
  cw,
  sendChatworkMessageOrSkip,
} from "@makxas/chatwork-client";

export { cw };

/**
 * Chatwork にメッセージを送信。
 * - CHATWORK_API_TOKEN / CHATWORK_ROOM_ID 未設定なら no-op
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
    console.error("[chatwork] notify failed:", e);
    return { ok: false as const, error: String(e) };
  });

  if (!result.ok) {
    console.error("[chatwork] notify failed:", result.error);
  }
}
