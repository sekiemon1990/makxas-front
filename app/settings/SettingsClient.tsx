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

type Tab = "brands" | "stores" | "line" | "email" | "comparison" | "staff" | "templates" | "goals" | "business_hours" | "ai" | "feedback";

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
  { value: "goals", label: "目標設定" },
  { value: "business_hours", label: "営業時間" },
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
          {activeTab !== "ai" && activeTab !== "feedback" && activeTab !== "goals" && activeTab !== "business_hours" ? (
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
              onEdit={async (id, data) => {
                const res = await fetch(`/api/settings/reply-templates/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
                const d = (await res.json()) as { template?: ReplyTemplate };
                if (d.template) {
                  setTemplateList((prev) =>
                    prev.map((t) => (t.id === id ? d.template! : t)),
                  );
                }
              }}
            />
          ) : null}
          {activeTab === "goals" ? <GoalsSection /> : null}
          {activeTab === "business_hours" ? <BusinessHoursSection /> : null}
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
  const [teamSaving, setTeamSaving] = useState<string | null>(null);
  const [calSyncing, setCalSyncing] = useState<string | null>(null);
  const [quoteReviewSaving, setQuoteReviewSaving] = useState<string | null>(null);
  const [quoteReviewFlags, setQuoteReviewFlags] = useState<Record<string, boolean>>(
    Object.fromEntries(staff.map((s) => [s.id, s.requires_quote_review ?? false]))
  );
  const [staffTeams, setStaffTeams] = useState<Record<string, string>>(
    Object.fromEntries(staff.map((s) => [s.id, (s as Staff & { team?: string }).team ?? "IS"]))
  );

  const handleTeamChange = async (staffId: string, team: string) => {
    setTeamSaving(staffId);
    setStaffTeams((prev) => ({ ...prev, [staffId]: team }));
    await fetch("/api/settings/staff-team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, team }),
    });
    setTeamSaving(null);
  };

  const handleCalSync = async (staffId: string) => {
    setCalSyncing(staffId);
    await fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId }),
    });
    setCalSyncing(null);
  };

  const handleQuoteReviewToggle = async (staffId: string, value: boolean) => {
    setQuoteReviewSaving(staffId);
    setQuoteReviewFlags((prev) => ({ ...prev, [staffId]: value }));
    await fetch("/api/settings/staff-quote-review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, requires_quote_review: value }),
    });
    setQuoteReviewSaving(null);
  };

  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>スタッフ管理</CardTitle>
        <CardDescription>チーム区分・Googleカレンダー連携・ブランドアクセス権</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {staff.map((member) => {
          const brandsForMember = access.filter(
            (item) => item.staff_id === member.id,
          );
          const currentTeam = staffTeams[member.id] ?? "IS";

          return (
            <Row key={member.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{member.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${currentTeam === "FS" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {currentTeam}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {member.email} / {roleLabel(member.role)}
                </p>
                {/* FS スタッフ: Google Calendar 連携ボタン */}
                {currentTeam === "FS" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={`/api/calendar/connect?staff_id=${member.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Googleカレンダーを連携
                    </a>
                    <button
                      onClick={() => void handleCalSync(member.id)}
                      disabled={calSyncing === member.id}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
                      type="button"
                    >
                      {calSyncing === member.id ? "同期中…" : "今すぐ同期"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* チーム切替 */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-400">チーム:</span>
                  <select
                    value={currentTeam}
                    onChange={(e) => void handleTeamChange(member.id, e.target.value)}
                    disabled={teamSaving === member.id}
                    className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs focus:outline-none"
                  >
                    <option value="IS">IS（インサイドセールス）</option>
                    <option value="FS">FS（フィールドセールス）</option>
                  </select>
                  {teamSaving === member.id ? <Loader2 className="size-3 animate-spin text-zinc-400" /> : null}
                </div>
                {/* 査定要確認トグル */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400">査定要確認:</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={quoteReviewFlags[member.id] ?? false}
                    disabled={quoteReviewSaving === member.id}
                    onClick={() => void handleQuoteReviewToggle(member.id, !(quoteReviewFlags[member.id] ?? false))}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                      quoteReviewFlags[member.id] ? "bg-amber-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        quoteReviewFlags[member.id] ? "translate-x-3" : "translate-x-0"
                      }`}
                    />
                  </button>
                  {quoteReviewSaving === member.id ? <Loader2 className="size-3 animate-spin text-zinc-400" /> : null}
                </div>
                {/* ブランドアクセス */}
                <div className="flex flex-wrap justify-end gap-1.5">
                  {brandsForMember.length > 0 ? (
                    brandsForMember.map((item) => (
                      <Badge
                        key={`${item.staff_id}-${item.brand_id}`}
                        variant="outline"
                        className="rounded-md bg-white text-[11px]"
                      >
                        {item.brands?.name ?? "ブランド不明"}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-400">ブランド未設定</span>
                  )}
                </div>
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

// 変数プレースホルダー一覧
const TEMPLATE_VARIABLES = [
  { label: "お名前", value: "{{お名前}}" },
  { label: "品目", value: "{{品目}}" },
  { label: "査定日時", value: "{{査定日時}}" },
  { label: "担当者名", value: "{{担当者名}}" },
  { label: "店舗名", value: "{{店舗名}}" },
];

function TemplatesList({
  templates,
  onDelete,
  onEdit,
}: {
  templates: ReplyTemplate[];
  onDelete: (id: string) => void;
  onEdit: (id: string, data: { name: string; body: string }) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = (t: ReplyTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditBody(t.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditBody("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editBody.trim()) return;
    setSaving(true);
    await onEdit(editingId, { name: editName.trim(), body: editBody.trim() });
    setSaving(false);
    setEditingId(null);
  };

  const insertVariable = (v: string) => {
    const el = bodyRef.current;
    if (!el) { setEditBody((prev) => prev + v); return; }
    const start = el.selectionStart ?? editBody.length;
    const end = el.selectionEnd ?? editBody.length;
    const next = editBody.slice(0, start) + v + editBody.slice(end);
    setEditBody(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  };

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
          className="rounded-lg border border-zinc-200 px-4 py-3"
        >
          {editingId === t.id ? (
            /* 編集モード */
            <div className="space-y-3">
              <input
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="テンプレート名"
              />
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => insertVariable(v.value)}
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100"
                    >
                      {v.label}を挿入
                    </button>
                  ))}
                </div>
                <textarea
                  ref={bodyRef}
                  className="min-h-28 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="本文"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={saving} onClick={saveEdit} type="button">
                  {saving ? "保存中..." : "保存"}
                </Button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-zinc-500 hover:text-zinc-800"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            /* 表示モード */
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                <p
                  className={`mt-1 text-sm text-zinc-500 ${expanded.has(t.id) ? "whitespace-pre-wrap" : "line-clamp-2"}`}
                >
                  {t.body}
                </p>
                {t.body.length > 80 ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-zinc-400 hover:text-zinc-600"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                        return next;
                      })
                    }
                  >
                    {expanded.has(t.id) ? "▲ 折りたたむ" : "▼ 全文を見る"}
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  className="text-xs text-zinc-400 hover:text-zinc-700"
                  onClick={() => startEdit(t)}
                  type="button"
                >
                  編集
                </button>
                <button
                  className="text-xs text-zinc-400 hover:text-red-500"
                  onClick={() => onDelete(t.id)}
                  type="button"
                >
                  削除
                </button>
              </div>
            </div>
          )}
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (v: string) => {
    const el = bodyRef.current;
    if (!el) { onBodyChange(body + v); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + v + body.slice(end);
    onBodyChange(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  };

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
        <div className="mb-1.5 flex flex-wrap gap-1">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => insertVariable(v.value)}
              className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100"
            >
              {v.label}を挿入
            </button>
          ))}
        </div>
        <textarea
          ref={bodyRef}
          className="min-h-32 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={`例: {{お名前}} 様\n\nこの度はお問い合わせいただきありがとうございます。\n担当の{{担当者名}}でございます。`}
          required
          value={body}
        />
        <p className="text-xs text-zinc-400">
          {'{{お名前}} などの変数は送信時に自動的に置き換えられます'}
        </p>
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
    goals: "/api/settings/goals",
    business_hours: "/api/settings/business-hours",
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

/* ── 営業時間設定セクション ──────────────────────────── */
const DAY_OF_WEEK_LABELS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

type BusinessHourRow = {
  id?: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

const DEFAULT_HOURS: BusinessHourRow[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: "10:00",
  close_time: "19:00",
  is_closed: i === 0, // 日曜のみ定休
}));

function BusinessHoursSection() {
  const [hours, setHours] = useState<BusinessHourRow[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/business-hours")
      .then((r) => r.json())
      .then((d: { business_hours?: BusinessHourRow[] }) => {
        if (d.business_hours && d.business_hours.length > 0) {
          // 7日分を揃える
          const map = Object.fromEntries(d.business_hours.map((h) => [h.day_of_week, h]));
          setHours(DEFAULT_HOURS.map((def) => map[def.day_of_week] ?? def));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (dow: number, field: keyof BusinessHourRow, value: string | boolean) => {
    setHours((prev) => prev.map((h) => h.day_of_week === dow ? { ...h, [field]: value } : h));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings/business-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="size-4 animate-spin" />読み込み中...
      </div>
    );
  }

  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>営業時間設定</CardTitle>
        <CardDescription>反響受付・シフト管理で使用します（デフォルト: 月〜土 10:00〜19:00）</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-zinc-100">
          {hours.map((h) => (
            <div key={h.day_of_week} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`w-16 text-sm font-medium ${h.day_of_week === 0 ? "text-red-600" : h.day_of_week === 6 ? "text-blue-600" : "text-zinc-900"}`}>
                {DAY_OF_WEEK_LABELS[h.day_of_week]}
              </span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={h.is_closed}
                  onChange={(e) => update(h.day_of_week, "is_closed", e.target.checked)}
                  className="rounded"
                />
                <span className="text-zinc-500">定休日</span>
              </label>
              {!h.is_closed ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.open_time}
                      onChange={(e) => update(h.day_of_week, "open_time", e.target.value)}
                      className="h-8 rounded-md border border-zinc-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                    <span className="text-zinc-400">〜</span>
                    <input
                      type="time"
                      value={h.close_time}
                      onChange={(e) => update(h.day_of_week, "close_time", e.target.value)}
                      className="h-8 rounded-md border border-zinc-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                  </div>
                </>
              ) : (
                <span className="text-sm text-zinc-400">—</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            保存
          </Button>
          {saved ? <span className="flex items-center gap-1 text-sm text-emerald-600"><Check className="size-4" />保存しました</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── 目標設定セクション ──────────────────────────────── */
type MonthlyGoal = {
  id: string;
  month: string;       // "YYYY-MM-01"
  goal_type: string;
  target: number;
  label: string | null;
};

const GOAL_TYPE_OPTIONS = [
  { value: "appointments", label: "アポ件数" },
  { value: "inquiries", label: "反響件数" },
  { value: "conversion_rate", label: "アポ率（%）" },
  { value: "avg_items", label: "平均仕入点数" },
];

function goalTypeLabel(type: string) {
  return GOAL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function GoalsSection() {
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [goalType, setGoalType] = useState("appointments");
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/settings/goals")
      .then((r) => r.json())
      .then((d: { goals?: MonthlyGoal[] }) => setGoals(d.goals ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month || !goalType || !target) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, goal_type: goalType, target: Number(target), label: label || undefined }),
    });
    const d = (await res.json()) as { goal?: MonthlyGoal; error?: string };
    setSaving(false);
    if (d.error) { setError(d.error); return; }
    if (d.goal) {
      setGoals((prev) => {
        const idx = prev.findIndex((g) => g.id === d.goal!.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = d.goal!;
          return next;
        }
        return [d.goal!, ...prev];
      });
      setTarget("");
      setLabel("");
    }
  };

  const remove = async (id: string) => {
    await fetch("/api/settings/goals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  // group by month
  const grouped = goals.reduce<Record<string, MonthlyGoal[]>>((acc, g) => {
    const key = g.month.slice(0, 7); // "YYYY-MM"
    (acc[key] ??= []).push(g);
    return acc;
  }, {});
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>月次目標を追加・更新</CardTitle>
          <CardDescription>同じ月・目標タイプを再登録すると上書き更新されます</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">月</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">目標タイプ</label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                {GOAL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">目標値</label>
              <Input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="例: 20"
                required
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">ラベル（任意）</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="例: 今月の目標"
                className="w-40"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              保存
            </Button>
          </form>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />読み込み中...
        </div>
      ) : sortedMonths.length === 0 ? (
        <p className="text-sm text-zinc-400">まだ目標が設定されていません</p>
      ) : (
        sortedMonths.map((m) => (
          <Card key={m} className="rounded-lg border-zinc-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{m.replace("-", "年")}月</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-zinc-100">
                {(grouped[m] ?? []).map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-900">{goalTypeLabel(g.goal_type)}</span>
                      <span className="text-sm text-zinc-500">目標: <strong>{g.target.toLocaleString()}</strong></span>
                      {g.label ? <span className="text-xs text-zinc-400">{g.label}</span> : null}
                    </div>
                    <button
                      className="shrink-0 rounded-lg border border-zinc-200 p-1.5 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      onClick={() => void remove(g.id)}
                      title="削除"
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
