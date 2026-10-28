import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ConnectionPill } from "@/components/shell/ConnectionPill";
import {
  useConnectionStore,
  type ConnectionStatus,
} from "@/lib/store/connection";
import { useUiStore } from "@/lib/store/ui";

const cases: Array<{
  status: ConnectionStatus;
  text: string;
  colour: string;
  pulsing: boolean;
}> = [
  { status: "live", text: "Live", colour: "text-ok", pulsing: true },
  {
    status: "connecting",
    text: "Connecting…",
    colour: "text-muted",
    pulsing: false,
  },
  {
    status: "reconnecting",
    text: "Reconnecting…",
    colour: "text-warn",
    pulsing: false,
  },
  {
    status: "lost",
    text: "Connection lost",
    colour: "text-danger",
    pulsing: false,
  },
];

describe("ConnectionPill", () => {
  beforeEach(() => {
    useUiStore.setState({ language: "en" });
  });

  it.each(cases)(
    "renders the $status state with its copy and colour",
    ({ status, text, colour, pulsing }) => {
      useConnectionStore.setState({ status });

      const { container } = render(<ConnectionPill />);

      const pill = screen.getByRole("status");
      expect(pill).toHaveAttribute("data-status", status);
      expect(pill).toHaveTextContent(text);
      expect(pill).toHaveClass(colour);

      const dot = container.querySelector("i");
      expect(dot).not.toBeNull();
      if (pulsing) {
        expect(dot).toHaveClass("animate-live-pulse");
      } else {
        expect(dot).not.toHaveClass("animate-live-pulse");
      }
    },
  );
});
