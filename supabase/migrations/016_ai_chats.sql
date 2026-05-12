-- AIチャット履歴
CREATE TABLE IF NOT EXISTS public.ai_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text NOT NULL UNIQUE,
  user_id text NOT NULL,
  page_context text NOT NULL DEFAULT '不明なページ',
  recording_id text,
  first_question text NOT NULL DEFAULT '',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI履歴管理レビュー
CREATE TABLE IF NOT EXISTS public.ai_chat_reviews (
  chat_id text PRIMARY KEY,
  checked_at timestamptz,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- フィードバックログ（既存テーブルが存在しない場合のみ作成）
CREATE TABLE IF NOT EXISTS public.feedback_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  author text,
  title text NOT NULL,
  body text NOT NULL,
  page_href text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_chats' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON public.ai_chats FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_chat_reviews' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON public.ai_chat_reviews FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_logs' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON public.feedback_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.ai_chats TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_chat_reviews TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.feedback_logs TO anon, authenticated, service_role;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

DROP TRIGGER IF EXISTS ai_chats_updated_at ON public.ai_chats;
CREATE TRIGGER ai_chats_updated_at
  BEFORE UPDATE ON public.ai_chats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
