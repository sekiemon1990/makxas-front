-- PR41: コア結果フィードバック保存
--
-- core-rails からの webhook (won/lost + amount + memo) を受信した際に
-- 結果データをアポに保存。AI 予測 vs 実績の比較・学習に使う。

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS core_result_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS core_result_memo TEXT,
  ADD COLUMN IF NOT EXISTS core_result_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_core_result
  ON appointments(core_result_received_at)
  WHERE core_result_received_at IS NOT NULL;
