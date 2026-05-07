<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# makxas-front 開発メモ

## 概要
- 目的: 買取マクサス インサイドセールスチーム向けリード・反響管理システム
- 担当範囲: 反響受付（LINE/Webフォーム/メール/電話/比較サイト）→ アポ取得 → マクサスコアへ引き継ぎ
- スタッフ規模: 4〜10名
- 反響件数: 月500件以上
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
