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

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "dark",
  language: "da",
  density: "comfortable",
};
