import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, formatSize } from "./App";

type WorkerMessage = {
  success: boolean;
  blob?: Blob;
  width?: number;
  height?: number;
  origWidth?: number;
  origHeight?: number;
  error?: string;
};

class MockWorker {
  onmessage: ((event: { data: WorkerMessage }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  postMessage() {
    const payload: WorkerMessage = {
      success: true,
      blob: new Blob(["x"], { type: "image/jpeg" }),
      width: 120,
      height: 80,
      origWidth: 400,
      origHeight: 300,
    };

    setTimeout(() => {
      this.onmessage?.({ data: payload });
    }, 0);
  }

  terminate() {}
}

beforeEach(() => {
  vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });

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
    expect(screen.getByText("JzfShrinkPic")).toBeInTheDocument();
    expect(screen.getByText("Select Image")).toBeInTheDocument();
  });

  it("processes a selected image and shows the preview", async () => {
    render(<App />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText("Preview")).toBeInTheDocument();
    });

    expect(screen.getByText(/Original:/)).toBeInTheDocument();
    expect(screen.getByText(/New:/)).toBeInTheDocument();
  });
});
