"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// recovery セッション確立後に updateUser({ password }) で同じ auth.users 行へ付与。
// セッションが無ければ /auth/reset-password へ誘導。
export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/auth/reset-password");
        return;
      }
      setChecking(false);
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("設定に失敗しました。リンクの有効期限が切れている可能性があります。");
      return;
    }
    router.replace("/inbox");
  }

  if (checking) {
    return <p className="text-sm text-zinc-500">確認中…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        type="password"
        required
        placeholder="新しいパスワード（8文字以上）"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        type="password"
        required
        placeholder="新しいパスワード（確認）"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "設定中…" : "パスワードを設定する"}
      </Button>
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </form>
  );
}
