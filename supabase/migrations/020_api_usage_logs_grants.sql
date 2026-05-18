-- 020_api_usage_logs_grants.sql
-- api_usage_logs テーブルへの table-level GRANT を補完。
-- 019 では RLS のみ設定したが、本番で /api/ai/usage 集計時に
-- "permission denied for table api_usage_logs" が発生したため、
-- service_role (server-side 書込・読込) と authenticated (ダッシュボード読取) に
-- 明示的に GRANT を付与する。
--
-- Supabase の新規テーブルのデフォルト privilege が役割によっては
-- 不足するケースの恒久対応 (本番で手動 GRANT 済みだが migration として残す)。

GRANT SELECT, INSERT ON public.api_usage_logs TO service_role;
GRANT SELECT ON public.api_usage_logs TO authenticated;
