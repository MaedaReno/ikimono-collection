"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dex", label: "ずかん", icon: "★" },
  { href: "/capture", label: "つかまえる", icon: "◎" },
  { href: "/world", label: "マップ", icon: "▦" },
];

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-50 bg-panel border-t-[3px] border-line">
      <div className="mx-auto max-w-3xl flex">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 text-center py-2 font-pixel text-[10px] font-bold tracking-wide ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="block text-xl leading-none mb-1">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
