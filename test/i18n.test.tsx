import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { translate, useT } from "@/lib/i18n";
import { useUiStore } from "@/lib/store/ui";

function Probe() {
  const t = useT();
  return <span>{t("kpi.downloadsDelta", { n: 7 })}</span>;
}

describe("translate", () => {
  beforeEach(() => {
    useUiStore.setState({ language: "en" });
  });

  it("interpolates {n}, {title} and {last4}", () => {
    expect(translate("en", "kpi.downloadsDelta", { n: 12 })).toBe(
      "12 more than yesterday",
    );
    expect(translate("en", "toast.paused", { title: "Dune" })).toBe(
      "“Dune” paused",
    );
    expect(translate("en", "settings.maskedKey", { last4: "9f2c" })).toBe(
      "••••••••9f2c",
    );
  });

  it("returns the key itself when it is unknown", () => {
    expect(translate("en", "missing.key")).toBe("missing.key");
    expect(translate("da", "missing.key")).toBe("missing.key");
  });

  it("resolves the active language through useT", () => {
    render(<Probe />);

    expect(screen.getByText("7 more than yesterday")).toBeInTheDocument();

    act(() => {
      useUiStore.setState({ language: "da" });
    });
    expect(screen.getByText("7 mere end i går")).toBeInTheDocument();
  });
});
