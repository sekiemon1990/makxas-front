import { AppShell } from "@/components/app-shell";

export function EmptyStatePage({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="flex h-screen items-center justify-center">
        <div className="w-[420px] rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-zinc-500">準備中</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            このページはプロトタイプ用の空ページです。
          </p>
        </div>
      </div>
    </AppShell>
  );
}
