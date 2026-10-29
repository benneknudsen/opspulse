"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";

export const UI_STORAGE_KEY = "opspulse.ui";

export const THEMES = ["dark", "light", "system"] as const;
export const LANGUAGES = ["da", "en"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type Density = (typeof DENSITIES)[number];

export interface UiPreferences {
  theme: Theme;
  language: Language;
  density: Density;
}

export interface UiState extends UiPreferences {
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setDensity: (density: Density) => void;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "dark",
  language: "da",
  density: "comfortable",
};

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function parsePreferences(raw: string | null): UiPreferences | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const record = parsed as Record<string, unknown>;
    return {
      theme: isOneOf(THEMES, record.theme)
        ? record.theme
        : DEFAULT_UI_PREFERENCES.theme,
      language: isOneOf(LANGUAGES, record.language)
        ? record.language
        : DEFAULT_UI_PREFERENCES.language,
      density: isOneOf(DENSITIES, record.density)
        ? record.density
        : DEFAULT_UI_PREFERENCES.density,
    };
  } catch {
    return null;
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage: PersistStorage<UiPreferences> = {
  getItem: (name) => {
    try {
      const preferences = parsePreferences(getStorage()?.getItem(name) ?? null);
      return preferences ? { state: preferences, version: 0 } : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      getStorage()?.setItem(name, JSON.stringify(value.state));
    } catch {
      // Storage unavailable or full: preferences stay in memory only.
    }
  },
  removeItem: (name) => {
    try {
      getStorage()?.removeItem(name);
    } catch {
      // Storage unavailable: nothing to remove.
    }
  },
};

export const useUiStore = create<UiState>()(
  persist<UiState, [], [], UiPreferences>(
    (set) => ({
      ...DEFAULT_UI_PREFERENCES,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: UI_STORAGE_KEY,
      storage,
      version: 0,
      partialize: ({ theme, language, density }) => ({
        theme,
        language,
        density,
      }),
    },
  ),
);
