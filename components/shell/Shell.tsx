"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Nav } from "@/components/shell/Nav";
import { Topbar } from "@/components/shell/Topbar";
import { useUiStore } from "@/lib/store/ui";

function useHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useUiStore.persist.onFinishHydration(onStoreChange),
    () => useUiStore.persist.hasHydrated(),
    () => false,
  );
}

function useApplyPreferences(): void {
  const theme = useUiStore((state) => state.theme);
  const language = useUiStore((state) => state.language);
  const density = useUiStore((state) => state.density);
  const previous = useRef<[string, string, string] | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const apply = () => {
      const resolved =
        theme === "system" ? (media.matches ? "light" : "dark") : theme;

      root.setAttribute("data-theme", resolved);
      root.setAttribute("data-density", density);
      root.setAttribute("lang", language);
    };

    // The bootstrap script already applied the persisted values before paint.
    // Only re-apply when the store values actually change, so mounting never
    // overwrites attributes that were set elsewhere.
    const current: [string, string, string] = [theme, language, density];
    const previousValues = previous.current;
    const changed =
      previousValues !== null &&
      current.some((value, index) => value !== previousValues[index]);

    previous.current = current;
    if (changed) apply();

    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [theme, language, density]);
}

export function Shell({ children }: { children: ReactNode }) {
  useApplyPreferences();
  const hydrated = useHydrated();

  return (
    <div hidden={!hydrated} className="min-h-full bg-bg text-fg">
      <header className="sticky top-0 z-sticky border-b border-border bg-surface">
        <Topbar />
        <Nav />
      </header>
      <main className="mx-auto flex w-full max-w-page flex-col gap-grid px-5 py-5">
        {children}
      </main>
    </div>
  );
}
