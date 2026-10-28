import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("vitest setup", () => {
  it("exposes the jest-dom matchers", () => {
    render(<p>token pipeline</p>);

    expect(screen.getByText("token pipeline")).toBeInTheDocument();
  });
});
