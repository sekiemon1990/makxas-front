/**
 * PR44: Sentry Edge ランタイム設定（middleware / edge routes 用）
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? "development",
    enabled: process.env.VERCEL_ENV === "production",
  });
}
