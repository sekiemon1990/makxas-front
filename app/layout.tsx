import type { Metadata, Viewport } from "next";
import "./globals.css";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { FrontCopilotWidget } from "@/components/shell/FrontCopilotWidget";
import { createClient } from "@/lib/supabase/server";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // UI/UXレビュー D4: ダークモード対応 — next-themes + suppressHydrationWarning
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <KeyboardShortcutsHelp />
          <PwaInstallPrompt />
          {user && <FrontCopilotWidget />}
        </ThemeProvider>
      </body>
    </html>
  );
}
