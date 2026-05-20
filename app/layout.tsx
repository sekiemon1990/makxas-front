import type { Metadata, Viewport } from "next";
import "./globals.css";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "makxas-front",
  description: "買取マクサス インサイドセールス管理",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "makxas",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // UI/UXレビュー D4: ダークモード対応 — next-themes + suppressHydrationWarning
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <KeyboardShortcutsHelp />
        </ThemeProvider>
      </body>
    </html>
  );
}
