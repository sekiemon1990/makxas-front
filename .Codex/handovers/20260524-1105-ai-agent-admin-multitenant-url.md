# Claude Code 引き継ぎ: AIエージェント管理画面の独立URL / マルチアカウント化

生成日時: 2026-05-24 11:05 JST

## 今回やったこと
- ユーザー要望に合わせ、AIエージェント権限管理画面を既存 `/admin` タブから切り離す方針に変更。
- `makxas-front` に専用ページを追加。
  - `/admin/agent-permissions`
  - 画面本体は `app/admin/AgentPermissionsTab.tsx`
  - ページラッパーは `app/admin/agent-permissions/page.tsx`
- 左ナビに `AIエージェント権限` を追加。
  - `components/app-shell.tsx`
- 管理画面用API proxyを追加。
  - `app/api/admin/agent-permissions/route.ts`
  - `app/api/admin/agent-permissions/preview/route.ts`
  - `lib/agent-admin/client.ts`
- `127.0.0.1` でNext.js dev clientが止まらないように `next.config.ts` に `allowedDevOrigins: ["127.0.0.1"]` を追加。
- in-app Browserで `http://127.0.0.1:3025/admin/agent-permissions` を開き、専用ページが表示されることを確認。
- 検証後、ローカルのNext dev server (`3025`) と mock API (`8787`) は停止済み。

## 確定事項
- ユーザー方針:
  - 最初からマルチアカウント化構想で進める。
  - 社内ポータルの一画面ではなく、独自URLのAIエージェント管理コンソールに寄せる。
- 推奨ドメイン案:
  - `https://agents.makxas.com/{tenantSlug}/admin`
  - 例: `https://agents.makxas.com/makxas/admin`
- 役割分担の方向性:
  - 社内ポータル: チームダッシュボードに「使えるAI一覧」を表示する側。
  - AI管理コンソール: エージェント追加/編集、権限、監査ログ、公開/停止、ルータープレビューを管理する側。
  - `makxas-agent`: Chatwork webhook / router / Edge Function / Supabase権限DB側。

## 捨てた選択肢と理由
- `/admin` タブ内にAI権限管理を置く案
  - マルチアカウント外販を考えると、社内ポータルの管理画面に閉じすぎる。
  - テナント切替、契約/プラン、外部顧客管理者のログイン導線と相性が悪い。
- `portal.makxas.com/admin/agent-permissions` を最終URLにする案
  - 既存認証/RBAC流用はしやすいが、外販プロダクトの独立性が弱い。
  - 今回は独自URL前提へ方針転換。
- すぐ完全別repoへ切り出す案
  - 現時点では既存UI/API確認とプロトタイピングの速度を優先し、まず `makxas-front` 内に専用ページを仮実装。
  - 次のセッションで独立アプリ/ドメイン/tenant_id設計へ移行判断する。

## ハマりどころ
- `127.0.0.1:3025` で開いた時、Next.js dev resourceのcross-origin制限でクライアント側クリックが効かない状態が出た。
  - `next.config.ts` に `allowedDevOrigins: ["127.0.0.1"]` を追加して対処。
- `makxas-front` 側の `.env.local.example` は `.gitignore` の `.env*` によりignored。
  - 必要な環境変数例は別のtracked docsへ移すか、`.gitignore` 例外を追加する判断が必要。
- `makxas-agent` 側には現在、AI権限管理とは別に見えるdirty changesがある。
  - branch: `codex/agent-secretary-channels`
  - dirty:
    - `supabase/functions/chatwork-webhook/agents/google_calendar.ts`
    - `supabase/functions/chatwork-webhook/agents/google_calendar_test.ts`
    - `supabase/functions/line-webhook/line_adapter.ts`
    - `supabase/functions/line-webhook/line_adapter_test.ts`
  - これらは今回のAI管理画面作業では触っていないため、Claude Code側でも不用意に戻さないこと。

## 学び
- AIエージェント権限管理は、社内ポータル内の設定画面ではなく、将来の外販SaaS管理コンソールとして扱った方が設計が自然。
- 社内ポータルのユーザー/RBACと連携する必要はあるが、UIの所属先は必ずしも社内ポータルである必要はない。
- ルーター候補制御は、Chatwork room/user/channelに依存するため、管理UIとEdge Functionの判定ロジックを同じデータ構造に寄せるのが重要。

## 次にやること
- 高: Claude Code側で、独自ドメイン/マルチテナント前提の正式設計へ切り直す。
  - `agents.makxas.com/{tenantSlug}/admin` を前提にするか確認。
  - tenant slug / tenant_id / organization_id の責務を決める。
- 高: 現在の `makxas-front` 仮実装をどう扱うか決める。
  - 案A: いったん仮ページとして残し、後で独立appへ移植。
  - 案B: 今すぐ `makxas-agent-admin` など新規/既存repoへ切り出す。
  - 案C: `makxas-front` の中に残すが、URLとデータ構造だけマルチテナント化する。
- 高: DB/APIをtenant前提にする。
  - `agent_permissions`
  - `agent_chatwork_rooms`
  - `agent_room_permission_modes`
  - `agent_room_permissions`
  - `agent_user_permissions`
  - `agent_permission_audit_logs`
  - 上記へ `tenant_id` / `organization_id` をどう付けるか設計。
- 高: Chatwork routerが `tenant_id + channel + room_id + account_id` で候補AIを絞る設計にする。
- 中: 管理画面の認証をどうするか決める。
  - 独立コンソールでも社内ポータルAuthを使うのか。
  - 顧客ごとに招待/管理者/マネージャー権限を持つのか。
- 中: 環境変数例をtracked docsへ移す。
- 中: 本番ドメイン候補 `agents.makxas.com` のDNS/Vercel/SSL設定を行うか判断。
- 低: 既存 `/admin/agent-permissions` は、独立コンソール移行後に削除またはリダイレクト。

## 検証済み
- `makxas-front`
  - `npx eslint app/admin/AdminClient.tsx app/admin/AgentPermissionsTab.tsx app/admin/agent-permissions/page.tsx components/app-shell.tsx app/api/admin/agent-permissions/route.ts app/api/admin/agent-permissions/preview/route.ts lib/agent-admin/client.ts next.config.ts` -> exit 0
  - `npx tsc --noEmit` -> exit 0
  - `git diff --check` -> exit 0
  - Browser: `http://127.0.0.1:3025/admin/agent-permissions` 表示確認済み
- 注意:
  - full `npm run lint` は既存の無関係なReact lintエラーで失敗する状態。今回追加/変更した対象ファイルのlintは通過済み。

## 関連ファイル
- `/Users/kentoseki/repos/makxas-front/app/admin/AgentPermissionsTab.tsx`
- `/Users/kentoseki/repos/makxas-front/app/admin/agent-permissions/page.tsx`
- `/Users/kentoseki/repos/makxas-front/app/api/admin/agent-permissions/route.ts`
- `/Users/kentoseki/repos/makxas-front/app/api/admin/agent-permissions/preview/route.ts`
- `/Users/kentoseki/repos/makxas-front/lib/agent-admin/client.ts`
- `/Users/kentoseki/repos/makxas-front/components/app-shell.tsx`
- `/Users/kentoseki/repos/makxas-front/next.config.ts`
- `/Users/kentoseki/repos/makxas-agent/supabase/functions/chatwork-webhook/agent_admin.ts`
- `/Users/kentoseki/repos/makxas-agent/supabase/migrations/20260523044247_agent_permission_management.sql`

## 関連 PR / branch
- `makxas-front`
  - repo: `/Users/kentoseki/repos/makxas-front`
  - branch: `main`
  - PR: 未作成
- `makxas-agent`
  - repo: `/Users/kentoseki/repos/makxas-agent`
  - branch: `codex/agent-secretary-channels`
  - PR: 既存 draft PRありの可能性あり。直近の別handover参照。

## Claude Code への再開プロンプト案
```text
AIエージェント管理画面の独自URL / マルチアカウント化の引き継ぎです。

まず以下を読んでください。
- /Users/kentoseki/repos/makxas-front/.Codex/handovers/20260524-1105-ai-agent-admin-multitenant-url.md
- /Users/kentoseki/repos/makxas-agent/AGENTS.md
- /Users/kentoseki/repos/makxas-front の既存UI/RBAC/API構成

ユーザー方針:
- 最初からマルチアカウント化構想で進める。
- AIエージェント管理画面は社内ポータル内のタブではなく、独自URLにしたい。
- 推奨案は `https://agents.makxas.com/{tenantSlug}/admin`。

現状:
- makxas-front に仮の専用ページ `/admin/agent-permissions` がある。
- app/admin/AgentPermissionsTab.tsx にUI本体がある。
- API proxy は app/api/admin/agent-permissions 配下。
- components/app-shell.tsx に左ナビ項目を追加済み。
- next.config.ts に allowedDevOrigins: ["127.0.0.1"] を追加済み。
- makxas-agent 側には agent_admin.ts と 20260523044247_agent_permission_management.sql が存在する。
- makxas-agent にはAI権限管理とは別のdirty changesがあるため、絶対に不用意に戻さないでください。

お願い:
1. 独自URL / マルチテナント前提の正式設計へ切り直してください。
2. tenant_id / organization_id / tenantSlug をどのテーブル・API・URLで持つか決めてください。
3. 現在の makxas-front 仮実装を残す/移植する/別repo化するのどれがよいか提案してください。
4. Chatwork routerが tenant + channel + room_id + account_id で承認済みAIだけ候補にする設計に更新してください。
5. UI / 機能 / DB の3点確認ルールに沿って、次の実装計画を作ってください。
```
