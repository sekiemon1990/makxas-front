import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// パスワード設定/再設定の要求（ADR-0007）。/auth/reset-password は公開パス。
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <AppShell>
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)] p-8">
        <Card className="w-full max-w-[420px] rounded-lg border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">パスワードの設定・再設定</CardTitle>
            <CardDescription>
              登録済みのメールアドレスに設定用リンクを送ります。Googleでログイン中の方もここから設定できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notice === "reset_sent" ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                設定用のメールを送信しました（登録済みのアドレスの場合）。メールのリンクから設定してください。
              </p>
            ) : (
              <form action="/api/auth/reset" method="post" className="space-y-3">
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="メールアドレス"
                  autoComplete="email"
                />
                <Button className="w-full" type="submit">
                  設定リンクを送る
                </Button>
              </form>
            )}
            <Link
              href="/login"
              className="block text-center text-xs text-zinc-500 underline"
            >
              ログイン画面に戻る
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
