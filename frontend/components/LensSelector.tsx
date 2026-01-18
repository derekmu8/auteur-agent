"use client";

import { type LensMode } from "../hooks/useAuteurVision";

interface LensSelectorProps {
  currentLens: LensMode;
  onLensChange: (lens: LensMode) => void;
  disabled?: boolean;
}

const LENS_CONFIG: Record<
  LensMode,
  { label: string; icon: string; color: string; activeColor: string }
> = {
  geometry: {
    label: "Geometry",
    icon: "△",
    color: "text-cyan-400/60",
    activeColor:
      "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25",
  },
  light: {
    label: "Light",
    icon: "☀",
    color: "text-amber-400/60",
    activeColor:
      "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25",
  },
  story: {
    label: "Story",
    icon: "♥",
    color: "text-rose-400/60",
    activeColor:
      "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/25",
  },
};

export function LensSelector({
  currentLens,
  onLensChange,
  disabled = false,
}: LensSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-black/40 backdrop-blur-xl rounded-full p-1 border border-white/10">
      {(Object.keys(LENS_CONFIG) as LensMode[]).map((lens) => {
        const config = LENS_CONFIG[lens];
        const isActive = currentLens === lens;

        return (
          <button
            key={lens}
            onClick={() => !disabled && onLensChange(lens)}
            disabled={disabled}
            className={`
              relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              flex items-center gap-2
              ${
                isActive
                  ? config.activeColor
                  : `${config.color} hover:text-white/80 hover:bg-white/5`
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={`${config.label} Lens`}
          >
            <span className="text-base">{config.icon}</span>
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FloatingLensSelector({
  currentLens,
  onLensChange,
  disabled = false,
}: LensSelectorProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <LensSelector
        currentLens={currentLens}
        onLensChange={onLensChange}
        disabled={disabled}
      />
    </div>
  );
}
