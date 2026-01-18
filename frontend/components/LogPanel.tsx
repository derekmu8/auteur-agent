"use client";

import { useEffect, useRef } from "react";
import { type VisionInsight } from "../hooks/useAuteurVision";

interface LogPanelProps {
  insights: VisionInsight[];
}

export function LogPanel({ insights }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [insights]);

  return (
    <div className="fixed right-0 top-20 bottom-20 w-80 z-50 pointer-events-auto transform translate-x-[calc(100%-12px)] hover:translate-x-0 transition-transform duration-300 ease-out group">
      {/* Handle / Peek Indicator */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-3 h-16 bg-white/10 rounded-l-md flex items-center justify-center cursor-pointer group-hover:opacity-0 transition-opacity">
        <div className="w-0.5 h-8 bg-white/40 rounded-full" />
      </div>

      {/* Main Panel Content */}
      <div className="h-full w-full bg-black/80 backdrop-blur-md border-l border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">
            System Logs
          </span>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          </div>
        </div>

        {/* Logs List */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[10px]"
        >
          {insights.length === 0 ? (
            <div className="text-white/20 italic text-center mt-10">
              [NO_DATA_RECEIVED]
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.timestamp}
                className="border-l border-white/10 pl-3 py-1 space-y-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-2 text-white/30">
                  <span className="text-emerald-500/80">
                    [{new Date(insight.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                  </span>
                  <span className="uppercase tracking-wider text-[9px]">
                    {insight.lens}
                  </span>
                </div>
                <p className="text-white/80 leading-relaxed">
                  {insight.data.analysis}
                </p>
                <div className="text-white/20 text-[9px]">
                  CONF: {insight.data.score}/10
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
