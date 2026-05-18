"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categoryOptions } from "@/lib/inquiry-options";

export default function InquiryPage() {
  const [submitted, setSubmitted] = useState(false);
  const [category, setCategory] = useState(categoryOptions[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 顧客向け公開ページのため、社内サイドバーは出さない */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-zinc-900">買取マクサス</span>
          </div>
          <a
            className="text-sm text-zinc-500 hover:text-zinc-700"
            href="https://kaitorimakxas.com"
            rel="noopener"
            target="_blank"
          >
            公式サイト →
          </a>
        </div>
      </header>
      <div className="flex items-center justify-center p-8">
        {submitted ? (
          <Card className="w-full max-w-[560px] rounded-lg border-zinc-200 text-center shadow-sm">
            <CardHeader className="items-center">
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">送信ありがとうございます</CardTitle>
              <CardDescription>
                内容を確認のうえ、担当スタッフよりご連絡いたします。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="w-full max-w-[720px] rounded-lg border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">
                買取マクサス お問い合わせ
              </CardTitle>
              <CardDescription>
                査定希望のお品物についてお知らせください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-5"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSubmitting(true);
                  setError(null);

                  const formData = new FormData(event.currentTarget);
                  const response = await fetch("/api/webhooks/form", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: String(formData.get("name") ?? ""),
                      phone: String(formData.get("phone") ?? ""),
                      email: String(formData.get("email") ?? ""),
                      item_category: category,
                      item_description: String(
                        formData.get("item_description") ?? "",
                      ),
                    }),
                  });

                  setSubmitting(false);

                  if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as {
                      error?: string;
                    } | null;
                    setError(payload?.error ?? "送信に失敗しました。");
                    return;
                  }

                  setSubmitted(true);
                }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <Field label="氏名">
                    <Input name="name" placeholder="山田 太郎" />
                  </Field>
                  <Field label="電話番号">
                    <Input name="phone" placeholder="090-1234-5678" type="tel" />
                  </Field>
                </div>
                <Field label="メールアドレス">
                  <Input
                    name="email"
                    placeholder="customer@example.com"
                    type="email"
                  />
                </Field>
                <Field label="品目カテゴリ">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="品物の説明">
                  <Textarea
                    className="min-h-32 resize-none"
                    name="item_description"
                    placeholder="ブランド名、型番、購入時期、状態など"
                  />
                </Field>
                {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                <div className="flex justify-end">
                  <Button disabled={submitting} size="lg" type="submit">
                    <Send className="size-4" aria-hidden="true" />
                    {submitting ? "送信中..." : "送信する"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
