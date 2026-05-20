/**
 * PR28: 監査ログヘルパー
 *
 * audit_logs テーブルへ変更履歴を非同期で記録する。
 * エラーが発生してもメイン処理を止めない（ベストエフォート）。
 */
import { createServiceClient } from "@/lib/supabase/service";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "merge"
  | "assign";

export type AuditEntityType =
  | "inquiry"
  | "appointment"
  | "lead"
  | "message";

export type AuditLogInput = {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  field?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  changedBy?: string | null;
  changedByEmail?: string | null;
  note?: string | null;
};

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("audit_logs").insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      field: input.field ?? null,
      before_value: (input.beforeValue === undefined ? null : input.beforeValue) as never,
      after_value: (input.afterValue === undefined ? null : input.afterValue) as never,
      changed_by: input.changedBy ?? null,
      changed_by_email: input.changedByEmail ?? null,
      note: input.note ?? null,
    });
  } catch (e) {
    // audit log failure should never break the main flow
    console.error("[audit] failed to record:", e);
  }
}
