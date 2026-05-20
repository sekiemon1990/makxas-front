-- PR37: 顧客向けアポ照会トークン
--
-- /appointment/[token] の URL でリードがログイン不要でアポ詳細を確認できる
-- ようにするための一意トークン。

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS view_token UUID UNIQUE DEFAULT gen_random_uuid();

-- 既存行に NULL があれば補完
UPDATE appointments SET view_token = gen_random_uuid() WHERE view_token IS NULL;

ALTER TABLE appointments
  ALTER COLUMN view_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_view_token ON appointments(view_token);
