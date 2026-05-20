/**
 * PR36: PWA インストール促進バナー
 *
 * モバイル + 未インストール時にホーム画面追加を促す小さなバナーを表示。
 * 1度閉じたら localStorage に記録して 30 日表示しない。
 */
"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const SUPPRESS_DAYS = 30;

export function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 既にスタンドアロン起動なら何もしない
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // 直近の dismiss を確認
    const lastDismiss = localStorage.getItem(DISMISS_KEY);
    if (lastDismiss) {
      const elapsed = Date.now() - Number(lastDismiss);
      if (elapsed < SUPPRESS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible || !event) return null;

  async function handleInstall() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "dismissed") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-xl border border-amber-200 bg-white shadow-lg p-4 flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2">
          <Download className="size-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900">アプリとしてインストール</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            ホーム画面に追加するとアプリのように使えます
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              インストール
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              あとで
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-zinc-600"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
