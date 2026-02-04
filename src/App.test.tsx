import { render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, formatSize } from "./App";

class MockWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage() {}
  terminate() {}
}

beforeEach(() => {
  vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      configurable: true,
      writable: true,
    });
  } else {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  }

  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  } else {
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  }

  const serviceWorker = {
    register: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: serviceWorker,
    configurable: true,
  });
});

describe("formatSize", () => {
  it("formats bytes into human-readable sizes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1024)).toBe("1 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
  });
});

describe("App", () => {
  it("renders the main UI", () => {
    render(<App />);
    expect(screen.getByText("ShrinkPic")).toBeInTheDocument();
    expect(screen.getByText("Select Image")).toBeInTheDocument();
  });
});
