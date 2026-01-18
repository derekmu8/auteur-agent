"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, ConnectionState, Track } from "livekit-client";
import {
  useAuteurVision,
  type VisionStatus,
  type LensMode,
  type VisionInsight,
} from "../hooks/useAuteurVision";
import { FloatingLensSelector } from "../components/ModeSelector";
import { DirectorOverlay } from "../components/DirectorOverlay";
import { DirectorView } from "../components/DirectorView";

// Vision status badge component
function VisionStatusBadge({ status }: { status: VisionStatus }) {
  const config = {
    fresh: {
      label: "FRESH",
      color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      pulse: true,
    },
    stale: {
      label: "STALE",
      color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      pulse: false,
    },
    idle: {
      label: "IDLE",
      color: "bg-white/10 text-white/40 border-white/10",
      pulse: false,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-full border ${config.color}`}
    >
      {config.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

// Score indicator
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 7
      ? "text-emerald-400 border-emerald-500/30"
      : score >= 4
        ? "text-amber-400 border-amber-500/30"
        : "text-red-400 border-red-500/30";

  return (
    <div
      className={`absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border ${color}`}
    >
      <div className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">
        Score
      </div>
      <div className={`text-2xl font-bold ${color.split(" ")[0]}`}>
        {score}/10
      </div>
    </div>
  );
}

// Terminal log for VLM insights
function InsightTerminalLog({ insights }: { insights: VisionInsight[] }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = 0;
    }
  }, [insights.length]);

  const lensColors: Record<LensMode, string> = {
    geometry: "text-cyan-400",
    light: "text-amber-400",
    story: "text-violet-400",
  };

  return (
    <div className="rounded-xl bg-black/60 border border-white/10 overflow-hidden font-mono text-xs">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/5">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-white/40 text-[10px] uppercase tracking-wider">
          Vision Log
        </span>
      </div>

      <div
        ref={terminalRef}
        className="h-48 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10"
      >
        {insights.length === 0 ? (
          <div className="text-white/30 italic">Awaiting vision data...</div>
        ) : (
          insights.map((insight) => (
            <div key={insight.timestamp} className="space-y-1">
              <div className="flex items-center gap-2 text-white/30">
                <span className={lensColors[insight.lens]}>
                  [{insight.lens.toUpperCase()}]
                </span>
                <span className="text-white/20">{insight.data.score}/10</span>
                <span>
                  {new Date(insight.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-white/80 leading-relaxed pl-2 border-l border-white/10">
                {insight.data.analysis}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  // LiveKit state
  const [isConnected, setIsConnected] = useState(false);
  const [lastDirective, setLastDirective] = useState<string>("");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Session control
  const [sessionActive, setSessionActive] = useState(false);

  // View mode toggle
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Container dimensions for overlay
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Vision hook
  const {
    lens,
    visionStatus,
    latestInsight,
    insightLog,
    isStreaming,
    error: visionError,
    mediaStream,
    overlays,
    score,
    changeLens,
  } = useAuteurVision({
    room: roomRef.current,
    enabled: sessionActive,
  });

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

  // Attach media stream to video element
  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // Connect to LiveKit room
  const connectToRoom = useCallback(async () => {
    try {
      const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!lkUrl) {
        throw new Error("NEXT_PUBLIC_LIVEKIT_URL not configured");
      }

      const tokenRes = await fetch("/api/token");
      const { token } = await tokenRes.json();

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
        }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setIsConnected(state === ConnectionState.Connected);
      });

      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload));
          if (message.type === "directive") {
            setLastDirective(message.content);
          }
        } catch {
          // Not JSON, ignore
        }
      });

      await room.connect(lkUrl, token);
      setIsConnected(true);
      setConnectionError(null);
    } catch (err) {
      setConnectionError(
        `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, []);

  const disconnectFromRoom = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const startSession = useCallback(async () => {
    await connectToRoom();
    setSessionActive(true);
  }, [connectToRoom]);

  const stopSession = useCallback(async () => {
    setSessionActive(false);
    await disconnectFromRoom();
    setLastDirective("");
  }, [disconnectFromRoom]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const error = connectionError || visionError;

  // Render fullscreen DirectorView mode
  if (isFullscreenMode && isStreaming) {
    return (
      <>
        <audio ref={audioRef} autoPlay />
        <DirectorView
          videoRef={videoRef}
          mediaStream={mediaStream}
          lens={lens}
          isConnected={isConnected}
          latestInsight={latestInsight}
          onLensChange={changeLens}
          onExitFullscreen={() => setIsFullscreenMode(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white font-sans">
      <audio ref={audioRef} autoPlay />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl">
              🎬
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Auteur</h1>
              <p className="text-xs text-white/50">Silent Observer</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Fullscreen Toggle Button */}
            {isStreaming && (
              <button
                onClick={() => setIsFullscreenMode(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 
                         text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
                title="Enter Auteur Glass (Fullscreen HUD)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
                <span>Auteur Glass</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              />
              <span className="text-xs text-white/60">Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isStreaming ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              />
              <span className="text-xs text-white/60">Vision</span>
            </div>
            {isStreaming && <VisionStatusBadge status={visionStatus} />}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-8 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed with Overlays */}
          <div className="lg:col-span-2 relative">
            <div
              ref={containerRef}
              className="aspect-video rounded-2xl overflow-hidden bg-slate-800/50 border border-white/10 relative"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Director Overlay - visual guides */}
              {isStreaming && (
                <DirectorOverlay
                  overlays={overlays}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />
              )}

              {/* Score Badge */}
              {isStreaming && score > 0 && <ScoreBadge score={score} />}

              {/* Lens Selector */}
              {isStreaming && (
                <FloatingLensSelector
                  currentLens={lens}
                  onLensChange={changeLens}
                />
              )}

              {/* Placeholder */}
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4 opacity-50">📷</div>
                  <p className="text-white/60">Camera feed will appear here</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-4 mt-4 justify-center">
              {!sessionActive ? (
                <button
                  onClick={startSession}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold
                           hover:shadow-lg hover:shadow-amber-500/25 transition-all hover:scale-105"
                >
                  🎬 Start Session
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold
                           hover:shadow-lg hover:shadow-red-500/25 transition-all hover:scale-105"
                >
                  ⏹ End Session
                </button>
              )}
            </div>
          </div>

          {/* HUD Panel */}
          <div className="space-y-4">
            {/* Agent Response */}
            {lastDirective && (
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 p-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎤</span>
                  <span className="text-sm font-semibold text-amber-400">
                    Director
                  </span>
                </div>
                <p className="text-white/90">{lastDirective}</p>
              </div>
            )}

            {/* Current Analysis */}
            {latestInsight && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white/90 flex items-center gap-2">
                    <span>👁</span> Analysis
                  </h3>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    {lens} lens
                  </span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">
                  {latestInsight.data.analysis}
                </p>
              </div>
            )}

            {/* Vision Log */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Vision Log
                </h3>
              </div>
              <InsightTerminalLog insights={insightLog} />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-2xl bg-red-500/20 border border-red-500/30 p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <span className="text-lg">⚠</span>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Lens Description */}
            <div
              className={`rounded-2xl border p-4 transition-all ${
                lens === "geometry"
                  ? "bg-cyan-500/5 border-cyan-500/20"
                  : lens === "light"
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-violet-500/5 border-violet-500/20"
              }`}
            >
              <h3
                className={`font-semibold mb-2 flex items-center gap-2 ${
                  lens === "geometry"
                    ? "text-cyan-400"
                    : lens === "light"
                      ? "text-amber-400"
                      : "text-violet-400"
                }`}
              >
                {lens === "geometry" && "△ Geometry"}
                {lens === "light" && "☀ Light"}
                {lens === "story" && "◇ Story"}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {lens === "geometry" &&
                  "Composition guides: rule of thirds, leading lines, subject position."}
                {lens === "light" &&
                  "Lighting analysis: direction, ratios, exposure, color temperature."}
                {lens === "story" &&
                  "Narrative read: mood, emotion, subject relationships."}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/20 backdrop-blur-sm bg-black/20">
        Powered by Overshoot Vision + LiveKit Voice
      </footer>
    </div>
  );
}
