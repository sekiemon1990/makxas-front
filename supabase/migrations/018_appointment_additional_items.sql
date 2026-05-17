-- Migration 018: appointments に additional_items_confirmed カラムを追加
-- 追加買取チェックリストで確認済みの品目を保存する（FS引き継ぎ・コア連携データに含める）

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS additional_items_confirmed jsonb;

COMMENT ON COLUMN appointments.additional_items_confirmed IS
  '追加査定品の確認チェックリスト。ISスタッフがアポ設定時に選択した確認済み品目の配列 (例: ["貴金属・金製品", "時計（高級品）"])';
