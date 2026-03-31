"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

// ── BarcodeDetector type declarations (not in standard lib yet) ──────────────

interface BarcodeDetectorOptions {
  formats: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorClass {
  new (options?: BarcodeDetectorOptions): {
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  var BarcodeDetector: BarcodeDetectorClass | undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

interface IsbnScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

type ScannerState = "initializing" | "scanning" | "error";

export function IsbnScanner({ onScan, onClose }: IsbnScannerProps) {
  const t = useTranslations("search");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [state, setState] = useState<ScannerState>("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initializeUnsupportedState = window.setTimeout(() => {
      const DetectorCtor = globalThis.BarcodeDetector;
      if (!DetectorCtor) {
        setState("error");
        setErrorMessage(t("cameraNotSupported"));
      }
    }, 0);

    async function startScanning() {
      const DetectorCtor = globalThis.BarcodeDetector;
      if (!DetectorCtor) {
        return;
      }

      clearTimeout(initializeUnsupportedState);
      const detector = new DetectorCtor({ formats: ["ean_13"] });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setState("scanning");

        // Scan loop
        async function tick() {
          if (cancelled || !video) return;
          try {
            const barcodes = await detector.detect(video);
            const firstBarcode = barcodes[0];
            if (firstBarcode) {
              const isbn = firstBarcode.rawValue;
              if (isbn) {
                onScan(isbn);
                return; // Stop scanning after first detection
              }
            }
          } catch {
            // Detection can fail on some frames — keep going
          }
          rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        setState("error");

        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setErrorMessage(t("cameraPermission"));
        } else {
          setErrorMessage(t("cameraNotSupported"));
        }
      }
    }

    void startScanning();

    return () => {
      cancelled = true;
      clearTimeout(initializeUnsupportedState);
      stopCamera();
    };
  }, [onScan, stopCamera, t]);

  // Close handler — stop camera then call parent
  function handleClose() {
    stopCamera();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-surface-container-highest/80 p-3 text-on-surface transition-colors hover:bg-surface-container-highest"
        aria-label={t("closeScan")}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
          close
        </span>
      </button>

      {/* Error state */}
      {state === "error" && (
        <div className="px-8 text-center">
          <span
            className="material-symbols-outlined text-error mb-4 block"
            style={{ fontSize: "48px" }}
          >
            videocam_off
          </span>
          <p className="text-on-surface text-lg font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Video + scanning UI */}
      {state !== "error" && (
        <div className="relative w-full max-w-sm mx-auto">
          {/* Instruction text */}
          <p className="text-on-surface/80 text-sm text-center mb-4 font-medium">
            {t("scanning")}
          </p>

          {/* Video container with scanning frame */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Scanning overlay frame */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  "h-24 w-[80%] rounded-lg border-2 border-primary",
                  state === "scanning" && "animate-pulse",
                )}
              />
            </div>

            {/* Scan line animation */}
            {state === "scanning" && (
              <div className="pointer-events-none absolute inset-x-[10%] top-1/2 -translate-y-1/2 h-24 overflow-hidden">
                <div className="h-0.5 w-full bg-primary/80 animate-[scan-line_2s_ease-in-out_infinite]" />
              </div>
            )}
          </div>

          {/* Loading state */}
          {state === "initializing" && (
            <p className="text-on-surface/60 text-xs text-center mt-4 animate-pulse">
              {t("scanning")}
            </p>
          )}
        </div>
      )}

      {/* Scan line keyframes — injected as a style tag */}
      <style>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5.5rem); }
        }
      `}</style>
    </div>
  );
}
