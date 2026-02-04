import { describe, expect, it } from "vitest";
import { createCompressionClient } from "./compressionClient";

type WorkerMessage = {
  requestId: number;
  success: boolean;
  error?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  origWidth?: number;
  origHeight?: number;
};

class MockWorker {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: unknown[] = [];

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  emit(data: WorkerMessage) {
    this.onmessage?.({ data } as MessageEvent<WorkerMessage>);
  }
}

describe("createCompressionClient", () => {
  it("resolves requests out of order", async () => {
    const worker = new MockWorker();
    const client = createCompressionClient(worker as unknown as Worker);
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

    const first = client.compressToSize(file, 1000, "image/jpeg", "quality", 1);
    const second = client.compressToSize(file, 1000, "image/png", "quality", 2);

    worker.emit({
      requestId: 2,
      success: true,
      blob: new Blob(["y"], { type: "image/png" }),
      width: 200,
      height: 200,
      origWidth: 400,
      origHeight: 300,
    });

    worker.emit({
      requestId: 1,
      success: true,
      blob: new Blob(["x"], { type: "image/jpeg" }),
      width: 120,
      height: 80,
      origWidth: 400,
      origHeight: 300,
    });

    await expect(second).resolves.toMatchObject({ width: 200, height: 200 });
    await expect(first).resolves.toMatchObject({ width: 120, height: 80 });
    client.dispose();
  });

  it("rejects failed responses", async () => {
    const worker = new MockWorker();
    const client = createCompressionClient(worker as unknown as Worker);
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

    const promise = client.compressToSize(file, 1000, "image/jpeg", "quality", 7);

    worker.emit({
      requestId: 7,
      success: false,
      error: "Compression failed",
    });

    await expect(promise).rejects.toThrow("Compression failed");
    client.dispose();
  });
});
