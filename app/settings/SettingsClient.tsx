"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

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
  ComparisonSiteAccount,
  EmailAccount,
  LineAccount,
  Staff,
  StaffStoreAccess,
  Store,
} from "@/types/database";

type Tab = "stores" | "line" | "email" | "comparison" | "staff";

type StoreRef = Pick<Store, "id" | "name">;

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "stores", label: "店舗管理" },
  { value: "line", label: "LINEアカウント" },
  { value: "email", label: "メールアカウント" },
  { value: "comparison", label: "比較サイト" },
  { value: "staff", label: "スタッフ管理" },
];

export function SettingsClient({
  comparisonAccounts,
  emailAccounts,
  lineAccounts,
  staff,
  staffAccess,
  stores,
}: {
  comparisonAccounts: Array<
    ComparisonSiteAccount & { stores: StoreRef | null }
  >;
  emailAccounts: Array<EmailAccount & { stores: StoreRef | null }>;
  lineAccounts: Array<LineAccount & { stores: StoreRef | null }>;
  staff: Staff[];
  staffAccess: Array<
    StaffStoreAccess & {
      staff: Pick<Staff, "id" | "name" | "email"> | null;
      stores: StoreRef | null;
    }
  >;
  stores: Store[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("stores");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalTitle = useMemo(() => {
    if (activeTab === "staff") return "店舗アクセス権を追加";
    return `${tabs.find((tab) => tab.value === activeTab)?.label ?? ""}を追加`;
  }, [activeTab]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

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
          <Button onClick={() => setOpen(true)} type="button">
            <Plus className="size-4" aria-hidden="true" />
            追加
          </Button>
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
            <StaffAccessList access={staffAccess} staff={staff} />
          ) : null}
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
                店舗を中心に各チャンネルの接続情報を管理します。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              {activeTab === "stores" ? <StoreForm /> : null}
              {activeTab === "line" ? <LineForm stores={stores} /> : null}
              {activeTab === "email" ? <EmailForm stores={stores} /> : null}
              {activeTab === "comparison" ? (
                <ComparisonForm stores={stores} />
              ) : null}
              {activeTab === "staff" ? (
                <StaffAccessForm staff={staff} stores={stores} />
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

function StoresList({ stores }: { stores: Store[] }) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>店舗一覧</CardTitle>
        <CardDescription>全チャンネルの親となる店舗マスタ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {stores.map((store) => (
          <Row key={store.id}>
            <div>
              <p className="font-medium">{store.name}</p>
              <p className="mt-1 text-xs text-zinc-500">
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
  accounts: Array<LineAccount & { stores: StoreRef | null }>;
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
  accounts: Array<EmailAccount & { stores: StoreRef | null }>;
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
  accounts: Array<ComparisonSiteAccount & { stores: StoreRef | null }>;
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
    StaffStoreAccess & {
      staff: Pick<Staff, "id" | "name" | "email"> | null;
      stores: StoreRef | null;
    }
  >;
  staff: Staff[];
}) {
  return (
    <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>スタッフ管理</CardTitle>
        <CardDescription>スタッフと閲覧可能店舗の対応</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {staff.map((member) => {
          const storesForMember = access.filter(
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
                {storesForMember.length > 0 ? (
                  storesForMember.map((item) => (
                    <Badge
                      key={`${item.staff_id}-${item.store_id}`}
                      variant="outline"
                      className="rounded-md bg-white"
                    >
                      {item.stores?.name ?? "店舗不明"}
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

function StoreForm() {
  return (
    <>
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

function LineForm({ stores }: { stores: Store[] }) {
  return (
    <>
      <Field label="アカウント名">
        <Input name="name" required />
      </Field>
      <StoreSelect stores={stores} />
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

function EmailForm({ stores }: { stores: Store[] }) {
  return (
    <>
      <StoreSelect stores={stores} />
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

function ComparisonForm({ stores }: { stores: Store[] }) {
  return (
    <>
      <StoreSelect stores={stores} />
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
  staff,
  stores,
}: {
  staff: Staff[];
  stores: Store[];
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
      <StoreSelect stores={stores} />
    </>
  );
}

function StoreSelect({ stores }: { stores: Store[] }) {
  return (
    <Field label="店舗">
      <NativeSelect name="store_id">
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
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
}: {
  children: React.ReactNode;
  name: string;
}) {
  return (
    <select
      className="h-9 rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
      name={name}
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
    stores: "/api/settings/stores",
    line: "/api/settings/line-accounts",
    email: "/api/settings/email-accounts",
    comparison: "/api/settings/comparison-accounts",
    staff: "/api/settings/staff-store-access",
  };

  return endpoints[tab];
}

function payloadFor(tab: Tab, formData: FormData) {
  const value = (name: string) => String(formData.get(name) ?? "");

  if (tab === "stores") {
    return {
      name: value("name"),
      store_code: value("store_code"),
      store_type: value("store_type"),
    };
  }

  if (tab === "line") {
    return {
      name: value("name"),
      store_id: value("store_id"),
      channel_id: value("channel_id"),
      channel_secret: value("channel_secret"),
      channel_access_token: value("channel_access_token"),
      destination: value("destination"),
    };
  }

  if (tab === "email") {
    return {
      store_id: value("store_id"),
      email: value("email"),
      display_name: value("display_name"),
      purpose: value("purpose"),
    };
  }

  if (tab === "comparison") {
    return {
      store_id: value("store_id"),
      site: value("site"),
      account_email: value("account_email"),
      notification_email: value("notification_email"),
    };
  }

  return {
    staff_id: value("staff_id"),
    store_id: value("store_id"),
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
