"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import {
  DEFAULT_UI_PREFERENCES,
  DENSITIES,
  LANGUAGES,
  THEMES,
  type Density,
  type Language,
  type Theme,
  type UiPreferences,
} from "@/lib/config/ui";

export {
  DEFAULT_UI_PREFERENCES,
  DENSITIES,
  LANGUAGES,
  THEMES,
} from "@/lib/config/ui";
export type { Density, Language, Theme, UiPreferences } from "@/lib/config/ui";

export const UI_STORAGE_KEY = "opspulse.ui";

export interface UiState extends UiPreferences {
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setDensity: (density: Density) => void;
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return values.some((candidate) => candidate === value);
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
