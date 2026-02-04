export type CompressionMode = "quality" | "resolution";

export type CompressionResult = {
  blob: Blob;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
};

type WorkerResponse = {
  requestId: number;
  success: boolean;
  error?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  origWidth?: number;
  origHeight?: number;
};

export const createCompressionClient = (worker: Worker, onError?: (event: ErrorEvent) => void) => {
  const pendingRequests = new Map<
    number,
    {
      resolve: (value: CompressionResult) => void;
      reject: (reason?: Error) => void;
    }
  >();

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { requestId, success, error, blob, width, height, origWidth, origHeight } = event.data;
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);

    if (success && blob && width && height && origWidth && origHeight) {
      pending.resolve({ blob, width, height, origWidth, origHeight });
    } else {
      pending.reject(new Error(error || "Compression failed."));
    }
  };

  worker.onerror = (event) => {
    onError?.(event);
  };

  const compressToSize = (
    file: File,
    targetBytes: number,
    outputFormat: string,
    mode: CompressionMode,
    requestId: number
  ) =>
    new Promise<CompressionResult>((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      worker.postMessage({ file, targetBytes, format: outputFormat, mode, requestId });
    });

  const dispose = () => {
    pendingRequests.clear();
    worker.onmessage = null;
    worker.onerror = null;
  };

  return { compressToSize, dispose };
};
