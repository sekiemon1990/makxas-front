"use client";

/**
 * UI/UXレビュー D4: テーマプロバイダー
 *
 * next-themes でライト/ダーク切替を管理。
 * - 初期値: system（OSのテーマに追随）
 * - 保存先: localStorage('theme')
 * - SSR ハイドレーション不一致を防ぐため suppressHydrationWarning は <html> 側で対応
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
