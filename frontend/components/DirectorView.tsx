"use client";

import { useRef, useEffect, useState } from "react";
import { type LensMode, type VisionInsight } from "../hooks/useAuteurVision";
import { StatusHeader } from "./StatusHeader";
import { FloatingModeSelector } from "./ModeSelector";
import { InsightTerminal } from "./InsightTerminal";
import { VisualOverlays } from "./VisualOverlays";

interface DirectorViewProps {
  // Video
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaStream: MediaStream | null;

  // State
  lens: LensMode;
  isConnected: boolean;
  latestInsight: VisionInsight | null;

  // Actions
  onLensChange: (lens: LensMode) => void;
  onExitFullscreen: () => void;
}

export function DirectorView({
  videoRef,
  mediaStream,
  lens,
  isConnected,
  latestInsight,
  onLensChange,
  onExitFullscreen,
}: DirectorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size for overlay positioning
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

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExitFullscreen]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden relative"
    >
      {/* Z-0: Video Feed - ALWAYS VISIBLE */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Z-10: Visual Overlays (Grids, Letterboxing) - Pointer events none */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <VisualOverlays
          lens={lens}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      </div>

      {/* Z-20: HUD Layer - Interactive Elements */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Top Bar Status */}
        <div className="pointer-events-auto">
          <StatusHeader lens={lens} isConnected={isConnected} />
        </div>

        {/* Bottom Left Terminal */}
        <div className="pointer-events-auto">
          <InsightTerminal latestInsight={latestInsight} lens={lens} />
        </div>

        {/* Bottom Center Mode Selector */}
        <div className="pointer-events-auto">
          <FloatingModeSelector
            currentLens={lens}
            onLensChange={onLensChange}
          />
        </div>

        {/* Top Right Exit Button */}
        <button
          onClick={onExitFullscreen}
          className="absolute top-4 right-4 pointer-events-auto p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/60 transition-all group"
          title="Exit Fullscreen (Esc)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
      </div>

      {/* Placeholder when no video */}
      {!mediaStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-5 pointer-events-none">
          <div className="animate-pulse text-white/20 font-mono text-sm tracking-widest uppercase">
            [ SIGNAL LOST ]
          </div>
        </div>
      )}
    </div>
  );
}
