# 外部依頼テンプレート集（Chatwork 送信用）

下記の各セクションをそのままコピーして該当者へ送付してください。

---

## 1. マクサスコア（core-rails）API 新規エンドポイント依頼（→ 小湊さん）

```
[info][title]makxas-front から FS への アポ連携 API 依頼[/title]
お疲れさまです。関です。

買取マクサス全ブランドの IS（インサイドセールス）側で運用中の
makxas-front から、アポ確定時に FS 側 core-rails へリード情報を
自動連携したく、新規エンドポイントの作成をお願いしたいです。

## 期待エンドポイント
POST /api/front/appointments

## 認証
Authorization: Token <MAKXAS_CORE_API_TOKEN>
（既存の core-rails/config/initializers/002_constants.rb のトークンと同一）

## リクエストボディ（application/json）
{
  "appointment": {
    "sourceId": "string (makxas-front 側 appointment.id)",
    "sourceType": "inside_sales",
    "scheduledAt": "ISO 8601 (例: 2026-06-01T10:00:00+09:00)",
    "itemCategory": "string|null",
    "itemDescription": "string|null",
    "address": "string|null",
    "preferredMethod": "visit | delivery",
    "additionalItemsConfirmed": { "貴金属": true, "時計": false, ... } | null
  },
  "lead": {
    "displayName": "string|null",
    "phone": "string|null",
    "email": "string|null",
    "lineUserId": "string|null"
  },
  "inquiry": {
    "id": "string (makxas-front 側 inquiry.id)",
    "channel": "string (line|phone|web_form|email|hikakaku|uridoki|oikura)",
    "internalNote": "string|null",
    "sourceSite": "string|null",
    "frontUrl": "string (makxas-front 側の反響詳細URL)"
  }
}

## 期待レスポンス（200 OK）
{
  "coreAppointmentId": "string (core 側で発番した一意ID)",
  "coreProjectUrl": "string (core 側の案件URL)"
}

## エラー
- 400: バリデーションエラー
- 401: トークン不正
- 500: 内部エラー

## 補足
- 既存の POST /api/projects は sokkin（ヤマト宅配集荷）専用とのことで利用不可と確認済
- 重複登録防止のため、sourceId（makxas-front 側 appointment.id）でユニーク制約推奨
- 受領後の core 側ステータス変化（成約/失注）は、こちらの webhook
  https://makxas-front.vercel.app/api/webhooks/core/result
  へ POST いただけると IS 側で自動ステータス更新します（仕様は別途）

ご検討よろしくお願いします。
[/info]
```

## 2. core-rails → makxas-front 結果フィードバック依頼（→ 小湊さん／上記と同送可）

```
[info][title]FS → IS への成約/失注フィードバック webhook 連携依頼[/title]
お疲れさまです。関です。

アポ連携の対向として、FS 側で成約/失注が確定したタイミングで
IS 側に自動通知する webhook の連携をお願いしたいです。

## 受信エンドポイント（IS 側・実装済み）
POST https://makxas-front.vercel.app/api/webhooks/core/result

## 認証
Authorization: Token <MAKXAS_CORE_API_TOKEN>
（送信側と同一トークン）

## 送信ペイロード
{
  "core_appointment_id": "string (上記アポ連携で発番した ID)",
  "result": "won | lost",
  "amount": 50000,        // 成約時のみ・任意
  "memo": "string|null"   // 自由メモ・任意
}

## 想定動作
- result=won → IS 側 appointments.status=completed / inquiries.status=closed
- result=lost → IS 側 appointments.status=cancelled / inquiries.status=lost
- 受信は monatomic（再送可・冪等）

呼び出しトリガー（核となる FS のフロー）は、小湊さんの設計に
お任せします。最低限「契約完了押下時」と「失注確定時」に発火
していただけると IS 側のダッシュボード（成約率・失注率）が
正確化されます。

ご検討よろしくお願いします。
[/info]
```

## 3. makxas-phone（電話AI）統合依頼（→ 自分宛 / 開発作業メモ）

```
[info][title]makxas-phone Railway デプロイ + makxas-front 連携[/title]
本件は関さん自身の開発タスクメモ。

## 現状
- repo: sekiemon1990/makxas-phone（Twilio + OpenAI Realtime PoC）
- ai_call_queue テーブル: 実装済（PR24）
- 反響受信時の自動キュー登録: 実装済
- makxas-phone 側からの pull/webhook: 未実装

## 必要作業
1. makxas-phone を Railway にデプロイ
   - 環境変数: TWILIO_*, OPENAI_API_KEY, MAKXAS_FRONT_URL, MAKXAS_FRONT_TOKEN
   - Twilio 番号購入: 1番号 $1/月（約¥155/月）+ 通話 $0.013/分
2. makxas-phone 側に下記2エンドポイントを追加
   - GET /pull-call-queue → makxas-front の ai_call_queue から queued 取得
   - POST /report-result → 通話結果を makxas-front に POST
3. makxas-front 側の対応 API
   - GET /api/ai-call-queue/pull（実装済）
   - POST /api/ai-call-queue/[id]/result（要新規実装）
4. Twilio Webhook 設定
   - Voice URL: Railway の Twilio エンドポイント
   - 着信音声 → AI スクリーニング → 結果を makxas-front に同期

## コスト見込み
Railway: $5/月（約¥775/月）+ Twilio $1/番号 + $0.013/分
月100コール想定: $1 + $1.30 = $2.30（約¥360/月）
[/info]
```

## 4. Gmail OAuth 設定手順（→ 関さん自身・1回作業）

```
[info][title]Gmail OAuth クライアント作成手順（5分）[/title]
比較サイト3社（おいくら・ウリドキ・ヒカカク）のメール受信のため、
Gmail OAuth クライアントを Google Cloud Console で作成。

## 手順
1. https://console.cloud.google.com/apis/credentials を開く
2. 上部「プロジェクトを選択」→ makxas プロジェクトを選択
   （なければ「プロジェクトを作成」で makxas を作る）
3. 「+ 認証情報を作成」→「OAuth クライアント ID」
4. アプリの種類: ウェブアプリケーション
5. 名前: makxas-front Gmail Reader
6. 承認済みのリダイレクト URI:
   https://makxas-front.vercel.app/api/gmail/callback
   http://localhost:3000/api/gmail/callback
7. 「作成」→ クライアント ID とクライアントシークレットをコピー
8. Vercel 環境変数に追加:
   GOOGLE_EMAIL_CLIENT_ID=<クライアントID>
   GOOGLE_EMAIL_CLIENT_SECRET=<クライアントシークレット>
   GOOGLE_EMAIL_REDIRECT_URI=https://makxas-front.vercel.app/api/gmail/callback
9. Vercel 再デプロイ
10. /settings の「メールアカウント」セクションから接続ボタンを押下
    → Google 認証画面で買取マクサスのメールアドレスを許可

## 注意
- 「OAuth 同意画面」を最初に設定する必要がある（テストユーザーに自分のメールを追加）
- 公開ステータスは「テスト」のままで可（100ユーザーまで）
- 比較サイト3社のメールアドレスを別々の oauth セッションで認可する必要あり

完了後 Codex に PR35（メール解析実装）を渡せば、自動でメール→Inbox 取込が走る。
[/info]
```

---

## 完了報告

各依頼を送付したら関さんから「依頼1完了」等と教えてください。
小湊さんの仕様返答があれば AGENTS.md の該当箇所を更新します。
