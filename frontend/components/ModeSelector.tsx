"use client";

import { motion } from "framer-motion";
import { type LensMode } from "../hooks/useAuteurVision";

interface ModeSelectorProps {
  currentLens: LensMode;
  onLensChange: (lens: LensMode) => void;
  disabled?: boolean;
}

const LENS_CONFIG: Record<
  LensMode,
  {
    label: string;
    icon: string;
    color: string;
    activeColor: string;
    highlightBg: string;
  }
> = {
  geometry: {
    label: "Geometry",
    icon: "△",
    color: "text-cyan-400/60",
    activeColor: "text-white",
    highlightBg: "bg-gradient-to-r from-cyan-500 to-cyan-600",
  },
  light: {
    label: "Light",
    icon: "☀",
    color: "text-amber-400/60",
    activeColor: "text-white",
    highlightBg: "bg-gradient-to-r from-amber-500 to-amber-600",
  },
  story: {
    label: "Story",
    icon: "◇",
    color: "text-violet-400/60",
    activeColor: "text-white",
    highlightBg: "bg-gradient-to-r from-violet-500 to-violet-600",
  },
};

export function ModeSelector({
  currentLens,
  onLensChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-xl rounded-full p-1.5 border border-white/10">
      {(Object.keys(LENS_CONFIG) as LensMode[]).map((lens) => {
        const config = LENS_CONFIG[lens];
        const isActive = currentLens === lens;

        return (
          <button
            key={lens}
            onClick={() => !disabled && onLensChange(lens)}
            disabled={disabled}
            className={`
              relative px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-200
              flex items-center gap-2 z-10
              ${isActive ? config.activeColor : `${config.color} hover:text-white/80`}
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={`${config.label} Lens`}
          >
            {/* Animated highlight background */}
            {isActive && (
              <motion.div
                layoutId="mode-highlight"
                className={`absolute inset-0 rounded-full ${config.highlightBg} shadow-lg`}
                style={{
                  boxShadow:
                    lens === "geometry"
                      ? "0 0 20px rgba(34, 211, 238, 0.4)"
                      : lens === "light"
                        ? "0 0 20px rgba(251, 191, 36, 0.4)"
                        : "0 0 20px rgba(139, 92, 246, 0.4)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-10 text-base">{config.icon}</span>
            <span className="relative z-10 hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FloatingModeSelector({
  currentLens,
  onLensChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <ModeSelector
        currentLens={currentLens}
        onLensChange={onLensChange}
        disabled={disabled}
      />
    </div>
  );
}

// Keep the old export name for backwards compatibility
export const LensSelector = ModeSelector;
export const FloatingLensSelector = FloatingModeSelector;
