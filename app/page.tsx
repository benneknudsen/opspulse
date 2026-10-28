import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-start gap-4 bg-bg p-8 text-fg">
      <h1 className="font-ui text-28 tracking-display">OpsPulse</h1>
      <p className="max-w-prose text-14 text-muted">
        Real-time operations dashboard for self-hosted media servers. The
        application shell arrives with the later issues; the design tokens are
        already wired.
      </p>
      <Link
        className="rounded-md border border-border-accent bg-accent-soft px-3 py-2 text-13 text-accent"
        href="/dev-tokens"
      >
        Token smoke test
      </Link>
    </main>
  );
}
