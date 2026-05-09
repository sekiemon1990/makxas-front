"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Brand,
  ComparisonSiteAccount,
  EmailAccount,
  LineAccount,
  ReplyTemplate,
  Staff,
  StaffBrandAccess,
  Store,
} from "@/types/database";

type Tab = "brands" | "stores" | "line" | "email" | "comparison" | "staff" | "templates" | "ai" | "feedback";

type BrandRef = Pick<Brand, "id" | "name" | "brand_code">;
type StoreRef = Pick<Store, "id" | "name">;
type StoreWithBrand = Store & { brands?: BrandRef | null };

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "brands", label: "ブランド管理" },
  { value: "stores", label: "店舗管理" },
  { value: "line", label: "LINEアカウント" },
  { value: "email", label: "メールアカウント" },
  { value: "comparison", label: "比較サイト" },
  { value: "staff", label: "スタッフ管理" },
  { value: "templates", label: "返信テンプレート" },
  { value: "ai", label: "AI設定" },
  { value: "feedback", label: "フィードバック" },
];

export function SettingsClient({
  brands,
  comparisonAccounts,
  emailAccounts,
  lineAccounts,
  staff,
  staffBrandAccess,
  stores,
}: {
  brands: Brand[];
  comparisonAccounts: Array<
    ComparisonSiteAccount & {
      brands: BrandRef | null;
      stores: StoreRef | null;
    }
  >;
  emailAccounts: Array<
    EmailAccount & {
      brands: BrandRef | null;
      stores: StoreRef | null;
    }
  >;
  lineAccounts: Array<
    LineAccount & {
      brands: BrandRef | null;
      stores: StoreRef | null;
    }
  >;
  staff: Staff[];
  staffBrandAccess: Array<
    StaffBrandAccess & {
      staff: Pick<Staff, "id" | "name" | "email"> | null;
      brands: BrandRef | null;
    }
  >;
  stores: StoreWithBrand[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("brands");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateList, setTemplateList] = useState<ReplyTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  useEffect(() => {
    fetch("/api/settings/reply-templates")
      .then((r) => r.json())
      .then((d: { templates?: ReplyTemplate[] }) => {
        if (d.templates) setTemplateList(d.templates);
      })
      .catch(() => {});
  }, []);

  const modalTitle = useMemo(() => {
    if (activeTab === "staff") return "ブランドアクセス権を追加";
    return `${tabs.find((tab) => tab.value === activeTab)?.label ?? ""}を追加`;
  }, [activeTab]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    if (activeTab === "templates") {
      const res = await fetch("/api/settings/reply-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, body: templateBody }),
      });
      setSaving(false);
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(p?.error ?? "保存に失敗しました。");
        return;
      }
      const d = (await res.json()) as { template?: ReplyTemplate };
      if (d.template) setTemplateList((prev) => [...prev, d.template!]);
      setTemplateName("");
      setTemplateBody("");
      setOpen(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const response = await fetch(endpointFor(activeTab), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFor(activeTab, formData)),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "保存に失敗しました。");
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">設定</h1>
          </div>
          {activeTab !== "ai" && activeTab !== "feedback" ? (
            <Button onClick={() => setOpen(true)} type="button">
              <Plus className="size-4" aria-hidden="true" />
              追加
            </Button>
          ) : null}
        </div>

        <div className="mt-8 flex gap-2 border-b border-zinc-200">
          {tabs.map((tab) => (
            <button
              className={
                activeTab === tab.value
                  ? "border-b-2 border-zinc-950 px-3 pb-3 text-sm font-semibold text-zinc-950"
                  : "px-3 pb-3 text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
              }
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "brands" ? <BrandsList brands={brands} /> : null}
          {activeTab === "stores" ? <StoresList stores={stores} /> : null}
          {activeTab === "line" ? (
            <LineAccountsList accounts={lineAccounts} />
          ) : null}
          {activeTab === "email" ? (
            <EmailAccountsList accounts={emailAccounts} />
          ) : null}
          {activeTab === "comparison" ? (
            <ComparisonAccountsList accounts={comparisonAccounts} />
          ) : null}
          {activeTab === "staff" ? (
            <StaffAccessList access={staffBrandAccess} staff={staff} />
          ) : null}
          {activeTab === "templates" ? (
            <TemplatesList
              templates={templateList}
              onDelete={async (id) => {
                await fetch("/api/settings/reply-templates", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id }),
                });
                setTemplateList((prev) => prev.filter((t) => t.id !== id));
              }}
            />
          ) : null}
          {activeTab === "ai" ? <AiConfigSection /> : null}
          {activeTab === "feedback" ? <FeedbackSection /> : null}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          setError(null);
        }}
      >
        <DialogContent className="max-w-[620px] rounded-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription>
                ブランドと店舗を分けて各チャンネルの接続情報を管理します。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              {activeTab === "brands" ? <BrandForm /> : null}
              {activeTab === "stores" ? <StoreForm brands={brands} /> : null}
              {activeTab === "line" ? (
                <LineForm brands={brands} stores={stores} />
              ) : null}
              {activeTab === "email" ? (
                <EmailForm brands={brands} stores={stores} />
              ) : null}
              {activeTab === "comparison" ? (
                <ComparisonForm brands={brands} stores={stores} />
              ) : null}
              {activeTab === "staff" ? (
                <StaffAccessForm brands={brands} staff={staff} />
              ) : null}
              {activeTab === "templates" ? (
                <TemplateForm
                  name={templateName}
                  body={templateBody}
                  onNameChange={setTemplateName}
                  onBodyChange={setTemplateBody}
                />
              ) : null}
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            </div>
            <DialogFooter className="mt-5">
              <Button disabled={saving} type="submit">
                {saving ? "保存中..." : "保存する"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandsList({ brands }: { brands: Brand[] }) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>ブランド一覧</CardTitle>
        <CardDescription>全店舗・全チャンネルの親となるブランド</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {brands.map((brand) => (
          <Row key={brand.id}>
            <div>
              <p className="font-medium">{brand.name}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {brand.brand_code ?? "コード未設定"}
              </p>
            </div>
            <Status isActive={brand.is_active} />
          </Row>
        ))}
        {brands.length === 0 ? <EmptyText /> : null}
      </CardContent>
    </Card>
  );
}

function StoresList({ stores }: { stores: StoreWithBrand[] }) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>店舗一覧</CardTitle>
        <CardDescription>ブランド配下の店舗マスタ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {stores.map((store) => (
          <Row key={store.id}>
            <div>
              <p className="font-medium">{store.name}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {store.brands?.name ?? "ブランド未設定"} /{" "}
                {store.store_code ?? "コード未設定"}
              </p>
            </div>
            <Badge variant="outline" className="rounded-md bg-white">
              {store.store_type === "direct" ? "直営" : "FC"}
            </Badge>
          </Row>
        ))}
        {stores.length === 0 ? <EmptyText /> : null}
      </CardContent>
    </Card>
  );
}

function LineAccountsList({
  accounts,
}: {
  accounts: Array<
    LineAccount & { brands: BrandRef | null; stores: StoreRef | null }
  >;
}) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>LINEアカウント</CardTitle>
        <CardDescription>店舗ごとのLINE公式アカウント接続情報</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map((account) => (
          <Row key={account.id}>
            <div>
              <p className="font-medium">{account.name}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {account.brands?.name ?? "ブランド未設定"} /{" "}
                {account.stores?.name ?? "店舗未設定"} / destination:{" "}
                {account.destination ?? "-"}
              </p>
            </div>
            <Status isActive={account.is_active} />
          </Row>
        ))}
        {accounts.length === 0 ? <EmptyText /> : null}
      </CardContent>
    </Card>
  );
}

function EmailAccountsList({
  accounts,
}: {
  accounts: Array<
    EmailAccount & { brands: BrandRef | null; stores: StoreRef | null }
  >;
}) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>メールアカウント</CardTitle>
        <CardDescription>問い合わせ受信・返信に使うメール</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map((account) => (
          <Row key={account.id}>
            <div>
              <p className="font-medium">{account.email}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {account.brands?.name ?? "ブランド未設定"} /{" "}
                {account.stores?.name ?? "店舗未設定"} /{" "}
                {account.purpose === "reply" ? "返信用" : "問い合わせ用"}
              </p>
            </div>
            <Status isActive={account.is_active} />
          </Row>
        ))}
        {accounts.length === 0 ? <EmptyText /> : null}
      </CardContent>
    </Card>
  );
}

function ComparisonAccountsList({
  accounts,
}: {
  accounts: Array<
    ComparisonSiteAccount & {
      brands: BrandRef | null;
      stores: StoreRef | null;
    }
  >;
}) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>比較サイトアカウント</CardTitle>
        <CardDescription>おいくら・ウリドキ・ヒカカクの通知先</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map((account) => (
          <Row key={account.id}>
            <div>
              <p className="font-medium">{siteLabel(account.site)}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {account.brands?.name ?? "ブランド未設定"} /{" "}
                {account.stores?.name ?? "店舗未設定"} /{" "}
                {account.notification_email ?? "通知メール未設定"}
              </p>
            </div>
            <Status isActive={account.is_active} />
          </Row>
        ))}
        {accounts.length === 0 ? <EmptyText /> : null}
      </CardContent>
    </Card>
  );
}

function StaffAccessList({
  access,
  staff,
}: {
  access: Array<
    StaffBrandAccess & {
      staff: Pick<Staff, "id" | "name" | "email"> | null;
      brands: BrandRef | null;
    }
  >;
  staff: Staff[];
}) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>スタッフ管理</CardTitle>
        <CardDescription>スタッフと閲覧可能ブランドの対応</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {staff.map((member) => {
          const brandsForMember = access.filter(
            (item) => item.staff_id === member.id,
          );

          return (
            <Row key={member.id}>
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {member.email} / {roleLabel(member.role)}
                </p>
              </div>
              <div className="flex max-w-[420px] flex-wrap justify-end gap-2">
                {brandsForMember.length > 0 ? (
                  brandsForMember.map((item) => (
                    <Badge
                      key={`${item.staff_id}-${item.brand_id}`}
                      variant="outline"
                      className="rounded-md bg-white"
                    >
                      {item.brands?.name ?? "ブランド不明"}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500">未設定</span>
                )}
              </div>
            </Row>
          );
        })}
        {staff.length === 0 ? <EmptyText /> : null}
      </CardContent>
    </Card>
  );
}

function BrandForm() {
  return (
    <>
      <Field label="ブランド名">
        <Input name="name" required />
      </Field>
      <Field label="ブランドコード">
        <Input name="brand_code" />
      </Field>
    </>
  );
}

function StoreForm({ brands }: { brands: Brand[] }) {
  return (
    <>
      <BrandSelect brands={brands} />
      <Field label="店舗名">
        <Input name="name" required />
      </Field>
      <Field label="店舗コード">
        <Input name="store_code" />
      </Field>
      <Field label="店舗タイプ">
        <NativeSelect name="store_type">
          <option value="direct">直営</option>
          <option value="fc">FC</option>
        </NativeSelect>
      </Field>
    </>
  );
}

function LineForm({
  brands,
  stores,
}: {
  brands: Brand[];
  stores: StoreWithBrand[];
}) {
  return (
    <>
      <Field label="アカウント名">
        <Input name="name" required />
      </Field>
      <BrandStoreFields brands={brands} stores={stores} storeRequired />
      <Field label="チャンネルID">
        <Input name="channel_id" required />
      </Field>
      <Field label="チャンネルシークレット">
        <Input name="channel_secret" required />
      </Field>
      <Field label="チャンネルアクセストークン">
        <Input name="channel_access_token" required />
      </Field>
      <Field label="Destination（Bot User ID）">
        <Input
          name="destination"
          placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        />
      </Field>
      <p className="text-xs text-zinc-500">
        LINE Developersコンソール → チャンネル設定 → 「Your user
        ID」に表示される値（省略可。後からWebhook受信時に自動セット可能）
      </p>
    </>
  );
}

function EmailForm({
  brands,
  stores,
}: {
  brands: Brand[];
  stores: StoreWithBrand[];
}) {
  return (
    <>
      <BrandStoreFields brands={brands} stores={stores} storeRequired />
      <Field label="メールアドレス">
        <Input name="email" required type="email" />
      </Field>
      <Field label="表示名">
        <Input name="display_name" />
      </Field>
      <Field label="用途">
        <NativeSelect name="purpose">
          <option value="inquiry">問い合わせ用</option>
          <option value="reply">返信用</option>
        </NativeSelect>
      </Field>
    </>
  );
}

function ComparisonForm({
  brands,
  stores,
}: {
  brands: Brand[];
  stores: StoreWithBrand[];
}) {
  return (
    <>
      <BrandStoreFields brands={brands} stores={stores} storeRequired />
      <Field label="サイト">
        <NativeSelect name="site">
          <option value="oikura">おいくら</option>
          <option value="uridoki">ウリドキ</option>
          <option value="hikakaku">ヒカカク</option>
        </NativeSelect>
      </Field>
      <Field label="アカウントメール">
        <Input name="account_email" type="email" />
      </Field>
      <Field label="通知メール">
        <Input name="notification_email" type="email" />
      </Field>
    </>
  );
}

function StaffAccessForm({
  brands,
  staff,
}: {
  brands: Brand[];
  staff: Staff[];
}) {
  return (
    <>
      <Field label="スタッフ">
        <NativeSelect name="staff_id">
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.email})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <BrandSelect brands={brands} required />
    </>
  );
}

function BrandSelect({
  brands,
  required = false,
}: {
  brands: Brand[];
  required?: boolean;
}) {
  return (
    <Field label="ブランド">
      <NativeSelect name="brand_id" required={required}>
        <option value="">ブランド未設定</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

function StoreSelect({
  stores,
  required = false,
}: {
  stores: StoreWithBrand[];
  required?: boolean;
}) {
  return (
    <Field label="店舗">
      <NativeSelect name="store_id" required={required}>
        <option value="">店舗未設定</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.brands?.name
              ? `${store.brands.name} / ${store.name}`
              : store.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** ブランド選択→店舗を連動フィルタする複合フィールド */
function BrandStoreFields({
  brands,
  stores,
  storeRequired = false,
}: {
  brands: Brand[];
  stores: StoreWithBrand[];
  storeRequired?: boolean;
}) {
  const [selectedBrandId, setSelectedBrandId] = useState("");

  const filteredStores = selectedBrandId
    ? stores.filter((s) => s.brand_id === selectedBrandId)
    : stores;

  return (
    <>
      <Field label="ブランド">
        <NativeSelect
          name="brand_id"
          onChange={(e) => setSelectedBrandId(e.target.value)}
          value={selectedBrandId}
        >
          <option value="">ブランド未設定</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="店舗">
        <NativeSelect name="store_id" required={storeRequired}>
          <option value="">店舗未設定</option>
          {filteredStores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
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

function NativeSelect({
  children,
  name,
  onChange,
  required = false,
  value,
}: {
  children: React.ReactNode;
  name: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  value?: string;
}) {
  return (
    <select
      className="h-9 rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
      name={name}
      onChange={onChange}
      required={required}
      value={value}
    >
      {children}
    </select>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm">
      {children}
    </div>
  );
}

function TemplatesList({
  templates,
  onDelete,
}: {
  templates: ReplyTemplate[];
  onDelete: (id: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        返信テンプレートがまだありません。「追加」から作成してください。
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900">{t.name}</p>
            <p className="mt-1 truncate text-sm text-zinc-500">{t.body}</p>
          </div>
          <button
            className="shrink-0 text-xs text-zinc-400 hover:text-red-500"
            onClick={() => onDelete(t.id)}
            type="button"
          >
            削除
          </button>
        </div>
      ))}
    </div>
  );
}

function TemplateForm({
  name,
  body,
  onNameChange,
  onBodyChange,
}: {
  name: string;
  body: string;
  onNameChange: (v: string) => void;
  onBodyChange: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">テンプレート名</label>
        <input
          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="例: 初回ご連絡"
          required
          value={name}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">本文</label>
        <textarea
          className="min-h-32 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="返信テンプレートの本文を入力"
          required
          value={body}
        />
      </div>
    </>
  );
}

function Status({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        isActive
          ? "rounded-md border-emerald-200 bg-emerald-50 text-emerald-700"
          : "rounded-md border-zinc-200 bg-zinc-100 text-zinc-600"
      }
    >
      {isActive ? "有効" : "無効"}
    </Badge>
  );
}

function EmptyText() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
      まだ登録がありません。
    </div>
  );
}

function endpointFor(tab: Tab) {
  const endpoints: Record<Tab, string> = {
    brands: "/api/settings/brands",
    stores: "/api/settings/stores",
    line: "/api/settings/line-accounts",
    email: "/api/settings/email-accounts",
    comparison: "/api/settings/comparison-accounts",
    staff: "/api/settings/staff-brand-access",
    templates: "/api/settings/reply-templates",
    ai: "/api/ai/config",
    feedback: "/api/ai/feedback",
  };

  return endpoints[tab];
}

function payloadFor(tab: Tab, formData: FormData) {
  const value = (name: string) => String(formData.get(name) ?? "");
  const nullableId = (name: string) => value(name) || null;

  if (tab === "brands") {
    return {
      name: value("name"),
      brand_code: value("brand_code"),
    };
  }

  if (tab === "stores") {
    return {
      name: value("name"),
      brand_id: nullableId("brand_id"),
      store_code: value("store_code"),
      store_type: value("store_type"),
    };
  }

  if (tab === "line") {
    return {
      name: value("name"),
      brand_id: nullableId("brand_id"),
      store_id: nullableId("store_id"),
      channel_id: value("channel_id"),
      channel_secret: value("channel_secret"),
      channel_access_token: value("channel_access_token"),
      destination: value("destination"),
    };
  }

  if (tab === "email") {
    return {
      brand_id: nullableId("brand_id"),
      store_id: nullableId("store_id"),
      email: value("email"),
      display_name: value("display_name"),
      purpose: value("purpose"),
    };
  }

  if (tab === "comparison") {
    return {
      brand_id: nullableId("brand_id"),
      store_id: nullableId("store_id"),
      site: value("site"),
      account_email: value("account_email"),
      notification_email: value("notification_email"),
    };
  }

  return {
    staff_id: value("staff_id"),
    brand_id: value("brand_id"),
  };
}

function roleLabel(role: Staff["role"]) {
  const labels: Record<Staff["role"], string> = {
    super_admin: "全店舗管理者",
    admin: "店舗管理者",
    operator: "対応担当",
    viewer: "閲覧のみ",
  };

  return labels[role];
}

function siteLabel(site: ComparisonSiteAccount["site"]) {
  const labels: Record<ComparisonSiteAccount["site"], string> = {
    oikura: "おいくら",
    uridoki: "ウリドキ",
    hikakaku: "ヒカカク",
  };

  return labels[site];
}

/* ── AI設定セクション ─────────────────────────────────── */
function AiConfigSection() {
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const originalRef = useRef("");

  useEffect(() => {
    fetch("/api/ai/config")
      .then((r) => r.json())
      .then((d: { system_prompt?: string }) => {
        const p = d.system_prompt ?? "";
        setPrompt(p);
        originalRef.current = p;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/ai/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_prompt: prompt }),
    });
    originalRef.current = prompt;
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>AIシステムプロンプト</CardTitle>
        <CardDescription>
          AIアシスタントへの業務コンテキスト・追加指示を設定します。設定しない場合はデフォルトのプロンプトが使われます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            読み込み中...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              className="min-h-[200px] w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例: 対応エリアは東京・神奈川・埼玉です。&#10;査定は平日10:00〜19:00、土日も対応可能です。"
              value={prompt}
            />
            <div className="flex items-center gap-3">
              <Button disabled={saving} onClick={save} type="button">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                保存する
              </Button>
              {saved ? (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="size-4" />
                  保存しました
                </span>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── フィードバック管理セクション ─────────────────────── */
type FeedbackLog = {
  id: string;
  type: string;
  author: string | null;
  title: string;
  body: string;
  page_href: string | null;
  status: string;
  created_at: string;
};

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: "🐛 バグ",
  feature: "✨ 機能追加",
  improvement: "💡 改善",
  other: "💬 その他",
};

function FeedbackSection() {
  const [items, setItems] = useState<FeedbackLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/ai/feedback")
      .then((r) => r.json())
      .then((d: { feedbacks?: FeedbackLog[] }) => setItems(d.feedbacks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (item: FeedbackLog) => {
    const next = item.status === "open" ? "done" : "open";
    await fetch("/api/ai/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status: next }),
    });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: next } : i));
  };

  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>フィードバック一覧</CardTitle>
        <CardDescription>スタッフから送信されたバグ報告・改善提案（直近100件）</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            読み込み中...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-400">フィードバックはまだありません</p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500">{FEEDBACK_TYPE_LABELS[item.type] ?? item.type}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${item.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.status === "done" ? "対応済" : "未対応"}
                    </span>
                    {item.author ? <span className="text-xs text-zinc-400">{item.author}</span> : null}
                    <span className="text-xs text-zinc-300">{new Date(item.created_at).toLocaleDateString("ja-JP")}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-zinc-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 whitespace-pre-wrap">{item.body}</p>
                  {item.page_href ? <p className="mt-0.5 truncate text-[10px] text-zinc-300">{item.page_href}</p> : null}
                </div>
                <button
                  className="shrink-0 rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition hover:bg-zinc-100"
                  onClick={() => void toggle(item)}
                  title={item.status === "done" ? "未対応に戻す" : "対応済にする"}
                  type="button"
                >
                  {item.status === "done" ? <Trash2 className="size-3.5" /> : <Check className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
