"use client";

import { type VisionOverlay } from "../hooks/useAuteurVision";

interface DirectorOverlayProps {
  overlays: VisionOverlay[];
  containerWidth: number;
  containerHeight: number;
}

// Rule of thirds grid overlay
function RuleOfThirdsGrid({ status }: { status: "match" | "mismatch" }) {
  const isMatch = status === "match";
  const lineColor = isMatch ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.4)";
  const pointColor = isMatch ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.6)";
  const glowColor = isMatch ? "0 0 8px rgba(34, 197, 94, 0.3)" : "0 0 8px rgba(239, 68, 68, 0.2)";

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Vertical lines */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{ left: "33.33%", backgroundColor: lineColor, boxShadow: glowColor }}
      />
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{ left: "66.66%", backgroundColor: lineColor, boxShadow: glowColor }}
      />

      {/* Horizontal lines */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{ top: "33.33%", backgroundColor: lineColor, boxShadow: glowColor }}
      />
      <div
        className="absolute left-0 right-0 h-px"
        style={{ top: "66.66%", backgroundColor: lineColor, boxShadow: glowColor }}
      />

      {/* Power points */}
      {[
        { left: "33.33%", top: "33.33%" },
        { left: "66.66%", top: "33.33%" },
        { left: "33.33%", top: "66.66%" },
        { left: "66.66%", top: "66.66%" },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: pos.left, top: pos.top, backgroundColor: pointColor, boxShadow: glowColor }}
        />
      ))}
    </div>
  );
}

// Subject highlight bounding box
function SubjectHighlight({
  coordinates,
  containerWidth,
  containerHeight,
  label,
}: {
  coordinates: [number, number, number, number];
  containerWidth: number;
  containerHeight: number;
  label?: string;
}) {
  const [x, y, w, h] = coordinates;

  // Convert normalized coords to pixels
  const left = x * containerWidth;
  const top = y * containerHeight;
  const width = w * containerWidth;
  const height = h * containerHeight;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* Main border */}
      <div
        className="absolute inset-0 border-2 border-amber-400 rounded-sm"
        style={{ boxShadow: "0 0 12px rgba(251, 191, 36, 0.4)" }}
      />

      {/* Corner brackets */}
      <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
      <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-amber-400" />

      {/* Label */}
      {label && (
        <div className="absolute -top-6 left-0 px-2 py-0.5 bg-amber-500/80 text-black text-[10px] font-bold uppercase tracking-wider rounded">
          {label}
        </div>
      )}
    </div>
  );
}

// Focus point indicator (crosshair style)
function FocusPoint({
  x,
  y,
  containerWidth,
  containerHeight,
}: {
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
}) {
  const left = x * containerWidth;
  const top = y * containerHeight;

  return (
    <div
      className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {/* Outer ring */}
      <div
        className="w-8 h-8 rounded-full border-2 border-cyan-400"
        style={{ boxShadow: "0 0 10px rgba(34, 211, 238, 0.5)" }}
      />
      {/* Inner dot */}
      <div
        className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400"
        style={{ boxShadow: "0 0 6px rgba(34, 211, 238, 0.8)" }}
      />
      {/* Crosshair lines */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/50 -translate-y-1/2" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/50 -translate-x-1/2" />
    </div>
  );
}

// Direction arrow indicator
function DirectionArrow({
  direction,
  containerWidth,
  containerHeight,
}: {
  direction: "left" | "right" | "up" | "down";
  containerWidth: number;
  containerHeight: number;
}) {
  const positions = {
    left: { left: "5%", top: "50%", rotation: 180 },
    right: { left: "95%", top: "50%", rotation: 0 },
    up: { left: "50%", top: "10%", rotation: -90 },
    down: { left: "50%", top: "90%", rotation: 90 },
  };

  const pos = positions[direction];

  return (
    <div
      className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-pulse"
      style={{ left: pos.left, top: pos.top }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: `rotate(${pos.rotation}deg)` }}
      >
        <path
          d="M5 12h14M13 6l6 6-6 6"
          stroke="rgba(34, 211, 238, 0.8)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(34, 211, 238, 0.6))" }}
        />
      </svg>
    </div>
  );
}

export function DirectorOverlay({
  overlays,
  containerWidth,
  containerHeight,
}: DirectorOverlayProps) {
  if (!overlays.length || containerWidth === 0 || containerHeight === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {overlays.map((overlay, index) => {
        // Rule of thirds grid
        if (overlay.type === "rule_of_thirds" && (overlay.status === "match" || overlay.status === "mismatch")) {
          return <RuleOfThirdsGrid key={`rot-${index}`} status={overlay.status} />;
        }

        // Subject highlight box
        if (overlay.type === "subject_highlight" && overlay.coordinates) {
          return (
            <SubjectHighlight
              key={`sh-${index}`}
              coordinates={overlay.coordinates}
              containerWidth={containerWidth}
              containerHeight={containerHeight}
              label="Subject"
            />
          );
        }

        // Focus point (for future use with coordinates as [x, y, 0, 0])
        if (overlay.type === "focus_point" && overlay.coordinates) {
          return (
            <FocusPoint
              key={`fp-${index}`}
              x={overlay.coordinates[0]}
              y={overlay.coordinates[1]}
              containerWidth={containerWidth}
              containerHeight={containerHeight}
            />
          );
        }

        // Direction arrow (uses status field for direction)
        if (overlay.type === "direction" && overlay.status) {
          const dir = overlay.status as "left" | "right" | "up" | "down";
          if (["left", "right", "up", "down"].includes(dir)) {
            return (
              <DirectionArrow
                key={`dir-${index}`}
                direction={dir}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
              />
            );
          }
        }

        return null;
      })}
    </div>
  );
}
