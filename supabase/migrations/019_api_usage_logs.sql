-- 019_api_usage_logs.sql
-- Anthropic API 利用ログ (1 コール = 1 行)。
-- recording (makxas-ast) の aiUsageLogs (Firestore) を Supabase 版に移植。
-- ダッシュボードでの月間/カテゴリ別/モデル別コスト可視化に使う。

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 何のためのAPI呼び出しか (recording.ai/models.ts の AiCategory と同義)
  -- 例: 'suggest' / 'chat' / 'extract-items' / 'analyze-edit' / 'learning'
  category TEXT NOT NULL,

  -- Anthropic モデル ID
  -- 例: 'claude-haiku-4-5-20251001' / 'claude-sonnet-4-6'
  model TEXT NOT NULL,

  -- トークン数 (Anthropic 返却値そのまま)
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,

  -- 計算済みコスト (USD)
  -- 計算式は lib/ai/usage.ts に集約 (effectiveInputUnits ベース)
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,

  -- 呼び出し元 API パス (例: '/api/ai/suggest')
  endpoint TEXT NOT NULL,

  -- 関連 ID (任意。inquiry/message と紐付けたい場合)
  inquiry_id UUID,
  message_id UUID,

  -- 任意の追加メタ (prompt_version_id, brand_id 等)
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス: ダッシュボードの主要クエリパターンに対応
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at
  ON public.api_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_category_created_at
  ON public.api_usage_logs(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_model_created_at
  ON public.api_usage_logs(model, created_at DESC);

-- 関連 ID で絞り込みたい場合に備える
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_inquiry_id
  ON public.api_usage_logs(inquiry_id) WHERE inquiry_id IS NOT NULL;

-- RLS: サーバー側 (service_role) からのみ書込・読込される想定
-- クライアント (anon / authenticated) からの直アクセスはダッシュボード API 経由のみ
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- service_role は RLS bypass されるので明示ポリシー不要だが、
-- 万一の anon 流入を防ぐため明示的に拒否する
CREATE POLICY "api_usage_logs_no_anon"
  ON public.api_usage_logs
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- authenticated (ログイン中の管理者) は読取のみ許可。書込は service_role 経由のみ。
CREATE POLICY "api_usage_logs_authenticated_read"
  ON public.api_usage_logs
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.api_usage_logs IS
  'Anthropic API 利用ログ。1 行 = 1 コール。recording (makxas-ast) の aiUsageLogs を Supabase 版に移植したもの。';
COMMENT ON COLUMN public.api_usage_logs.category IS
  '何のための呼び出しか。AiCategory enum と対応 (suggest/chat/extract-items/analyze-edit/learning など)';
COMMENT ON COLUMN public.api_usage_logs.cache_creation_tokens IS
  'Anthropic prompt caching の cache write (5min ephemeral ≈ 1.25x input price)';
COMMENT ON COLUMN public.api_usage_logs.cache_read_tokens IS
  'Anthropic prompt caching の cache hit (≈ 0.1x input price)';
