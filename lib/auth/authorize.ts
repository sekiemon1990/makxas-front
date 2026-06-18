import { createServiceClient } from "@/lib/supabase/service";

/**
 * 認証ゲートの許可判定。
 *
 * ログインを許可する条件:
 *   (1) メールが許可ドメイン(@makxas.com)である、または
 *   (2) auth_allowlist テーブルに登録されたメールである。
 *
 * 実際のアクセス制御は「許可されたメールだけ staff として有効化する」ことと、
 * middleware で staff.is_active を確認することの二段構えで行う。
 */

export const ALLOWED_EMAIL_DOMAIN = "makxas.com";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedDomain(email: string): boolean {
  return normalizeEmail(email).endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

/**
 * ログイン許可判定（ドメイン or 許可リスト）。
 * 許可リストの参照は service_role 経由（RLS 非適用）で行う。
 */
export async function isLoginAllowed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (isAllowedDomain(normalized)) return true;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("auth_allowlist")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    // 判定不能時は安全側に倒して不許可にする（fail-closed）。
    console.error("[authorize] allowlist lookup failed:", error.message);
    return false;
  }
  return data !== null;
}
