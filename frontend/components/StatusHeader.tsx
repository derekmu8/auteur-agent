"use client";

import { type LensMode } from "../hooks/useAuteurVision";

interface StatusHeaderProps {
  lens: LensMode;
  isConnected: boolean;
}

const LENS_NAMES: Record<LensMode, string> = {
  geometry: "GEOMETRY OPTICS",
  light: "LIGHT ANALYSIS",
  story: "STORY MODE",
};

const MODE_COLORS: Record<LensMode, string> = {
  geometry: "text-cyan-400",
  light: "text-amber-400",
  story: "text-violet-400",
};

export function StatusHeader({ lens, isConnected }: StatusHeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left - Branding */}
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs tracking-[0.25em] text-white/60 uppercase">
            AUTEUR OS
          </div>
          <div className="font-mono text-[10px] text-white/30">v1.0</div>
        </div>

        {/* Center - Current Lens */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <div
            className={`font-mono text-sm tracking-[0.3em] uppercase ${MODE_COLORS[lens]}`}
          >
            {LENS_NAMES[lens]}
          </div>
        </div>

        {/* Right - Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse"
                : "bg-red-500 shadow-lg shadow-red-500/50"
            }`}
          />
          <span
            className={`font-mono text-xs tracking-wider uppercase ${
              isConnected ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isConnected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>
    </div>
  );
}
