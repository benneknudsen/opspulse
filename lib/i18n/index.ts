"use client";

import { useCallback } from "react";

import copyDa from "@/design/copy.da.json";
import copyEn from "@/design/copy.en.json";
import { useUiStore, type Language } from "@/lib/store/ui";

export type TranslationValues = Record<string, string | number>;

const dictionaries = {
  da: copyDa,
  en: copyEn,
} as const;

type Dictionary = (typeof dictionaries)[Language];

function readPath(dictionary: Dictionary, path: string): string | undefined {
  let current: unknown = dictionary;

  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}

export function interpolate(
  template: string,
  values?: TranslationValues,
): string {
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function translate(
  language: Language,
  key: string,
  values?: TranslationValues,
): string {
  const template = readPath(dictionaries[language], key);
  return template === undefined ? key : interpolate(template, values);
}

export function useT() {
  const language = useUiStore((state) => state.language);

  return useCallback(
    (key: string, values?: TranslationValues) =>
      translate(language, key, values),
    [language],
  );
}
