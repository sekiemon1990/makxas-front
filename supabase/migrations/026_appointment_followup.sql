-- PR38: アポ後フォロー送信フラグ
--
-- 査定完了後にお礼メッセージを送信したかを記録。重複送信防止。

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_followup_pending
  ON appointments(status, scheduled_at)
  WHERE status = 'completed' AND followup_sent_at IS NULL;
