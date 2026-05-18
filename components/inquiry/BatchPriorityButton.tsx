"use client";

/**
 * 反響リスト上部に配置するバッチ AI 優先度判定ボタン。
 *
 * 未判定 (ai_priority IS NULL) の反響を順次 API 呼出し:
 *   - 並列度 3 で実行 (Anthropic レート制限と DB 負荷のバランス)
 *   - 進捗を「処理中 X/Y 件」で表示
 *   - 完了時に onAllDone で親 state を更新通知
 *   - 失敗時は失敗カウントとともに完了
 */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { InquiryWithLead } from "@/types/database";

type Result = {
  inquiryId: string;
  priority?: "high" | "medium" | "low";
  score?: number;
  reason?: string;
  setAt?: string;
};

async function runOne(id: string): Promise<Result | null> {
  try {
    const res = await fetch(
      `/api/ai/inquiry-priority/${encodeURIComponent(id)}`,
      { method: "POST" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Result;
    return body;
  } catch {
    return null;
  }
}

/** 並列実行（concurrency 上限つき）*/
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!, idx);
      done++;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export function BatchPriorityButton({
  inquiries,
  onResults,
}: {
  inquiries: InquiryWithLead[];
  onResults: (updates: Map<string, Result>) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDone, setLastDone] = useState<{ ok: number; fail: number } | null>(null);

  // 未判定のみ対象 (運用上 既判定の上書きは詳細パネル「再判定」のみで実行)
  const targets = inquiries.filter((i) => !i.ai_priority);

  async function run() {
    if (targets.length === 0) return;
    setRunning(true);
    setError(null);
    setLastDone(null);
    try {
      const updates = new Map<string, Result>();
      let failCount = 0;
      const results = await runWithConcurrency(
        targets,
        3,
        async (inq) => runOne(inq.id),
        (done, total) => setProgress({ done, total }),
      );
      results.forEach((r, i) => {
        if (r && r.priority) {
          updates.set(targets[i]!.id, r);
        } else {
          failCount++;
        }
      });
      onResults(updates);
      setLastDone({ ok: updates.size, fail: failCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  if (targets.length === 0 && !lastDone) {
    // 全件判定済みなら非表示 (チラつき防止)
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {running ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 px-2 py-1 rounded-md">
          <Loader2 size={12} className="animate-spin" />
          AI 判定中 {progress ? `${progress.done}/${progress.total}` : ""}
        </span>
      ) : targets.length > 0 ? (
        <button
          type="button"
          onClick={() => void run()}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 px-2.5 py-1 text-xs font-semibold transition-colors"
          title={`未判定 ${targets.length} 件を AI で一括判定`}
        >
          <Sparkles size={12} />
          一括判定 ({targets.length})
        </button>
      ) : null}
      {lastDone && !running && (
        <span className="text-[11px] text-zinc-500">
          完了: 成功 {lastDone.ok}
          {lastDone.fail > 0 ? ` / 失敗 ${lastDone.fail}` : ""}
        </span>
      )}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
