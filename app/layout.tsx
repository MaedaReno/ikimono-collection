import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "いきものコレクション",
  description:
    "動物園・水族館で撮った生き物をAIが識別・解説し、ドット絵にして自分だけのデジタル動物園を作ろう。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
