"use client";

/**
 * UI/UXレビュー D4: テーマ切替ボタン
 *
 * 3状態（light / dark / system）の循環切替。
 * 現在のテーマアイコン: ☀️ light / 🌙 dark / 🖥️ system
 */
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // SSRハイドレーション後にのみアイコンを描画（不一致防止）
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="テーマ切替"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400"
      >
        <Monitor className="size-4" />
      </button>
    );
  }

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light"
      ? "ライトモード（クリックでダーク）"
      : theme === "dark"
      ? "ダークモード（クリックでシステム）"
      : "システム追随（クリックでライト）";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Icon className="size-4" />
    </button>
  );
}
