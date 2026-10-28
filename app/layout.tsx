import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Shell } from "@/components/shell/Shell";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsPulse",
  description:
    "Real-time operations dashboard for self-hosted media servers.",
};

const UI_STORAGE_KEY = "opspulse.ui";

const bootstrapScript = `
(function () {
  var allowed = {
    theme: ["dark", "light", "system"],
    language: ["da", "en"],
    density: ["comfortable", "compact"]
  };
  var prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem("${UI_STORAGE_KEY}") || "{}") || {};
  } catch {
    prefs = {};
  }
  function pick(name, fallback) {
    return allowed[name].indexOf(prefs[name]) !== -1 ? prefs[name] : fallback;
  }
  var theme = pick("theme", "dark");
  var language = pick("language", "da");
  var density = pick("density", "comfortable");
  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-density", density);
  root.setAttribute("lang", language);
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="da"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
