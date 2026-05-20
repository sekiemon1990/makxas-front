/**
 * PR28: 反響変更履歴パネル
 *
 * /api/inquiries/[id]/audit-log から最新50件を取得して折りたたみ表示。
 */
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  field: string | null;
  before_value: unknown;
  after_value: unknown;
  changed_by_email: string | null;
  note: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "ステータス変更",
  update: "更新",
  create: "作成",
  delete: "削除",
  merge: "統合",
  assign: "担当変更",
};

const STATUS_LABELS: Record<string, string> = {
  new: "新規",
  in_progress: "対応中",
  pending: "保留",
  appointment_set: "アポ取得済",
  transferred: "引継完了",
  lost: "失注",
  closed: "クローズ",
};

function formatValue(field: string | null, value: unknown): string {
  if (value === null || value === undefined) return "—";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (field === "status" && STATUS_LABELS[s]) return STATUS_LABELS[s];
  return s.replace(/^"|"$/g, "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function AuditLogPanel({ inquiryId }: { inquiryId: string }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || logs !== null) return;
    setLoading(true);
    fetch(`/api/inquiries/${inquiryId}/audit-log`)
      .then((r) => r.json())
      .then((d: { logs?: AuditLog[]; error?: string }) => {
        setLogs(d.logs ?? []);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, logs, inquiryId]);

  // 反響を切り替えたら状態リセット
  useEffect(() => {
    setLogs(null);
    setOpen(false);
  }, [inquiryId]);

  return (
    <div className="border-b border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-2 text-left hover:bg-zinc-100 transition-colors"
      >
        <History className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="flex-1 text-xs font-medium text-zinc-700">変更履歴</span>
        {open
          ? <ChevronUp className="size-3.5 text-zinc-400" />
          : <ChevronDown className="size-3.5 text-zinc-400" />}
      </button>
      {open ? (
        <div className="border-t border-zinc-100 px-5 py-2 max-h-60 overflow-y-auto">
          {loading ? (
            <p className="text-[11px] text-zinc-500 py-2">読み込み中…</p>
          ) : logs && logs.length > 0 ? (
            <ul className="space-y-1.5">
              {logs.map((log) => (
                <li key={log.id} className="text-[11px] text-zinc-700">
                  <span className="text-zinc-400">{formatDate(log.created_at)}</span>
                  <span className="ml-2 font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  {log.field === "status" ? (
                    <span className="ml-1 text-zinc-600">
                      : <span className="text-zinc-400">{formatValue("status", log.before_value)}</span>
                      <span className="mx-1">→</span>
                      <span className="text-amber-700 font-medium">{formatValue("status", log.after_value)}</span>
                    </span>
                  ) : null}
                  {log.changed_by_email ? (
                    <span className="ml-2 text-zinc-400">by {log.changed_by_email.split("@")[0]}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-500 py-2">変更履歴はありません</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
