"use client";

/**
 * UI/UXレビュー D2: エラー状態の統一UI
 *
 * API失敗・データ取得失敗時に表示する共通コンポーネント。
 * - エラーメッセージ + 「再試行」ボタン + サポート問い合わせリンク（Chatwork）
 * - 「control 任せ」のシンプルなエラー表示から脱却
 */
import { AlertCircle, RotateCw } from "lucide-react";

type Props = {
  /** ユーザー向けエラーメッセージ。技術的詳細はここに書かない */
  message?: string;
  /** 再試行ボタンを表示する場合のハンドラ */
  onRetry?: () => void;
  /** 再試行中フラグ（ボタン disable） */
  retrying?: boolean;
  /** より詳細な原因（開発時のみ表示・本番では折りたたみ） */
  detail?: string;
  /** バリアント */
  variant?: "card" | "inline";
};

export function ErrorState({
  message = "データの読み込みに失敗しました",
  onRetry,
  retrying = false,
  detail,
  variant = "card",
}: Props) {
  const isInline = variant === "inline";

  return (
    <div
      role="alert"
      className={
        isInline
          ? "flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          : "mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center"
      }
    >
      <AlertCircle className={isInline ? "size-4 shrink-0" : "size-8 text-red-500"} aria-hidden="true" />
      <div className={isInline ? "flex-1" : "space-y-1"}>
        <p className={isInline ? "" : "text-sm font-semibold text-red-900"}>{message}</p>
        {!isInline && (
          <p className="text-xs text-red-700/80">
            時間をおいて再試行してください。続く場合は管理者にChatworkでお問い合わせください。
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={
            isInline
              ? "ml-auto inline-flex h-7 items-center gap-1 rounded border border-red-300 bg-white px-2 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
              : "inline-flex h-9 items-center gap-1.5 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          }
        >
          <RotateCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} aria-hidden="true" />
          {retrying ? "再試行中..." : "再試行"}
        </button>
      )}
      {detail && process.env.NODE_ENV === "development" && (
        <details className="w-full text-left">
          <summary className="cursor-pointer text-[10px] text-red-600/70">技術的詳細</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[10px] text-zinc-700">{detail}</pre>
        </details>
      )}
    </div>
  );
}
