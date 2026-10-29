"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/lib/i18n";

const LINKS = [
  { href: "/", label: "nav.dashboard" },
  { href: "/history", label: "nav.history" },
  { href: "/onboarding", label: "nav.onboarding" },
  { href: "/settings", label: "nav.settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1 border-t border-border-soft px-5 py-1.5">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-sm px-3 py-1 text-14 font-medium transition-colors duration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {t(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}
