import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

function throwStorage(operation: keyof Storage): void {
  vi.spyOn(Storage.prototype, operation).mockImplementation(() => {
    throw new DOMException(`${operation} blocked`, "SecurityError");
  });
}

describe("UI store with unavailable storage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "matchMedia",
      (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reveals the shell with default preferences when getItem throws", async () => {
    throwStorage("getItem");

    const { Shell } = await import("@/components/shell/Shell");
    const { DEFAULT_UI_PREFERENCES, useUiStore } = await import(
      "@/lib/store/ui"
    );

    const { container } = render(
      <Shell>
        <p>content</p>
      </Shell>,
    );

    const shell = container.firstElementChild as HTMLElement;
    await screen.findByRole("link", { name: "Overblik" });

    expect(shell).not.toHaveAttribute("hidden");
    expect(useUiStore.persist.hasHydrated()).toBe(true);
    expect(useUiStore.getState()).toMatchObject(DEFAULT_UI_PREFERENCES);
    expect(screen.getByRole("radio", { name: "Dansk" })).toBeChecked();
  });

  it("keeps state changes working when setItem and removeItem throw", async () => {
    throwStorage("setItem");
    throwStorage("removeItem");

    const { useUiStore } = await import("@/lib/store/ui");

    expect(() =>
      act(() => {
        useUiStore.getState().setLanguage("en");
      }),
    ).not.toThrow();
    expect(useUiStore.getState().language).toBe("en");

    expect(() => useUiStore.persist.clearStorage()).not.toThrow();
  });
});
