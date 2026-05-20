/**
 * PR44: Sentry サーバーサイド設定
 *
 * SENTRY_DSN が設定されていない場合は no-op（開発環境では送信しない）。
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1, // 10% トレース
    environment: process.env.VERCEL_ENV ?? "development",
    // 本番のみ送信
    enabled: process.env.VERCEL_ENV === "production",
  });
}
