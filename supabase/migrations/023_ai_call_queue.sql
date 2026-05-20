-- PR24: AI即時架電キュー (Phase 4)
--
-- 反響受信時に自動でAI電話発信をキューイング。
-- makxas-phone (Twilio + OpenAI Realtime) が pull/webhook で取得する想定。
--
-- ステータス遷移:
--   queued    → 発信待ち
--   calling   → 発信中（makxas-phone がロック）
--   completed → 通話完了（要約/転送結果を result に保存）
--   failed    → 発信失敗（不通・拒否・エラー）
--   cancelled → スタッフが手動キャンセル

CREATE TABLE IF NOT EXISTS ai_call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | calling | completed | failed | cancelled
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  -- 発信スクリプト指示（営業思想：レバー2優先で追加買取の意向確認も含める）
  script_hint TEXT,
  -- makxas-phone 側の Call SID
  external_call_sid TEXT,
  -- 通話結果（文字起こし要約・成約見込みスコア等）
  result JSONB,
  -- エラーメッセージ
  error_message TEXT,
  -- 起票したスタッフ（null = システム自動キュー）
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_call_queue_status ON ai_call_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ai_call_queue_inquiry ON ai_call_queue(inquiry_id);

ALTER TABLE ai_call_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON ai_call_queue;
CREATE POLICY "authenticated_all" ON ai_call_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.ai_call_queue TO anon, authenticated, service_role;
