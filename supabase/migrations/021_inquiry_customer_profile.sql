-- 021_inquiry_customer_profile.sql
-- AI抽出で得られる顧客プロファイル情報を inquiries テーブルに永続化する。
-- これまでは抽出結果が DB に保存されておらず、画面リロード/別ユーザーの閲覧時に
-- 毎回 AI 抽出を再実行する必要があった（コスト・応答時間ムダ）。
-- 加えてダッシュボードでの追加買取（レバー2）KPI 集計に不可欠。

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS customer_profile JSONB,
  ADD COLUMN IF NOT EXISTS suggested_items TEXT[],
  ADD COLUMN IF NOT EXISTS approach_hint TEXT,
  ADD COLUMN IF NOT EXISTS profile_extracted_at TIMESTAMPTZ;

-- 顧客プロファイル（特に age_group / sell_motivation）でフィルタすることが
-- 増える想定なので GIN インデックスを張る。
CREATE INDEX IF NOT EXISTS inquiries_customer_profile_idx
  ON inquiries USING GIN (customer_profile);

COMMENT ON COLUMN inquiries.customer_profile IS
  'AI抽出した顧客属性 (age_group / income_level / sell_motivation / motivation_strength)';
COMMENT ON COLUMN inquiries.suggested_items IS
  'AI が属性×ニーズから提示した追加買取候補カテゴリ（中古5,000円以上限定）';
COMMENT ON COLUMN inquiries.approach_hint IS
  'AI が生成した声掛け方針コメント';
COMMENT ON COLUMN inquiries.profile_extracted_at IS
  '最後にプロファイル抽出が成功した日時。再抽出の判定に使う。';
