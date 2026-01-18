"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type LensMode, type VisionInsight } from "../hooks/useAuteurVision";

interface InsightTerminalProps {
  latestInsight: VisionInsight | null;
  lens: LensMode;
}

function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);

    if (!text) return;

    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-pulse">_</span>}
    </span>
  );
}

export function InsightTerminal({ latestInsight, lens }: InsightTerminalProps) {
  // Always use the "technical" emerald/white look, regardless of lens
  // This unifies the UI
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new insight arrives
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [latestInsight]);

  return (
    <div className="absolute bottom-24 left-6 z-20 w-[400px] pointer-events-none">
      <div
        className="backdrop-blur-none"
      >
        {/* Terminal Header - Minimal */}
        <div className="flex items-center gap-2 mb-2 opacity-50">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-500/80">
            SYSTEM.INSIGHT // {lens.toUpperCase()}
          </span>
        </div>

        {/* Terminal Content - Clean, Text Only */}
        <div
          ref={terminalRef}
          className="font-mono text-[11px] leading-tight text-white/90 max-h-40 overflow-hidden relative fade-bottom"
        >
          <AnimatePresence mode="wait">
            {latestInsight ? (
              <motion.div
                key={latestInsight.timestamp}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {/* Prompt Line */}
                <div className="flex gap-2 text-white/30 text-[10px]">
                  <span>{`>`}</span>
                  <span>PROCESSING_FRAME_{latestInsight.timestamp.toString().slice(-4)}</span>
                </div>

                {/* Analysis Body */}
                <div className="pl-4 border-l border-emerald-500/20">
                  <div className="text-emerald-400 mb-1">
                    <TypewriterText text={latestInsight.data.analysis} speed={10} />
                  </div>
                </div>

                {/* Metadata Footer */}
                <div className="flex gap-4 pl-4 text-[9px] uppercase tracking-wider text-white/20">
                  <span>CONF: {(latestInsight.data.score * 10).toFixed(0)}%</span>
                  <span>LATENCY: 42ms</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-white/30 pl-4 border-l border-white/5"
              >
                <span className="animate-pulse">_</span> AWAITING_INPUT
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
