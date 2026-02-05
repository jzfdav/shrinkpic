import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Button } from "@ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/card";
import { Label } from "@ui/label";
import { Separator } from "@ui/separator";
import { Toggle } from "@ui/toggle";
import { Spinner } from "@ui/spinner";
import {
  ArrowDownToLine,
  Download,
  Image,
  Moon,
  Settings,
  Share2,
  Sun,
  Upload,
} from "lucide-preact";
import {
  CompressionMode,
  CompressionResult,
  createCompressionClient,
} from "./compressionClient";

const VERSION = "shrinkpic-v1.3.2";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function App() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [targetSizeKB, setTargetSizeKB] = useState(100);
  const [format, setFormat] = useState("image/jpeg");
  const [compMode, setCompMode] = useState<CompressionMode>("quality");
  const [stats, setStats] = useState<CompressionResult | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [canShare, setCanShare] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const compressionClientRef = useRef<ReturnType<typeof createCompressionClient> | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error);
    }
  }, []);

  useEffect(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}worker.js`, { type: "classic" });
    const client = createCompressionClient(worker, (event) => {
      console.error("Worker Error:", event);
      setIsLoading(false);
    });
    workerRef.current = worker;
    compressionClientRef.current = client;
    return () => {
      client.dispose();
      worker.terminate();
      workerRef.current = null;
      compressionClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as BeforeInstallPromptEvent;
      setInstallAvailable(true);
      setShowInstallBanner(!localStorage.getItem("installBannerDismissed"));
    };

    const handleInstalled = () => {
      installPromptRef.current = null;
      setInstallAvailable(false);
      setShowInstallBanner(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);
    setCanShare(Boolean(navigator.share));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, [darkMode]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.type.includes("image")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, []);

  useEffect(() => {
    if (!currentFile) return;
    processImage(currentFile);
  }, [format, compMode]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const displayStats = useMemo(() => {
    if (!stats || !currentFile || !currentBlob) return null;
    return {
      originalSize: formatSize(currentFile.size),
      newSize: formatSize(currentBlob.size),
      originalDim: `${stats.origWidth}×${stats.origHeight}`,
      newDim: `${stats.width}×${stats.height}`,
    };
  }, [stats, currentFile, currentBlob]);

  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCurrentFile(file);
    setCurrentBlob(null);
    setStats(null);
    setIsLoading(true);
    processImage(file);
  };

  const processImage = async (file: File) => {
    setIsLoading(true);
    const requestId = ++latestRequestIdRef.current;
    try {
      const result = await compressToSize(file, targetSizeKB * 1024, format, compMode, requestId);
      if (requestId !== latestRequestIdRef.current) return;
      setCurrentBlob(result.blob);
      setStats(result);
      setPreviewUrl(URL.createObjectURL(result.blob));
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const compressToSize = (
    file: File,
    targetBytes: number,
    outputFormat: string,
    mode: CompressionMode,
    requestId: number
  ) => {
    return new Promise<CompressionResult>((resolve, reject) => {
      const client = compressionClientRef.current;
      if (!client) {
        reject(new Error("Compression worker unavailable."));
        return;
      }
      client
        .compressToSize(file, targetBytes, outputFormat, mode, requestId)
        .then(resolve)
        .catch(reject);
    });
  };

  const handleInstall = async () => {
    if (!installPromptRef.current) return;
    await installPromptRef.current.prompt();
    await installPromptRef.current.userChoice;
    installPromptRef.current = null;
    setInstallAvailable(false);
    setShowInstallBanner(false);
  };

  const handleShare = async () => {
    if (!currentBlob || !navigator.share) return;
    try {
      const extension = format === "image/png" ? "png" : format === "image/avif" ? "avif" : "jpg";
      const file = new File([currentBlob], `compressed.${extension}`, { type: format });
      await navigator.share({
        files: [file],
        title: "Compressed Image",
        text: `Here is the compressed ${extension.toUpperCase()} image from ShrinkPic.`,
      });
    } catch (error) {
      console.log("Share failed:", error);
    }
  };

  const downloadName = format === "image/png" ? "png" : format === "image/avif" ? "avif" : "jpg";

  return (
    <div className="relative flex min-h-screen flex-col gap-8 px-4 pb-14 pt-10 md:px-10">
      {showInstallBanner && installAvailable && !isIos && (
        <div className="mx-auto w-full max-w-5xl rounded-xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">Install ShrinkPic</div>
              <div className="text-xs text-muted-foreground">
                Get one-tap access and offline support by installing this app.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleInstall}>
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  localStorage.setItem("installBannerDismissed", "true");
                  setShowInstallBanner(false);
                }}
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}
      <header className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex size-8 items-center justify-center rounded-full border border-border bg-card">
              <Image className="size-4" />
            </div>
            <span>Privacy focused. Offline by default.</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">ShrinkPic</h1>
          <p className="max-w-xl text-xs text-muted-foreground md:text-sm">
            Compress images locally in seconds. No uploads.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <Toggle
              pressed={darkMode}
              onPressedChange={setDarkMode}
              aria-label="Toggle dark mode"
              className="rounded-full"
            >
              {darkMode ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Toggle>
            <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} aria-label="Settings">
              <Settings className="size-4" />
            </Button>
            {installAvailable && (
              <Button variant="outline" size="icon" onClick={handleInstall} aria-label="Install app">
                <ArrowDownToLine className="size-4" />
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{VERSION}</div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 lg:flex-row">
        <Card
          className={`relative flex min-h-[360px] flex-1 flex-col items-center justify-center border-dashed text-center transition ${
            isDragging ? "border-primary/70 bg-primary/5" : "border-border/60"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer?.files?.[0] ?? null;
            if (file) handleFile(file);
          }}
        >
          <CardContent className="flex flex-col items-center gap-5">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <Spinner className="size-6" />
                <span>Compressing in your browser...</span>
              </div>
            ) : previewUrl ? (
              <div className="flex w-full flex-col items-center gap-3">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[260px] rounded-lg border border-border/60 object-contain shadow-sm"
                />
                <div className="text-xs text-muted-foreground">
                  Original: {displayStats?.originalDim} · New: {displayStats?.newDim}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="flex size-14 items-center justify-center rounded-full border border-border/60 bg-background/40">
                  <Upload className="size-6" />
                </div>
                <div className="text-sm font-medium text-foreground">Drop or paste an image</div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Files never leave your device.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex w-full flex-col gap-6 lg:w-[360px]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Compression Target</CardTitle>
              <CardDescription>Pick the maximum file size and output format.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="sizeLimit">Max Size</Label>
                  <span className="text-muted-foreground">{targetSizeKB} KB</span>
                </div>
                <input
                  id="sizeLimit"
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={targetSizeKB}
                  onInput={(event) => setTargetSizeKB(Number((event.target as HTMLInputElement).value))}
                  onChange={() => currentFile && processImage(currentFile)}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted/60 accent-primary"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm">Format</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { label: "JPG", value: "image/jpeg" },
                      { label: "PNG", value: "image/png" },
                      { label: "AVIF", value: "image/avif" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      variant={format === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormat(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Priority</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { label: "Quality", value: "quality" },
                      { label: "Resolution", value: "resolution" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      variant={compMode === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCompMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
                {previewUrl ? "Select Another" : "Select Image"}
              </Button>
              <div className="flex w-full items-center gap-2">
                {canShare && (
                  <Button className="flex-1" variant="secondary" onClick={handleShare} disabled={!currentBlob}>
                    <Share2 className="size-4" />
                    Share
                  </Button>
                )}
                {previewUrl ? (
                  <Button asChild className="flex-1">
                    <a href={previewUrl} download={`shrinkpic-image.${downloadName}`}>
                      <Download className="size-4" />
                      Download
                    </a>
                  </Button>
                ) : (
                  <Button className="flex-1" disabled>
                    <Download className="size-4" />
                    Download
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>

          {displayStats && (
            <Card>
              <CardHeader>
                <CardTitle>Size Summary</CardTitle>
                <CardDescription>Snapshot of the compression result.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Original</div>
                    <div className="text-base font-semibold text-foreground">{displayStats.originalSize}</div>
                    <div className="text-xs text-muted-foreground">{displayStats.originalDim}</div>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="text-right">
                    <div className="text-xs uppercase text-muted-foreground">New</div>
                    <div className="text-base font-semibold text-foreground">{displayStats.newSize}</div>
                    <div className="text-xs text-muted-foreground">{displayStats.newDim}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle>Settings</CardTitle>
                <CardDescription>Personalize how ShrinkPic behaves.</CardDescription>
              </div>
              <CardAction>
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} aria-label="Close">
                  ✕
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Dark Mode</div>
                  <div className="text-xs text-muted-foreground">Match your environment.</div>
                </div>
                <Toggle pressed={darkMode} onPressedChange={setDarkMode} aria-label="Dark mode">
                  {darkMode ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </Toggle>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="font-medium">Format</div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { label: "JPG", value: "image/jpeg" },
                      { label: "PNG", value: "image/png" },
                      { label: "AVIF", value: "image/avif" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      variant={format === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormat(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-medium">Priority</div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { label: "Quality", value: "quality" },
                      { label: "Resolution", value: "resolution" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      variant={compMode === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCompMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">About ShrinkPic</div>
                <ul className="list-none space-y-1">
                  <li>100% offline, client-side compression</li>
                  <li>Metadata removed automatically</li>
                  <li>No server uploads or tracking</li>
                </ul>
                {isIos && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                    <div className="font-medium text-foreground">Install on iOS</div>
                    <div>Tap Share → Add to Home Screen.</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
