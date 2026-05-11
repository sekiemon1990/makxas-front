"use client";

import { useState } from "react";
import {
  Shield,
  Tags,
  GitBranch,
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AssignmentRule, Staff, TagMaster } from "@/types/database";

const CHANNELS = [
  { value: "", label: "全チャンネル" },
  { value: "line", label: "LINE" },
  { value: "web_form", label: "Webフォーム" },
  { value: "email", label: "メール" },
  { value: "phone", label: "電話" },
  { value: "oikura", label: "おいくら" },
  { value: "uridoki", label: "ウリドキ" },
  { value: "hikakaku", label: "ヒカカク" },
];

const ROLES = [
  { value: "admin", label: "管理者", color: "bg-purple-100 text-purple-700" },
  { value: "operator", label: "オペレーター", color: "bg-blue-100 text-blue-700" },
  { value: "viewer", label: "閲覧のみ", color: "bg-zinc-100 text-zinc-600" },
];

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#000000",
];

type Props = {
  initialStaff: Staff[];
  initialTags: TagMaster[];
  initialRules: Array<AssignmentRule & { staff: Pick<Staff, "id" | "name"> | null }>;
  allStaff: Staff[];
};

type Tab = "staff" | "tags" | "rules";

export function AdminClient({ initialStaff, initialTags, initialRules, allStaff }: Props) {
  const [tab, setTab] = useState<Tab>("staff");
  const [staff, setStaff] = useState(initialStaff);
  const [tags, setTags] = useState(initialTags);
  const [rules, setRules] = useState(initialRules);

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">管理</h1>
        </div>

        {/* タブ */}
        <div className="mb-6 flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          {[
            { id: "staff" as Tab, label: "スタッフ管理", icon: Users },
            { id: "tags" as Tab, label: "タグ管理", icon: Tags },
            { id: "rules" as Tab, label: "振り分けルール", icon: GitBranch },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "staff" && (
          <StaffTab staff={staff} setStaff={setStaff} />
        )}
        {tab === "tags" && (
          <TagsTab tags={tags} setTags={setTags} />
        )}
        {tab === "rules" && (
          <RulesTab rules={rules} setRules={setRules} allStaff={allStaff} />
        )}
      </div>
    </div>
  );
}

/* ─── スタッフ管理タブ ─── */
function StaffTab({ staff, setStaff }: { staff: Staff[]; setStaff: (s: Staff[]) => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  const updateStaff = async (id: string, patch: Partial<Staff>) => {
    setSaving(id);
    const res = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const d = (await res.json()) as { staff?: Staff };
    if (d.staff) {
      setStaff(staff.map((s) => (s.id === id ? { ...s, ...d.staff } : s)));
    }
    setSaving(null);
  };

  return (
    <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-4" />
          スタッフ管理
        </CardTitle>
        <CardDescription>ロールの変更・アカウントの有効/無効化</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="py-3 pl-6 text-left text-xs font-semibold text-zinc-500">名前</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">メール</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ロール</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">状態</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                <td className="py-3 pl-6 font-medium text-zinc-900">{s.name}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{s.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={s.role}
                    disabled={saving === s.id}
                    onChange={(e) => void updateStaff(s.id, { role: e.target.value as Staff["role"] })}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => void updateStaff(s.id, { is_active: !s.is_active })}
                    disabled={saving === s.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                    title={s.is_active ? "無効化" : "有効化"}
                  >
                    {s.is_active ? (
                      <><ToggleRight className="size-5 text-green-500" /><span className="text-green-600">有効</span></>
                    ) : (
                      <><ToggleLeft className="size-5 text-zinc-400" /><span className="text-zinc-400">無効</span></>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ─── タグ管理タブ ─── */
function TagsTab({ tags, setTags }: { tags: TagMaster[]; setTags: (t: TagMaster[]) => void }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const addTag = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor, sort_order: tags.length }),
    });
    const d = (await res.json()) as { tag?: TagMaster };
    if (d.tag) {
      setTags([...tags, d.tag]);
      setNewName("");
    }
    setSaving(false);
  };

  const toggleActive = async (tag: TagMaster) => {
    const res = await fetch(`/api/admin/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !tag.is_active }),
    });
    const d = (await res.json()) as { tag?: TagMaster };
    if (d.tag) setTags(tags.map((t) => (t.id === tag.id ? d.tag! : t)));
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/admin/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const d = (await res.json()) as { tag?: TagMaster };
    if (d.tag) {
      setTags(tags.map((t) => (t.id === id ? d.tag! : t)));
      setEditId(null);
    }
  };

  const deleteTag = async (id: string) => {
    await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
    setTags(tags.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* 追加フォーム */}
      <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            タグを追加
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="タグ名（例: ブランド品, 家具）"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && void addTag()}
            />
            <div className="flex items-center gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-6 w-6 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-offset-1 ring-zinc-950" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button onClick={() => void addTag()} disabled={saving || !newName.trim()} size="sm">
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* タグ一覧 */}
      <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-4" />
            タグ一覧
          </CardTitle>
          <CardDescription>インボックスで使用できるタグを管理します</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tags.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zinc-400">タグがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-3 pl-6 text-left text-xs font-semibold text-zinc-500">タグ名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">カラー</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">状態</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="py-3 pl-6">
                      {editId === tag.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 w-40 text-xs"
                            onKeyDown={(e) => e.key === "Enter" && void saveEdit(tag.id)}
                            autoFocus
                          />
                          <button onClick={() => void saveEdit(tag.id)} className="text-green-600 hover:text-green-700">
                            <Check className="size-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="text-zinc-400 hover:text-zinc-600">
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: tag.color }} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => void toggleActive(tag)} className="text-xs">
                        {tag.is_active ? (
                          <span className="text-green-600">有効</span>
                        ) : (
                          <span className="text-zinc-400">無効</span>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditId(tag.id); setEditName(tag.name); }}
                          className="text-zinc-400 hover:text-zinc-700"
                          title="編集"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => void deleteTag(tag.id)}
                          className="text-zinc-400 hover:text-red-600"
                          title="削除"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── 振り分けルールタブ ─── */
type RuleWithStaff = AssignmentRule & { staff: Pick<Staff, "id" | "name"> | null };

function RulesTab({
  rules,
  setRules,
  allStaff,
}: {
  rules: RuleWithStaff[];
  setRules: (r: RuleWithStaff[]) => void;
  allStaff: Staff[];
}) {
  const [form, setForm] = useState({ name: "", channel: "", keyword: "", assigned_staff_id: "" });
  const [saving, setSaving] = useState(false);

  const addRule = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/assignment-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        channel: form.channel || null,
        keyword: form.keyword.trim() || null,
        assigned_staff_id: form.assigned_staff_id || null,
        priority: rules.length,
      }),
    });
    const d = (await res.json()) as { rule?: RuleWithStaff };
    if (d.rule) {
      setRules([...rules, d.rule]);
      setForm({ name: "", channel: "", keyword: "", assigned_staff_id: "" });
    }
    setSaving(false);
  };

  const toggleRule = async (rule: RuleWithStaff) => {
    const res = await fetch(`/api/admin/assignment-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    const d = (await res.json()) as { rule?: RuleWithStaff };
    if (d.rule) setRules(rules.map((r) => (r.id === rule.id ? d.rule! : r)));
  };

  const deleteRule = async (id: string) => {
    await fetch(`/api/admin/assignment-rules/${id}`, { method: "DELETE" });
    setRules(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* 追加フォーム */}
      <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            ルールを追加
          </CardTitle>
          <CardDescription>条件に一致した反響を自動で担当者にアサインします</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ルール名（例: LINE→田中担当）"
              className="flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">チャンネル</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">キーワード（任意）</label>
              <Input
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="例: ブランド品"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">担当者</label>
              <select
                value={form.assigned_staff_id}
                onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                <option value="">未割当</option>
                {allStaff.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={() => void addRule()} disabled={saving || !form.name.trim()} size="sm">
            ルールを追加
          </Button>
        </CardContent>
      </Card>

      {/* ルール一覧 */}
      <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            振り分けルール一覧
          </CardTitle>
          <CardDescription>優先度の高い順（上から）に評価されます</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zinc-400">ルールがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-3 pl-6 text-left text-xs font-semibold text-zinc-500">ルール名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">チャンネル</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">キーワード</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">担当者</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">状態</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className={`border-b border-zinc-50 last:border-0 hover:bg-zinc-50 ${!rule.is_active ? "opacity-50" : ""}`}>
                    <td className="py-3 pl-6 font-medium text-zinc-900">{rule.name}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {rule.channel ? CHANNELS.find((c) => c.value === rule.channel)?.label ?? rule.channel : <span className="text-zinc-400">全て</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {rule.keyword ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{rule.keyword}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {rule.staff?.name ?? <span className="text-zinc-400">未割当</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => void toggleRule(rule)} className="text-xs">
                        {rule.is_active ? (
                          <span className="text-green-600">有効</span>
                        ) : (
                          <span className="text-zinc-400">無効</span>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => void deleteRule(rule.id)}
                        className="text-zinc-400 hover:text-red-600"
                        title="削除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
