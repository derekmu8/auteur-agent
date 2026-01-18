"use client";

import { type LensMode, type VisionOverlay } from "../hooks/useAuteurVision";
import { StoryOverlay } from "./StoryOverlay";

interface VisualOverlaysProps {
  lens: LensMode;
  overlays?: VisionOverlay[];
  showOverlays?: boolean;
  containerWidth: number;
  containerHeight: number;
}

// Rule of thirds grid - Subtle White
function RuleOfThirdsGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Vertical lines */}
      <div
        className="absolute top-0 bottom-0 w-px bg-white/10"
        style={{ left: "33.33%" }}
      />
      <div
        className="absolute top-0 bottom-0 w-px bg-white/10"
        style={{ left: "66.66%" }}
      />

      {/* Horizontal lines */}
      <div
        className="absolute left-0 right-0 h-px bg-white/10"
        style={{ top: "33.33%" }}
      />
      <div
        className="absolute left-0 right-0 h-px bg-white/10"
        style={{ top: "66.66%" }}
      />

      {/* Crosshairs at intersections */}
      {[
        { left: "33.33%", top: "33.33%" },
        { left: "66.66%", top: "33.33%" },
        { left: "33.33%", top: "66.66%" },
        { left: "66.66%", top: "66.66%" },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: pos.left,
            top: pos.top
          }}
        >
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/40" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/40" />
        </div>
      ))}
    </div>
  );
}

// Center crosshair - Technical
function CenterCrosshair() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="relative w-8 h-8 opacity-60">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
        <div className="absolute inset-0 border border-white/20 rounded-full" />
      </div>
    </div>
  );
}

// Histogram - Grayscale
function HistogramWidget() {
  const bars = [3, 5, 8, 12, 15, 18, 14, 10, 7, 4, 2, 1, 3, 6, 9, 11];

  return (
    <div className="absolute top-20 right-8 pointer-events-none">
      <div className="flex items-end gap-px h-10 w-24 opacity-50">
        {bars.map((height, i) => (
          <div
            key={i}
            className="flex-1 bg-white"
            style={{ height: `${(height / 18) * 100}%`, opacity: 0.3 + (height / 30) }}
          />
        ))}
      </div>
      <div className="text-[9px] font-mono text-white/30 text-right mt-1 tracking-widest">LUMA</div>
    </div>
  );
}

// Cinematic bars - Strict Black
function CinematicLetterbox({ containerHeight }: { containerHeight: number }) {
  // Fixed cinematic bars (approx 10-12% each)
  const barHeight = "12vh";

  return (
    <>
      <div
        className="absolute top-0 left-0 right-0 bg-black z-10 transition-all duration-700 ease-in-out"
        style={{ height: barHeight }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-black z-10 transition-all duration-700 ease-in-out"
        style={{ height: barHeight }}
      />
      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
    </>
  );
}

export function VisualOverlays({
  lens,
  overlays = [],
  showOverlays = false,
  containerWidth,
  containerHeight,
}: VisualOverlaysProps) {
  if (containerWidth === 0 || containerHeight === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Geometry Mode */}
      {lens === "geometry" && (
        <>
          <div className="absolute inset-4 border border-white/10 rounded-lg" />
          <RuleOfThirdsGrid />
          <CenterCrosshair />
          <div className="absolute top-4 left-4 font-mono text-[9px] text-white/30 tracking-[0.2em]">[GRID_ACTIVE]</div>
        </>
      )}

      {/* Light Mode */}
      {lens === "light" && (
        <>
          <HistogramWidget />
          <div className="absolute inset-0 bg-white/5 mix-blend-overlay pointer-events-none" />
          <div className="absolute top-4 left-4 font-mono text-[9px] text-white/30 tracking-[0.2em]">[EXPOSURE_CHECK]</div>
        </>
      )}

      {/* Story Mode */}
      {lens === "story" && (
        <>
          <CinematicLetterbox containerHeight={containerHeight} />
          {/* Story subject overlays - only shown when user asks */}
          {showOverlays && (
            <StoryOverlay
              overlays={overlays}
              containerWidth={containerWidth}
              containerHeight={containerHeight}
            />
          )}
          <div className="absolute top-4 left-4 font-mono text-[9px] text-white/30 tracking-[0.2em] z-20">
            {showOverlays ? "[STORY_ACTIVE]" : "[STORY_MODE]"}
          </div>
        </>
      )}
    </div>
  );
}
