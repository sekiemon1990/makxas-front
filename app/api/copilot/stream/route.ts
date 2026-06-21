import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { composeSystemPrompt } from '@makxas/ai-kit';
import { createClient } from '@/lib/supabase/server';
import { logAiUsage } from '@/lib/ai/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6' as const;

const COPILOT_SYSTEM = composeSystemPrompt(
  `あなたはマクサスインサイドセールス管理システムの AI コパイロットです。
反響・リード・アポイントメント管理の質問・業務サポートを担います。
利用者の目標達成を最優先に、簡潔かつ的確に回答してください。
書き込み・外部送信は行わず、情報提供・判断支援のみ行います。`,
);

function encodeEvent(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let payload: { message?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message) return Response.json({ ok: false, error: 'message_required' }, { status: 400 });
  if (message.length > 8000) return Response.json({ ok: false, error: 'message_too_long' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: 'anthropic_not_configured' }, { status: 503 });

  const anthropic = new Anthropic({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      let rawUsage: Anthropic.Usage | null = null;

      try {
        const sdkStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system: [
            {
              type: 'text',
              text: COPILOT_SYSTEM,
              cache_control: { type: 'ephemeral' }, // prompt cache — 削除禁止
            },
          ],
          messages: [{ role: 'user', content: message }],
        });

        for await (const event of sdkStream) {
          if (event.type === 'message_start') {
            rawUsage = event.message.usage;
          }
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encodeEvent({ type: 'text_delta', text: event.delta.text }));
          }
          if (event.type === 'message_delta' && rawUsage) {
            rawUsage = { ...rawUsage, output_tokens: event.usage.output_tokens };
          }
        }

        controller.enqueue(
          encodeEvent({
            type: 'done',
            context: { label: 'フロント コパイロット', write_policy: 'read_only' },
          }),
        );

        if (rawUsage) {
          await logAiUsage({
            category: 'chat',
            model: MODEL,
            usage: rawUsage,
            endpoint: '/api/copilot/stream',
          });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'stream_error';
        controller.enqueue(encodeEvent({ type: 'error', error: errMsg }));
        if (rawUsage) {
          await logAiUsage({
            category: 'chat',
            model: MODEL,
            usage: rawUsage,
            endpoint: '/api/copilot/stream',
            meta: { error: errMsg },
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
