"use client";

import { useRef, useEffect, useState } from "react";
import { type LensMode, type VisionInsight, type VisionOverlay } from "../hooks/useAuteurVision";
import { StatusHeader } from "./StatusHeader";
import { FloatingModeSelector } from "./ModeSelector";
import { InsightTerminal } from "./InsightTerminal";
import { VisualOverlays } from "./VisualOverlays";
import { LogPanel } from "./LogPanel";

interface DirectorViewProps {
  lens: LensMode;
  isConnected: boolean;
  isSpeaking?: boolean;
  latestInsight: VisionInsight | null;
  insightLog: VisionInsight[];
  overlays?: VisionOverlay[];
  showOverlays?: boolean;
  onLensChange: (lens: LensMode) => void;
  onExitFullscreen: () => void;
  // Optional: if provided, use this stream instead of requesting camera
  mediaStream?: MediaStream | null;
}

export function DirectorView({
  lens,
  isConnected,
  isSpeaking = false,
  latestInsight,
  insightLog,
  overlays = [],
  showOverlays = false,
  onLensChange,
  onExitFullscreen,
  mediaStream: externalStream,
}: DirectorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<"loading" | "active" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const localStreamRef = useRef<MediaStream | null>(null);

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Use external stream if provided, otherwise get camera directly
  useEffect(() => {
    // If external stream is provided, use it
    if (externalStream) {
      if (videoRef.current) {
        videoRef.current.srcObject = externalStream;
      }
      setStatus("active");
      return;
    }

    // Otherwise, get camera directly as fallback
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        localStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("active");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Camera access failed");
        setStatus("error");
      }
    }

    startCamera();

    return () => {
      // Only stop local stream, not external
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [externalStream]);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExitFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExitFullscreen]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlays - only when camera is active */}
      {status === "active" && (
        <>
          <div className="absolute inset-0 z-10 pointer-events-none">
            <VisualOverlays
              lens={lens}
              overlays={overlays}
              showOverlays={showOverlays}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          </div>

          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="pointer-events-auto">
              <StatusHeader lens={lens} isConnected={isConnected} isSpeaking={isSpeaking} />
            </div>
            <div className="pointer-events-auto">
              <InsightTerminal latestInsight={latestInsight} lens={lens} />
            </div>
            <div className="pointer-events-auto">
              <LogPanel insights={insightLog} />
            </div>
            <div className="pointer-events-auto">
              <FloatingModeSelector currentLens={lens} onLensChange={onLensChange} />
            </div>
            <button
              onClick={onExitFullscreen}
              className="absolute top-4 right-4 pointer-events-auto p-2 rounded-full bg-black/40 border border-white/10 text-white/40 hover:text-white transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/50 text-sm font-mono">INITIALIZING CAMERA</p>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <p className="text-red-400 text-sm font-mono mb-4">CAMERA ERROR</p>
            <p className="text-white/50 text-xs mb-6">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-white/20 rounded text-white/70 text-sm hover:bg-white/10"
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
