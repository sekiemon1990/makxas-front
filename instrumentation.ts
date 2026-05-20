/**
 * PR44: Next.js instrumentation - Sentry を初期化
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  err: unknown,
  request: unknown,
  context: unknown,
) {
  const Sentry = await import("@sentry/nextjs").catch(() => null);
  if (Sentry?.captureRequestError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Sentry.captureRequestError as any)(err, request, context);
  }
}
