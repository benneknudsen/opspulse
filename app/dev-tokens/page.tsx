/**
 * Temporary route: a token pipeline smoke test, removed in a later issue.
 * It exists only so e2e tests can prove the tokens compile to real utilities.
 */
export default function DevTokensPage() {
  return (
    <section data-testid="dev-tokens" className="min-h-full bg-bg p-6 text-fg">
      <h1 className="font-ui text-22 tracking-tight">Token pipeline smoke test</h1>
      <p className="mt-2 text-13 text-muted">
        Temporary page. Every swatch below is painted from a Tailwind token.
      </p>

      <section className="mt-6 flex flex-wrap items-start gap-4">
        <div
          data-testid="density-row"
          className="flex h-row items-center rounded-md border border-border bg-surface px-cell-x py-cell-y text-14 text-fg"
        >
          Row height
        </div>
        <div
          data-testid="density-cell"
          className="rounded-md border border-border bg-surface px-cell-x py-cell-y text-14 text-fg"
        >
          Cell padding
        </div>
      </section>

      <section className="mt-6 flex flex-wrap gap-4">
        <div
          data-testid="swatch-bg-bg"
          className="h-16 w-24 rounded-md border border-border bg-bg"
        />
        <div
          data-testid="swatch-bg-surface"
          className="h-16 w-24 rounded-md border border-border bg-surface"
        />
        <div
          data-testid="swatch-bg-surface-2"
          className="h-16 w-24 rounded-md border border-border bg-surface-2"
        />
        <div
          data-testid="swatch-text-fg"
          className="flex h-16 w-24 items-center justify-center rounded-md border border-border bg-surface text-18 text-fg"
        >
          Aa
        </div>
        <div
          data-testid="swatch-text-muted"
          className="flex h-16 w-24 items-center justify-center rounded-md border border-border bg-surface text-18 text-muted"
        >
          Aa
        </div>
        <div
          data-testid="swatch-text-accent"
          className="flex h-16 w-24 items-center justify-center rounded-md border border-border-accent bg-surface text-18 text-accent"
        >
          Aa
        </div>
      </section>

      <section className="mt-6 flex flex-wrap items-start gap-4">
        <div
          data-testid="z-toast"
          className="z-toast rounded-md border border-border bg-surface px-cell-x py-cell-y text-14 text-fg"
        >
          z-toast
        </div>
        <div
          data-testid="duration-3"
          className="duration-3 rounded-md border border-border bg-surface px-cell-x py-cell-y text-14 text-fg"
        >
          duration-3
        </div>
      </section>
    </section>
  );
}
