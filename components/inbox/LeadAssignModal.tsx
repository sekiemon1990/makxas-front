"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Phone, Mail, Hash, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LeadResult = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  line_user_id: string | null;
  first_channel: string | null;
  created_at: string;
  matched_contacts: { type: string; value: string; label: string | null }[];
};

type Props = {
  inquiryId: string;
  currentLeadId: string | null;
  currentLeadName: string;
  onAssigned: (leadId: string, leadName: string) => void;
  onClose: () => void;
};

export function LeadAssignModal({ inquiryId, currentLeadId, currentLeadName, onAssigned, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 1) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json() as { leads: LeadResult[] };
        setResults(data.leads ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  async function handleAssign(lead: LeadResult) {
    if (lead.id === currentLeadId) { onClose(); return; }
    setSaving(lead.id);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!res.ok) throw new Error("Failed");
      const name = lead.display_name ?? lead.phone ?? lead.email ?? "名前未登録";
      onAssigned(lead.id, name);
    } catch {
      alert("リードの変更に失敗しました");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">リードを変更</h2>
            <p className="mt-0.5 text-xs text-zinc-500">現在: {currentLeadName}</p>
          </div>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" type="button">
            <X className="size-4" />
          </button>
        </div>

        {/* 検索入力 */}
        <div className="px-5 pt-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              ref={inputRef}
              className="pl-9 text-sm"
              placeholder="名前・電話番号・メールアドレスで検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-400" />
            )}
          </div>
        </div>

        {/* 検索結果 */}
        <div className="max-h-72 overflow-y-auto px-2 pb-4">
          {results.length === 0 && query.trim().length > 0 && !searching ? (
            <p className="py-8 text-center text-sm text-zinc-400">該当するリードが見つかりません</p>
          ) : null}

          {results.map((lead) => {
            const isCurrent = lead.id === currentLeadId;
            const name = lead.display_name ?? lead.phone ?? lead.email ?? "名前未登録";
            return (
              <button
                key={lead.id}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-50 disabled:opacity-60"
                onClick={() => handleAssign(lead)}
                disabled={saving !== null}
                type="button"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
                  {(name)[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 truncate">{name}</span>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">現在</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                    {lead.phone && <span className="flex items-center gap-0.5"><Phone className="size-3" />{lead.phone}</span>}
                    {lead.email && <span className="flex items-center gap-0.5"><Mail className="size-3" />{lead.email}</span>}
                    {lead.line_user_id && <span className="flex items-center gap-0.5"><Hash className="size-3" />LINE</span>}
                    {/* lead_contacts から追加でマッチした連絡先 */}
                    {lead.matched_contacts
                      .filter((c) => c.value !== lead.phone && c.value !== lead.email && c.value !== lead.line_user_id)
                      .slice(0, 2)
                      .map((c, i) => (
                        <span key={i} className="flex items-center gap-0.5 text-violet-500">
                          {c.type === "phone" ? <Phone className="size-3" /> : c.type === "email" ? <Mail className="size-3" /> : <Hash className="size-3" />}
                          {c.value}{c.label ? ` (${c.label})` : ""}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="shrink-0">
                  {saving === lead.id ? (
                    <Loader2 className="size-4 animate-spin text-zinc-400" />
                  ) : isCurrent ? (
                    <Check className="size-4 text-zinc-400" />
                  ) : (
                    <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] text-white font-medium">変更</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
