import type { Metadata } from "next";
import "./globals.css";
import { AppBar } from "@/components/AppBar";
import { BottomTabs } from "@/components/BottomTabs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "いきものコレクション",
  description:
    "動物園・水族館で撮った生き物をAIが識別・解説し、ドット絵にして自分だけのデジタル動物園を作ろう。",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <AppBar />
        <main className="flex-1">{children}</main>
        {user && <BottomTabs />}
      </body>
    </html>
  );
}
