/**
 * ログイン後の遷移先（next パラメータ）を安全な相対パスだけに制限する。
 * オープンリダイレクト（//evil.com や絶対URLへの誘導）を防ぐため、
 * 同一オリジンの相対パス（"/" 始まり・"//"・"/\\" でない）のみ許可し、
 * それ以外は fallback に倒す。（ADR-0023 直リンク到達性）
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/inbox",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
