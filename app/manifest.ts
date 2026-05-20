import type { MetadataRoute } from "next";

/**
 * PR36: PWA マニフェスト強化
 *
 * モバイルでホーム画面に追加すると、スタンドアロン起動・スプラッシュ画面
 * 表示・ショートカット機能が利用可能になる。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "買取マクサス インサイドセールス",
    short_name: "makxas",
    description: "買取マクサス全ブランドの反響・リード一元管理",
    start_url: "/inbox",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    orientation: "portrait",
    lang: "ja",
    categories: ["business", "productivity"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "インボックス", short_name: "Inbox", description: "新着反響を確認", url: "/inbox?filter=new" },
      { name: "ダッシュボード", short_name: "Dashboard", description: "今日のサマリー", url: "/dashboard" },
      { name: "アポ一覧", short_name: "Appts", description: "アポ予定を確認", url: "/appointments" },
    ],
  };
}
