/**
 * PR44: Sentry クライアントサイド設定
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
    // セッションリプレイは初期は無効（プライバシー配慮）
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
