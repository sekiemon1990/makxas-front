"use client";

import { useState, useEffect } from "react";
import { Phone, Mail, Hash, Plus, Trash2, Star, StarOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadContact } from "@/types/database";

type ContactType = "phone" | "email" | "line" | "other";

const typeLabels: Record<ContactType, string> = {
  phone: "電話",
  email: "メール",
  line: "LINE",
  other: "その他",
};

const typeIcon = (type: string) => {
  if (type === "phone") return <Phone className="size-3.5" />;
  if (type === "email") return <Mail className="size-3.5" />;
  if (type === "line") return <Hash className="size-3.5" />;
  return <Hash className="size-3.5" />;
};

type Props = { leadId: string };

export function LeadContactsPanel({ leadId }: Props) {
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // フォーム
  const [newType, setNewType] = useState<ContactType>("phone");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPrimary, setNewPrimary] = useState(false);

  async function load() {
    const res = await fetch(`/api/leads/${leadId}/contacts`);
    const data = await res.json() as { contacts: LeadContact[] };
    setContacts(data.contacts ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [leadId]);

  async function handleAdd() {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, value: newValue.trim(), label: newLabel.trim() || undefined, is_primary: newPrimary }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? "追加に失敗しました");
        return;
      }
      setNewValue(""); setNewLabel(""); setNewPrimary(false);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contactId: string) {
    if (!confirm("この連絡先を削除しますか？")) return;
    setDeleting(contactId);
    try {
      await fetch(`/api/leads/${leadId}/contacts?contact_id=${contactId}`, { method: "DELETE" });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  async function handleSetPrimary(contact: LeadContact) {
    if (contact.is_primary) return;
    // まず既存のprimaryをfalseに（APIがやってくれるのでそのまま追加）
    await fetch(`/api/leads/${leadId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: contact.type, value: contact.value, label: contact.label, is_primary: true }),
    });
    // 既存contactのis_primaryを更新するには一旦削除→再作成になるが
    // シンプルに直接update endpointを別途作るより、ここではページリロードで反映
    await load();
  }

  // typeごとにグループ化
  const grouped = contacts.reduce<Record<string, LeadContact[]>>((acc, c) => {
    const arr = acc[c.type] ?? [];
    arr.push(c);
    acc[c.type] = arr;
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center gap-2 py-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" />読み込み中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700">連絡先</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <Plus className="size-3.5" />
          追加
        </button>
      </div>

      {/* 連絡先一覧 */}
      {contacts.length === 0 ? (
        <p className="text-xs text-zinc-400 py-2">登録された連絡先はありません</p>
      ) : (
        <div className="space-y-1">
          {(["phone", "email", "line", "other"] as ContactType[]).map((type) => {
            const items = grouped[type];
            if (!items?.length) return null;
            return (
              <div key={type}>
                {items.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 group">
                    <span className="text-zinc-400">{typeIcon(c.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-zinc-800">{c.value}</span>
                        {c.label && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5">{c.label}</span>
                        )}
                        {c.is_primary && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                            <Star className="size-2.5" />メイン
                          </span>
                        )}
                        {c.source === "auto" && (
                          <span className="text-[10px] text-zinc-300 hidden group-hover:inline">自動</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!c.is_primary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(c)}
                          title="メインに設定"
                          className="flex size-6 items-center justify-center rounded text-zinc-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        >
                          <StarOff className="size-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="flex size-6 items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {deleting === c.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
          <div className="flex gap-2">
            <Select value={newType} onValueChange={(v) => setNewType(v as ContactType)}>
              <SelectTrigger className="h-8 w-24 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(typeLabels) as [ContactType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 flex-1 text-xs bg-white"
              placeholder={newType === "phone" ? "090-0000-0000" : newType === "email" ? "example@mail.com" : newType === "line" ? "LINE ID" : "値を入力"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            />
          </div>
          <div className="flex gap-2 items-center">
            <Input
              className="h-7 flex-1 text-xs bg-white"
              placeholder="ラベル（携帯/自宅/仕事 など）任意"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer select-none">
              <input type="checkbox" checked={newPrimary} onChange={(e) => setNewPrimary(e.target.checked)} className="size-3" />
              メイン
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>キャンセル</Button>
            <Button size="sm" className="h-7 text-xs" disabled={saving || !newValue.trim()} onClick={handleAdd}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : "追加"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
