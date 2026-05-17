<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# makxas-front 開発メモ

## 概要
- 目的: マクサス社が運営する全買取ブランドのインサイドセールスチーム向け、反響・リード一元管理システム
- 対象ブランド（屋号）: 買取マクサス・銀座リパール・ブックリバー・カグウル 等（全て買取事業）
  - チャネル（LINE・メール・電話等）はブランドごとに別アカウントを持つ → マルチブランド×マルチアカウント構成
  - DBの `stores` テーブルがブランド/店舗の親となり、全チャネルはstoreに紐付く
- 担当範囲: 反響受付（LINE/Webフォーム/メール/電話/比較サイト）→ アポ取得 → マクサスコアへ引き継ぎ
- スタッフ規模: 4〜10名
- 反響件数: 月500件以上（全ブランド合計）
- 個人情報: 取り扱いあり（リード氏名・電話・メール・LINE ID）
- 顧客接点: あり（/inquiry 公開Webフォームは一般公開）
- 業務クリティカル度: **高**（顧客接点あり・個人情報あり）
- 社内コミュニケーション: **Chatwork**（スタッフ間連絡・通知・問い合わせ対応はすべてChatwork）
- 関連システム: マクサスコア（基幹システム / makxascore.com）← アポ取得時に双方向連携

## ロール分担
- **Claude Code**: 設計・仕様決定・コードレビュー・Codex向け指示作成
- **Codex**: 実装（コード生成・ファイル作成）

## フェーズ

### Phase 1 ✅ 完了
Supabase構築 / Google認証 / LINE受信返信 / Webフォーム / 統合インボックス / アポ設定 / Vercelデプロイ / マルチブランド・マルチアカウント / 設定UI

### Phase 1.5（実運用開始）
- 本番LINEアカウント登録（/settings）
- LINE Webhook URL本番切り替え
- スタッフアカウント登録

### Phase 2（1〜2ヶ月）
- 比較サイト対応（おいくら・ウリドキ・ヒカカク）: メール受信→GPT構造化→Inbox取込
- Gmail受信連携: メール問い合わせをInboxに集約
- Resendメール送信: システムからメール返信
- マクサスコアAPI正式連携: アポ取得時にREST POST
- makxas-phone統合（Twilio + Railway）: 電話反響もInboxで管理
- 全返信に対応者記録: messages.sent_by を必須化・表示

### Phase 3（2〜3ヶ月後）
- **AI返信サジェスト**: 受信メッセージが届いた瞬間にClaude APIで会話履歴を読んで返信案を自動生成し、返信入力欄にデフォルト表示。スタッフはそのまま送信 or 修正して送信。複数案も表示可能。
- **未返信アラート + 通知**: 一定時間返信なしでPC通知・プッシュ通知・Chatwork通知
- **ダッシュボード**: チャネル別・ブランド別の反響数・アポ率・平均応答時間
- **アポ自動確認メッセージ**: アポ確定時にリードへLINEで自動送信
- **タグオートコンプリート**: 既存タグを候補表示し表記ゆれ防止
- **Inboxページネーション**: 50件超の反響に対応
- **モバイルレスポンシブ**: スマホからの確認・返信対応
- **リード重複検出**: 同一電話/LINEで複数ブランドへの問い合わせを自動統合
- **スタッフメンション**: 内部メモで @名前 通知

### Phase 4（将来）
- AI即時架電: アポ取得前の自動電話フォロー
- 優先度スコアリング: 成約確率の高いリードを自動で上位表示

## アーキテクチャ
- フロント: Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind CSS v4
- DB / Auth / Realtime: Supabase (PostgreSQL 16)
- ホスティング: Vercel（Pro・既存）
- 状態管理: Zustand
- LINE統合: @line/bot-sdk v9
- メール送信: Resend（Phase 2）
- メール受信: Gmail API ポーリング（Phase 2）
- 比較サイト: メール解析（GPT-4o-mini）+ スクレイピング（Phase 2）
- 電話: Twilio + Railway（makxas-phone流用、Phase 2）
- マクサスコア連携: REST API or Webhook（Phase 1暫定はGoogle Sheets書き出し）

## コスト
**全 session 必読。新ツール追加時は必ず更新すること。**

| サービス | プラン | 月額 | 備考 |
|---|---|---|---|
| Vercel | Pro（共有） | $20/月 | 全プロダクト共通・100 deploy/日 |
| Supabase | Free → 要件次第でPro | $0 / $25 | 容量500MB超・同時接続50超でPro昇格 |
| LINE Messaging API | 無料プラン | ¥0〜 | 200通/月無料・超過¥3/通（月500件反響で約¥1,800/月想定） |
| Resend | Free | $0 | 3,000通/月無料（Phase 2〜） |
| OpenAI GPT-4o-mini | 従量 | $0.15/1M tokens | 比較サイト解析 月500件 ≒ $0.1以下（Phase 2〜） |
| Twilio | 従量 | $1/番号 + $0.013/分 | Phase 2〜 |

**Phase 1 追加コスト目安: 月500〜2,000円程度**

Supabase Pro昇格の判断基準: DB容量400MB超 / 同時接続上限頻発 / バックアップ必要時

## 環境変数（Phase 1）
| 変数名 | 用途 | 取得元 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | SupabaseプロジェクトURL | Supabase ダッシュボード |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase匿名キー | Supabase ダッシュボード |
| SUPABASE_SERVICE_ROLE_KEY | サービスロールキー（サーバーサイドのみ） | Supabase ダッシュボード |
| LINE_CHANNEL_SECRET | LINE署名検証 | LINE Developers |
| LINE_CHANNEL_ACCESS_TOKEN | LINE送信用トークン | LINE Developers |
| GOOGLE_SERVICE_ACCOUNT_EMAIL | Google Sheets書き出し（暫定コア連携） | Google Cloud Console |
| GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY | 同上 | Google Cloud Console |
| CORE_SYNC_SHEET_ID | 書き出し先スプレッドシートID | Google Sheets URL |

## DBスキーマ（主要テーブル）
- `leads`: リード（LINE ID / 電話 / メール / 氏名）
- `inquiries`: 反響本体（チャネル / ステータス / 担当者 / 内部メモ）
- `messages`: メッセージスレッド
- `appointments`: アポ情報（査定日時 / 品目 / 住所 / コア連携日時）
- `staff`: スタッフ（auth_id / 名前 / ロール）
- `core_sync_log`: マクサスコア連携ログ
- `inquiry_tags`: タグ（inquiry_id + tag の複合PK）
- `call_sessions`: 電話セッション（Phase 2〜）
- `email_accounts`: メールアカウント設定（Phase 2〜）

## マクサスコア連携

### API 接続情報（2026-05 確認済み）
- **認証**: `Authorization: Token <CORE_API_TOKEN>` (HTTP Token Auth)
- **トークン**: `core-rails/config/initializers/002_constants.rb` の `MAKXAS_CORE_API_TOKEN`（.env.local の `CORE_API_TOKEN` に設定済み）
- **ローカルURL**: `http://localhost:3000`（env var: `CORE_RAILS_URL`）
- **疎通確認**: `GET /api/banks` → 200 OK（トークン認証動作確認済み）

### 既存 API エンドポイントの注意点
- `POST /api/projects` → **sokkin（ヤマト宅配集荷）専用**。IS→FS アポ連携には使えない
- `GET /api/banks` / `GET /api/bank_branches` → 銀行マスタ（参照のみ）
- `POST /api/movements` / `PUT /api/stocks/:id` → 在庫操作（不要）

### IS→FS アポ連携に必要な新エンドポイント（小湊さん依頼事項）
**`POST /api/front/appointments`** を作成してもらう必要あり。

期待するリクエスト仕様:
- 認証: `Authorization: Token <MAKXAS_CORE_API_TOKEN>`
- Content-Type: `application/json`
- リクエストボディ:
  - `appointment.sourceId` (string) - makxas-front 側の appointment.id
  - `appointment.sourceType` = "inside_sales"
  - `appointment.scheduledAt` (ISO 8601)
  - `appointment.itemCategory` (string | null)
  - `appointment.itemDescription` (string | null)
  - `appointment.address` (string | null)
  - `appointment.preferredMethod` = "visit" | "delivery"
  - `appointment.additionalItemsConfirmed` (object | null) - アポモーダルの追加品確認チェック結果
  - `lead.displayName`, `lead.phone`, `lead.email`, `lead.lineUserId`
  - `inquiry.id`, `inquiry.channel`, `inquiry.internalNote`, `inquiry.sourceSite`, `inquiry.frontUrl`
- レスポンス: `{ coreAppointmentId: string, coreProjectUrl: string }`

### 現在の連携フロー
- **優先**: `POST /api/front/appointments`（エンドポイント作成後に即時切替）
- **フォールバック**: Google Sheets 書き出し（CORE_SYNC_SHEET_ID が設定されている場合）
- 実装: `lib/core/sync.ts` の `syncAppointmentToCore()`
- ログ: `core_sync_log` テーブルに結果を記録（成功/失敗・エラーメッセージ）

### フィードバック受信
- 受信エンドポイント: `POST /api/webhooks/core/result`
- 受信データ: `{ core_appointment_id, result: "won|lost", amount, memo }`

## ブランチ運用
- main 直接 push 禁止（PR ベース）
- Vercel: main merge で自動デプロイ（Vercel Pro共有枠）

## 未決事項
| # | 内容 | 優先度 |
|---|---|---|
| 1 | ~~マクサスコアにAPIがあるか確認~~ → ✅ 確認済み。既存 `POST /api/projects` は sokkin 専用で使えない。**`POST /api/front/appointments` の新規作成を小湊さんに依頼する必要あり** | 高 |
| 2 | コアへ渡す項目の最終確認（AGENTS.md「IS→FS アポ連携に必要な新エンドポイント」の仕様を小湊さんと確認） | 高 |
| 3 | LINE Channel Secret / Access Token の取得 | 高（Phase 1実装時） |
| 4 | Google Sheetsの書き出し先シートID（フォールバック用・任意） | 低（core-rails API が完成すれば不要） |

---

## Codex CLI との分業

このプロジェクトでは Claude Code と Codex CLI を **タスクの規模・難易度で使い分ける**。コピペ往復を避けるため、`/codex` および `/codex-review` スラッシュコマンドで Codex を直接呼び出す。

### 役割分担の判断基準

- **小〜中規模の実装・修正・調査** → Claude Code が直接実装（Codex 委譲しない）
- **大規模／設計が複雑な実装** → Claude Code は設計・指示作成・レビューに専念し、Codex に実装を委譲

委譲するかどうかはユーザーから明示指示がある場合のみ Codex を使う。ユーザーが指示していないのに勝手に Codex に委譲しないこと。

### Codex 委譲時のフロー

1. Claude Code 側で要件を整理し、Codex に渡す指示文（必要なファイル内容・型定義・受け入れ基準を含む）を作成する
2. `/codex <指示>` で Codex に実装させ、出力を取り込む
3. 取り込んだ実装を Claude Code 側でレビューし、必要なら修正・追加指示
4. 大きめの差分は `/codex-review` で Codex 側にもクロスレビューさせると盲点が減る

### 暴走防止ルール（必ず守る）

- 同一タスクで `/codex` 往復は最大 3 回まで。4 回目以降は人間に判断を仰ぐ
- 1 PR は概ね 300 行以内。超えそうなら Issue を分割する
- 受け入れ条件にない変更は実装しない（範囲外への拡張禁止）
- Supabase RLS の権限緩和、依存関係のメジャーバージョン更新、CI 設定変更は人間の承認必須

## GitHub 運用

- Issue は `.github/ISSUE_TEMPLATE/` のテンプレートに従う
- PR は `.github/pull_request_template.md` に従う。1 Issue = 1 PR、本文に `Closes #N` を必ず書く
- ラベル運用: `needs-design` / `ready-for-codex` / `in-progress` / `needs-review` / `blocked`
- コミットメッセージ: `feat:` `fix:` `chore:` `docs:` `refactor:` のいずれかをプレフィックス

### Codex に指示を渡すときの注意

- Codex は別セッションでリポジトリ状態を共有しないため、関連ファイルの内容や型定義をプロンプトに含める
- ファイル編集まで自動で行わせる場合は `codex --full-auto` を使う（既定は読み取りのみ）
- 認証エラー時は `codex login status` を確認

## よく使うコマンド

- `npm run dev` — 開発サーバー起動（port 3000）
- `npm run build` — 本番ビルド（デプロイ前に必ず確認）
- `npm run lint` — ESLint チェック
- `npx tsc --noEmit` — 型チェック

## コーディング規約

- TypeScript 必須。`any` は禁止、Supabase データには `supabase gen types` で生成した型を使う
- コンポーネントは `components/` 配下にトピック別で配置、shadcn/ui のコンポーネントを優先利用
- Supabase クライアントは `lib/supabase/` 経由で統一（直接 import 禁止）
- API Route は `app/api/` 配下、Webhook は `app/api/webhooks/` 配下

## やってはいけないこと

- `.env.local` / `.env` のコミット（`git add -f` 等での強制追加も禁止）
- Supabase RLS ポリシーの権限緩和 → ユーザー承認必須
- LINE Webhook エンドポイント (`/api/webhooks/line`) の仕様変更 → LINE チャンネル設定と連動するため要確認
- 依存パッケージのメジャーバージョン更新 → 動作確認なしでの実施禁止
- 本番 Supabase プロジェクトへのスキーマ変更（DROP / ALTER）は明示指示があるときのみ

---

## マクサス営業思想（全ツール共通・必読）

株式会社マクサスは、リユース領域でIT/AIによって人の能力を最大化する営業会社。
このリポジトリで開発するすべての機能・出力は以下の思想に従うこと。

**営業 = 利益の最大化 × 顧客満足度の最大化**

### レバー1：商品利益の最大化
入口商品を顧客が売ってくれる最低ラインで買い切る。徹底したヒアリングと交渉力が必要。

### レバー2：追加商品の買取（★最重要）
問い合わせ商品以外の、顧客が価値に気づいていない中古品を買い取る。
特に「定価が高く、サイズが小さい高価古物」（貴金属・ブランド品・時計等）を優先。
レバー2は天井がなく、レバー1より伸ばしやすい。

### ツール開発時の判断基準
1. デフォルトでレバー2を優先する（提案・分析・スコアリングの重みづけ）
2. 計測対象に追加買取指標（追加買取率・追加粗利・追加点数）を必ず含める
3. 評価系ツールは「追加買取の切り出しがあったか」を評価軸に含める
4. 顧客満足度を犠牲にしない（押し売り禁止・顧客が後悔しない取引のみ推奨）

詳細: `~/.claude/MAKXAS_PHILOSOPHY.md`（ローカル）または `MAKXAS_PHILOSOPHY.md`（リポジトリ内）
