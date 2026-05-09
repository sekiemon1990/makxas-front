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
- 関連システム: マクサスコア（基幹システム / makxascore.com）← アポ取得時に双方向連携

## ロール分担
- **Claude Code**: 設計・仕様決定・コードレビュー・Codex向け指示作成
- **Codex**: 実装（コード生成・ファイル作成）

## フェーズ
- **Phase 1 MVP（3〜4週）**: Supabase構築 / Google認証 / LINE受信返信 / Webフォーム / インボックス / アポ設定 / Vercelデプロイ
- **Phase 2（1〜2ヶ月）**: マクサスコア正式API連携 / Gmail / 比較サイトメール解析+スクレイピング / Twilio電話
- **Phase 3（2〜3ヶ月後）**: AI自動返信（LINE/比較サイト）/ 即時架電 / 優先度スコアリング

## アーキテクチャ
- フロント: Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind CSS v4
- DB / Auth / Realtime: Supabase (PostgreSQL 16)
- ホスティング: Vercel（Pro・既存）
- 状態管理: Zustand
- LINE統合: @line/bot-sdk v9
- メール送信: Resend（Phase 2）
- メール受信: Gmail API ポーリング（Phase 2）
- 比較サイト: メール解析（GPT-4o-mini）+ スクレイピング（Phase 2）
- 電話: Twilio + Railway（ai-phone-screening-poc流用、Phase 2）
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
- Phase 1 暫定: アポ取得時にGoogle Sheetsへ書き出し
- Phase 2 正式: マクサスコアAPIへREST POST（APIなければWebhookエンドポイント作成依頼）
- フィードバック受信エンドポイント: POST /api/webhooks/core/result

## ブランチ運用
- main 直接 push 禁止（PR ベース）
- Vercel: main merge で自動デプロイ（Vercel Pro共有枠）

## 未決事項
| # | 内容 | 優先度 |
|---|---|---|
| 1 | マクサスコアにAPIがあるか確認（なければWebhookエンドポイント作成依頼） | 高 |
| 2 | コアへ渡す項目の最終確認 | 高 |
| 3 | LINE Channel Secret / Access Token の取得 | 高（Phase 1実装時） |
| 4 | Google Sheetsの書き出し先シートID | 中（アポ設定実装時） |

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
