-- 030_ai_chats_rls_hardening.sql
-- 目的: ai_chats / ai_chat_reviews / feedback_logs の RLS を
--       「anon(未認証ユーザー)にも全開放」状態から、既存テーブル(messages/inquiries等)
--       と同じ authenticated 限定へ修正し、anon ロールのアクセスを剥奪する。
--
-- 背景:
--   016_ai_chats.sql では `CREATE POLICY allow_all FOR ALL USING(true) WITH CHECK(true)`
--   (= TO public、anon を含む) かつ `GRANT ALL TO anon` となっており、未認証ユーザーでも
--   AIチャット履歴(個人情報・会話内容)を読み書きできる状態だった。
--
--   このリポジトリの RLS 規約(001_init.sql)は、社内スタッフ全員が全データを扱う前提で
--   `authenticated_all FOR ALL TO authenticated USING(true) WITH CHECK(true)` に統一されている。
--   ai_chats には store/tenant 境界カラムが無く、管理画面(/admin/ai-chats)は全件参照する設計のため、
--   ここでも同じ authenticated_all パターンに揃える(= 認証済みスタッフのみアクセス可)。
--
-- アプリ側の叩き方(検証根拠):
--   - ai_chats / ai_chat_reviews … ブラウザクライアント(authenticated セッション)で直接読み書き
--     (lib/supabase/aiChats.ts, lib/supabase/aiChatReviews.ts) → authenticated ポリシーが必要。
--   - feedback_logs … サーバー API(service_role)からのみアクセス(app/api/ai/feedback/route.ts)
--     → service_role は RLS をバイパスするため anon/authenticated 向けポリシーは不要。

-- 1. 危険な全開放ポリシーを削除
--    (allow_all = 016 由来。all_access = 本番DBに別途追加されていた anon 含む全開放ポリシー)
DROP POLICY IF EXISTS "allow_all" ON public.ai_chats;
DROP POLICY IF EXISTS "allow_all" ON public.ai_chat_reviews;
DROP POLICY IF EXISTS "allow_all" ON public.feedback_logs;
DROP POLICY IF EXISTS "all_access" ON public.ai_chats;
DROP POLICY IF EXISTS "all_access" ON public.ai_chat_reviews;
DROP POLICY IF EXISTS "all_access" ON public.feedback_logs;

-- 2. RLS が有効であることを保証(冪等)
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_logs ENABLE ROW LEVEL SECURITY;

-- 3. authenticated 限定ポリシーを適用(既存 messages/inquiries と同一パターン)
DROP POLICY IF EXISTS "authenticated_all" ON public.ai_chats;
CREATE POLICY "authenticated_all" ON public.ai_chats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON public.ai_chat_reviews;
CREATE POLICY "authenticated_all" ON public.ai_chat_reviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- feedback_logs は server-only(service_role)のため authenticated/anon 向けポリシーは作らない。
-- RLS 有効 + ポリシー無し = anon/authenticated は拒否、service_role のみ通過(バイパス)。

-- 4. anon(未認証)ロールのテーブル権限を剥奪
REVOKE ALL ON TABLE public.ai_chats FROM anon;
REVOKE ALL ON TABLE public.ai_chat_reviews FROM anon;
REVOKE ALL ON TABLE public.feedback_logs FROM anon;

-- feedback_logs は server-only のため authenticated のテーブル権限も剥奪(多層防御)
REVOKE ALL ON TABLE public.feedback_logs FROM authenticated;

-- 5. 必要なロールへの GRANT を再確認(冪等・anon は含めない)
GRANT ALL ON TABLE public.ai_chats TO authenticated, service_role;
GRANT ALL ON TABLE public.ai_chat_reviews TO authenticated, service_role;
GRANT ALL ON TABLE public.feedback_logs TO service_role;
