-- AI学習自動化システム用テーブル

-- messages テーブルへの追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_edit_reason TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_auto_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_version_id UUID;

-- prompt_versions: プロンプトのバージョン管理
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_category TEXT NOT NULL,
  theme TEXT,
  prompt_type TEXT NOT NULL DEFAULT 'force_theme_system',
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  total_uses INTEGER NOT NULL DEFAULT 0,
  edit_count INTEGER NOT NULL DEFAULT 0,
  edit_rate NUMERIC(4,3),
  created_by TEXT NOT NULL DEFAULT 'system',
  note TEXT,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON prompt_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.prompt_versions TO anon, authenticated, service_role;

-- reply_examples: 良い返信例の蓄積
CREATE TABLE IF NOT EXISTS reply_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_category TEXT NOT NULL,
  theme TEXT NOT NULL,
  customer_message TEXT NOT NULL,
  reply_body TEXT NOT NULL,
  was_ai_generated BOOLEAN NOT NULL DEFAULT false,
  edit_distance INTEGER,
  ai_edit_reason TEXT,
  was_auto_sent BOOLEAN NOT NULL DEFAULT false,
  quality_score NUMERIC(3,2),
  is_selected_for_prompt BOOLEAN NOT NULL DEFAULT false,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES inquiries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reply_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON reply_examples FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.reply_examples TO anon, authenticated, service_role;

-- ai_learning_runs: 学習実行ログ
CREATE TABLE IF NOT EXISTS ai_learning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'running',
  messages_analyzed INTEGER,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  categories_improved TEXT[],
  new_examples_added INTEGER DEFAULT 0,
  prompts_updated INTEGER DEFAULT 0,
  summary JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE ai_learning_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON ai_learning_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.ai_learning_runs TO anon, authenticated, service_role;

-- auto_send_rules: カテゴリごとの自動送信設定
CREATE TABLE IF NOT EXISTS auto_send_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_category TEXT NOT NULL UNIQUE,
  auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
  edit_rate_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.15,
  min_sample_size INTEGER NOT NULL DEFAULT 30,
  review_delay_minutes INTEGER NOT NULL DEFAULT 0,
  channel TEXT,
  current_edit_rate NUMERIC(4,3),
  current_sample_count INTEGER DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE auto_send_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON auto_send_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.auto_send_rules TO anon, authenticated, service_role;

INSERT INTO auto_send_rules (msg_category, edit_rate_threshold, min_sample_size) VALUES
  ('price_inquiry',    0.15, 30),
  ('appo_request',     0.10, 30),
  ('condition_detail', 0.15, 30),
  ('photo_submit',     0.15, 30),
  ('followup_question',0.20, 30),
  ('initial_contact',  0.20, 30)
ON CONFLICT (msg_category) DO NOTHING;
