"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n";

export default function Home() {
  const t = useT();

  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="font-ui text-28 tracking-display text-fg">
        {t("app.name")}
      </h1>
      <p className="max-w-prose text-14 text-muted">{t("app.tagline")}</p>
      <Link
        className="rounded-sm border border-border-strong px-3 py-2 text-13 text-muted hover:bg-surface-2 hover:text-fg"
        href="/dev-tokens"
      >
        {t("nav.spec")}
      </Link>
    </section>
  );
}
