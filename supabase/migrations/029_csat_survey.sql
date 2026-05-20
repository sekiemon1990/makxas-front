-- PR42: 顧客満足度アンケート自動配信
--
-- アポ完了の翌日にアンケート URL を送付し、顧客が公開ページで回答。
-- 1 アポにつき 1 トークン。

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS csat_token UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS csat_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS csat_score INT CHECK (csat_score >= 1 AND csat_score <= 5),
  ADD COLUMN IF NOT EXISTS csat_nps INT CHECK (csat_nps >= 0 AND csat_nps <= 10),
  ADD COLUMN IF NOT EXISTS csat_comment TEXT,
  ADD COLUMN IF NOT EXISTS csat_responded_at TIMESTAMPTZ;

UPDATE appointments SET csat_token = gen_random_uuid() WHERE csat_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_csat_token ON appointments(csat_token);
CREATE INDEX IF NOT EXISTS idx_appointments_csat_pending
  ON appointments(status, csat_sent_at)
  WHERE status = 'completed' AND csat_sent_at IS NULL;
