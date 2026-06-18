"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AllowlistEntry = {
  id: string;
  email: string;
  note: string | null;
  created_at: string;
};

export function AllowlistManager() {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 先頭で同期 setState しない（effect からの呼び出しでも cascading render を避ける）。
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/allowlist");
    const data = (await res.json()) as { allowlist?: AllowlistEntry[]; error?: string };
    if (res.ok) {
      setEntries(data.allowlist ?? []);
      setError(null);
    } else {
      setError(data.error ?? "読み込みに失敗しました");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, note: note || null }),
    });
    const data = (await res.json()) as { entry?: AllowlistEntry; error?: string };
    if (res.ok) {
      setEmail("");
      setNote("");
      await load();
    } else {
      setError(data.error ?? "登録に失敗しました");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch("/api/admin/allowlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "削除に失敗しました");
    }
  }

  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>ログイン許可リスト（社外アカウント用）</CardTitle>
        <CardDescription>
          makxas のメール（@makxas.com）は自動でログインできます。
          それ以外のメールでログインを許可したい場合のみ、ここに登録してください。
          登録していないアカウントはログインできません。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs text-zinc-500">メールアドレス</label>
            <Input
              type="email"
              required
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs text-zinc-500">メモ（任意）</label>
            <Input
              placeholder="例: 外部パートナー 田中さん"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button disabled={saving} type="submit">
            {saving ? "登録中..." : "許可に追加"}
          </Button>
        </form>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-zinc-500">読み込み中...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            登録されている社外アカウントはありません。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.email}</p>
                  {entry.note ? (
                    <p className="truncate text-xs text-zinc-500">{entry.note}</p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => remove(entry.id)}
                >
                  削除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
