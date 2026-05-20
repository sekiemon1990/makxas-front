/**
 * PR39: LINE リッチメニュー API ヘルパー
 *
 * LINE Messaging API のリッチメニュー機能を扱う。
 * https://developers.line.biz/ja/reference/messaging-api/#rich-menu
 *
 * 提供機能:
 *   - リッチメニュー一覧取得 (LINE 側)
 *   - 個別ユーザーへの紐付け / 解除
 *   - 既定リッチメニュー設定
 *
 * 注意: リッチメニュー画像の作成・アップロードは LINE Official Account Manager の
 *       管理画面で行う想定（API でも可能だが UI 構築コストが大きいため）。
 *       本モジュールは「LINE 側で作成済みのメニューを makxas-front 側で管理」する。
 */

const LINE_API = "https://api.line.me/v2/bot";

export type LineRichMenu = {
  richMenuId: string;
  name: string;
  size: { width: number; height: number };
  chatBarText: string;
  selected: boolean;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** LINE 側に存在するリッチメニューを一覧取得 */
export async function listRichMenus(channelToken: string): Promise<LineRichMenu[]> {
  const res = await fetch(`${LINE_API}/richmenu/list`, {
    headers: authHeaders(channelToken),
  });
  if (!res.ok) {
    throw new Error(`LINE listRichMenus failed: ${res.status}`);
  }
  const data = (await res.json()) as { richmenus: LineRichMenu[] };
  return data.richmenus ?? [];
}

/** 既定リッチメニューを設定（新規友達追加時に表示される） */
export async function setDefaultRichMenu(channelToken: string, richMenuId: string): Promise<void> {
  const res = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: authHeaders(channelToken),
  });
  if (!res.ok) {
    throw new Error(`LINE setDefaultRichMenu failed: ${res.status} ${await res.text()}`);
  }
}

/** 既定リッチメニューを解除 */
export async function unsetDefaultRichMenu(channelToken: string): Promise<void> {
  const res = await fetch(`${LINE_API}/user/all/richmenu`, {
    method: "DELETE",
    headers: authHeaders(channelToken),
  });
  if (!res.ok) {
    throw new Error(`LINE unsetDefaultRichMenu failed: ${res.status}`);
  }
}

/** 個別ユーザーにリッチメニューを紐付け（査定完了後の専用メニュー切替に使う） */
export async function linkRichMenuToUser(
  channelToken: string,
  lineUserId: string,
  richMenuId: string,
): Promise<void> {
  const res = await fetch(`${LINE_API}/user/${lineUserId}/richmenu/${richMenuId}`, {
    method: "POST",
    headers: authHeaders(channelToken),
  });
  if (!res.ok) {
    throw new Error(`LINE linkRichMenuToUser failed: ${res.status}`);
  }
}

/** 個別ユーザーのリッチメニュー紐付けを解除 */
export async function unlinkRichMenuFromUser(
  channelToken: string,
  lineUserId: string,
): Promise<void> {
  const res = await fetch(`${LINE_API}/user/${lineUserId}/richmenu`, {
    method: "DELETE",
    headers: authHeaders(channelToken),
  });
  if (!res.ok) {
    throw new Error(`LINE unlinkRichMenuFromUser failed: ${res.status}`);
  }
}
