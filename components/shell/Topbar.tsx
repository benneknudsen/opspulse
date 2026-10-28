"use client";

import type { ReactNode } from "react";

import { ConnectionPill } from "@/components/shell/ConnectionPill";
import { useT } from "@/lib/i18n";
import {
  useUiStore,
  type Density,
  type Language,
  type Theme,
} from "@/lib/store/ui";

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string> {
  name: string;
  legend: string;
  value: T;
  options: readonly RadioOption<T>[];
  onChange: (value: T) => void;
}

function RadioGroup<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <fieldset className="inline-flex rounded-sm border border-border">
      <legend className="sr-only">{legend}</legend>
      {options.map((option, index) => {
        const rounded =
          index === 0
            ? "rounded-l-sm"
            : index === options.length - 1
              ? "rounded-r-sm"
              : "";

        return (
          <label
            key={option.value}
            className={`cursor-pointer overflow-hidden border-border ${rounded} ${
              index > 0 ? "border-l" : ""
            } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block px-2.5 py-1 text-12 text-muted transition-colors duration-2 hover:bg-surface-2 hover:text-fg peer-checked:bg-surface-3 peer-checked:text-fg">
              {option.label}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-11 uppercase tracking-label text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Topbar() {
  const t = useT();
  const theme = useUiStore((state) => state.theme);
  const language = useUiStore((state) => state.language);
  const density = useUiStore((state) => state.density);
  const setTheme = useUiStore((state) => state.setTheme);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const setDensity = useUiStore((state) => state.setDensity);

  const themeOptions: readonly RadioOption<Theme>[] = [
    { value: "dark", label: t("topbar.themeDark") },
    { value: "light", label: t("topbar.themeLight") },
    { value: "system", label: t("topbar.themeSystem") },
  ];
  const languageOptions: readonly RadioOption<Language>[] = [
    { value: "da", label: "Dansk" },
    { value: "en", label: "English" },
  ];
  const densityOptions: readonly RadioOption<Density>[] = [
    { value: "comfortable", label: t("topbar.densityComfortable") },
    { value: "compact", label: t("topbar.densityCompact") },
  ];

  return (
    <div className="flex min-h-topbar flex-wrap items-center gap-3 px-5 py-2">
      <span className="font-ui text-15 font-semibold tracking-tight text-fg">
        {t("app.name")}
      </span>

      <input
        type="search"
        aria-label={t("topbar.searchPlaceholder")}
        placeholder={t("topbar.searchPlaceholder")}
        className="h-7 w-[220px] rounded-sm border border-border-strong bg-surface-inset px-2 font-mono text-12 text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <ConnectionPill />

        <span
          tabIndex={0}
          title={t("app.demoTooltip")}
          aria-describedby="topbar-demo-tooltip"
          className="rounded-xs border border-dashed border-border-strong px-1.5 py-0.5 text-11 uppercase tracking-label text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("app.demoBadge")}
        </span>
        <span id="topbar-demo-tooltip" className="sr-only">
          {t("app.demoTooltip")}
        </span>

        <Field label={t("topbar.theme")}>
          <RadioGroup
            name="topbar-theme"
            legend={t("topbar.theme")}
            value={theme}
            options={themeOptions}
            onChange={setTheme}
          />
        </Field>

        <Field label={t("topbar.language")}>
          <RadioGroup
            name="topbar-language"
            legend={t("topbar.language")}
            value={language}
            options={languageOptions}
            onChange={setLanguage}
          />
        </Field>

        <Field label={t("topbar.density")}>
          <RadioGroup
            name="topbar-density"
            legend={t("topbar.density")}
            value={density}
            options={densityOptions}
            onChange={setDensity}
          />
        </Field>
      </div>
    </div>
  );
}
