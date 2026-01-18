"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { type VisionOverlay } from "../hooks/useAuteurVision";

interface StoryOverlayProps {
  overlays: VisionOverlay[];
  containerWidth: number;
  containerHeight: number;
}

interface StorySubject {
  overlay: VisionOverlay;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Smooth animated box for a story subject
function StorySubjectBox({
  subject,
  allSubjects,
  containerWidth,
  containerHeight,
}: {
  subject: StorySubject;
  allSubjects: StorySubject[];
  containerWidth: number;
  containerHeight: number;
}) {
  const { overlay, x, y, width, height, centerX, centerY } = subject;
  
  // Use springs for buttery smooth position interpolation
  const springConfig = { damping: 30, stiffness: 200, mass: 0.8 };
  const animX = useSpring(x, springConfig);
  const animY = useSpring(y, springConfig);
  const animWidth = useSpring(width, springConfig);
  const animHeight = useSpring(height, springConfig);

  // Update springs when values change
  useEffect(() => {
    animX.set(x);
    animY.set(y);
    animWidth.set(width);
    animHeight.set(height);
  }, [x, y, width, height, animX, animY, animWidth, animHeight]);

  // Get color based on narrative role
  const getRoleColor = () => {
    switch (overlay.narrative_role) {
      case "primary":
        return { border: "rgba(251, 191, 36, 0.8)", bg: "rgba(251, 191, 36, 0.1)", glow: "rgba(251, 191, 36, 0.4)" };
      case "secondary":
        return { border: "rgba(168, 85, 247, 0.8)", bg: "rgba(168, 85, 247, 0.1)", glow: "rgba(168, 85, 247, 0.4)" };
      case "context":
      default:
        return { border: "rgba(34, 211, 238, 0.6)", bg: "rgba(34, 211, 238, 0.05)", glow: "rgba(34, 211, 238, 0.3)" };
    }
  };

  const colors = getRoleColor();

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        x: animX,
        y: animY,
        width: animWidth,
        height: animHeight,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-1 rounded-lg opacity-50"
        style={{
          background: `radial-gradient(ellipse at center, ${colors.glow} 0%, transparent 70%)`,
        }}
      />
      
      {/* Main border with rounded corners - story style */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          border: `2px solid ${colors.border}`,
          backgroundColor: colors.bg,
          boxShadow: `0 0 20px ${colors.glow}, inset 0 0 15px ${colors.bg}`,
        }}
      />

      {/* Animated corner accents */}
      {[
        { top: -2, left: -2 },
        { top: -2, right: -2 },
        { bottom: -2, left: -2 },
        { bottom: -2, right: -2 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3"
          style={{
            ...pos,
            borderTop: pos.top !== undefined ? `3px solid ${colors.border}` : undefined,
            borderBottom: pos.bottom !== undefined ? `3px solid ${colors.border}` : undefined,
            borderLeft: pos.left !== undefined ? `3px solid ${colors.border}` : undefined,
            borderRight: pos.right !== undefined ? `3px solid ${colors.border}` : undefined,
            borderRadius: "2px",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.05 }}
        />
      ))}

      {/* Label */}
      {overlay.label && (
        <motion.div
          className="absolute -top-7 left-0 right-0 flex justify-center"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <div
            className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest whitespace-nowrap"
            style={{
              backgroundColor: colors.border,
              color: overlay.narrative_role === "primary" ? "#000" : "#fff",
              boxShadow: `0 2px 10px ${colors.glow}`,
            }}
          >
            {overlay.label}
          </div>
        </motion.div>
      )}

      {/* Narrative role indicator */}
      {overlay.narrative_role === "primary" && (
        <motion.div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: "0 0 8px rgba(251, 191, 36, 0.8)" }} />
        </motion.div>
      )}
    </motion.div>
  );
}

// Connection line between story subjects
function ConnectionLine({
  from,
  to,
  containerWidth,
  containerHeight,
}: {
  from: StorySubject;
  to: StorySubject;
  containerWidth: number;
  containerHeight: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  // Use springs for smooth line animation
  const springConfig = { damping: 25, stiffness: 150, mass: 1 };
  const fromX = useSpring(from.centerX, springConfig);
  const fromY = useSpring(from.centerY, springConfig);
  const toX = useSpring(to.centerX, springConfig);
  const toY = useSpring(to.centerY, springConfig);

  useEffect(() => {
    fromX.set(from.centerX);
    fromY.set(from.centerY);
    toX.set(to.centerX);
    toY.set(to.centerY);
  }, [from.centerX, from.centerY, to.centerX, to.centerY, fromX, fromY, toX, toY]);

  // Calculate control points for curved line
  const controlX1 = useTransform([fromX, toX], ([fx, tx]: number[]) => fx + (tx - fx) * 0.3);
  const controlY1 = useTransform([fromY, toY], ([fy, ty]: number[]) => fy + (ty - fy) * 0.1);
  const controlX2 = useTransform([fromX, toX], ([fx, tx]: number[]) => fx + (tx - fx) * 0.7);
  const controlY2 = useTransform([fromY, toY], ([fy, ty]: number[]) => fy + (ty - fy) * 0.9);

  // Build path string
  const pathD = useTransform(
    [fromX, fromY, controlX1, controlY1, controlX2, controlY2, toX, toY],
    ([fx, fy, cx1, cy1, cx2, cy2, tx, ty]: number[]) =>
      `M ${fx} ${fy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`
  );

  // Get path length for dash animation
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [from, to]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={containerWidth}
      height={containerHeight}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`story-gradient-${from.index}-${to.index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(251, 191, 36, 0.6)" />
          <stop offset="50%" stopColor="rgba(168, 85, 247, 0.8)" />
          <stop offset="100%" stopColor="rgba(34, 211, 238, 0.6)" />
        </linearGradient>
        <filter id="story-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Background glow line */}
      <motion.path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke={`url(#story-gradient-${from.index}-${to.index})`}
        strokeWidth="4"
        strokeLinecap="round"
        filter="url(#story-glow)"
        opacity={0.3}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      
      {/* Main animated line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={`url(#story-gradient-${from.index}-${to.index})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={pathLength || 1000}
        initial={{ strokeDashoffset: pathLength || 1000 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
      />

      {/* Animated dot traveling along the line */}
      <motion.circle
        r="3"
        fill="rgba(168, 85, 247, 1)"
        filter="url(#story-glow)"
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{
          offsetPath: `path('${pathD.get()}')`,
        }}
      />
    </svg>
  );
}

export function StoryOverlay({
  overlays,
  containerWidth,
  containerHeight,
}: StoryOverlayProps) {
  // Filter to only story_subject overlays
  const storyOverlays = overlays.filter((o) => o.type === "story_subject");
  
  if (storyOverlays.length === 0 || containerWidth === 0 || containerHeight === 0) {
    return null;
  }

  // Calculate pixel positions for all subjects
  const subjects: StorySubject[] = storyOverlays.map((overlay, index) => {
    const coords = overlay.coordinates || [0, 0, 0.1, 0.1];
    const x = coords[0] * containerWidth;
    const y = coords[1] * containerHeight;
    const width = coords[2] * containerWidth;
    const height = coords[3] * containerHeight;
    
    return {
      overlay,
      index,
      x,
      y,
      width,
      height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  });

  // Find connection pairs (avoid duplicates)
  const connections: Array<{ from: StorySubject; to: StorySubject }> = [];
  subjects.forEach((subject) => {
    if (subject.overlay.connection !== undefined && subject.overlay.connection < subjects.length) {
      const targetIndex = subject.overlay.connection;
      // Only add if we haven't added the reverse
      const alreadyAdded = connections.some(
        (c) => 
          (c.from.index === subject.index && c.to.index === targetIndex) ||
          (c.from.index === targetIndex && c.to.index === subject.index)
      );
      if (!alreadyAdded) {
        connections.push({ from: subject, to: subjects[targetIndex] });
      }
    }
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Connection lines (rendered first, behind boxes) */}
      <AnimatePresence>
        {connections.map(({ from, to }) => (
          <ConnectionLine
            key={`conn-${from.index}-${to.index}`}
            from={from}
            to={to}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        ))}
      </AnimatePresence>

      {/* Story subject boxes */}
      <AnimatePresence>
        {subjects.map((subject) => (
          <StorySubjectBox
            key={`story-${subject.index}-${subject.overlay.label || ""}`}
            subject={subject}
            allSubjects={subjects}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
