"use client";

import { type LensMode } from "../hooks/useAuteurVision";

interface LensSelectorProps {
  currentLens: LensMode;
  onLensChange: (lens: LensMode) => void;
  disabled?: boolean;
}

const LENS_CONFIG: Record<LensMode, { label: string; icon: string }> = {
  geometry: {
    label: "GEOMETRY",
    icon: "⌗",
  },
  light: {
    label: "LIGHT",
    icon: "☼",
  },
  story: {
    label: "STORY",
    icon: "◈", // Diamond or cinema rect
  },
};

export function LensSelector({
  currentLens,
  onLensChange,
  disabled = false,
}: LensSelectorProps) {
  return (
    <div className="inline-flex items-center p-1 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
      {(Object.keys(LENS_CONFIG) as LensMode[]).map((lens) => {
        const config = LENS_CONFIG[lens];
        const isActive = currentLens === lens;

        return (
          <button
            key={lens}
            onClick={() => !disabled && onLensChange(lens)}
            disabled={disabled}
            className={`
              relative px-5 py-2 rounded-full transition-all duration-300 ease-out group
              flex items-center gap-2
              ${isActive
                ? "bg-white text-black shadow-lg shadow-white/10"
                : "text-white/40 hover:text-white hover:bg-white/5"
              }
              ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
              {config.icon}
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
              {config.label}
            </span>
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
