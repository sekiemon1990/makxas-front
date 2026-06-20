import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { UpdatePasswordForm } from "./update-form";

// 新しいパスワードの確定（ADR-0007）。/auth/callback で recovery セッション確立後に開かれる。
export default function UpdatePasswordPage() {
  return (
    <AppShell>
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)] p-8">
        <Card className="w-full max-w-[420px] rounded-lg border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">新しいパスワードの設定</CardTitle>
            <CardDescription>8文字以上で設定してください。</CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
