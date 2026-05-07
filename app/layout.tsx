import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "makxas-front",
  description: "UI prototype for makxas-front",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
