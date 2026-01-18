"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, ConnectionState, Track } from "livekit-client";
import { RealtimeVision, StreamInferenceResult } from "@overshoot/sdk";

// Types for scene analysis
interface SceneAnalysis {
  description: string;
  lighting: string;
  composition_tips: string[];
  focal_points: string[];
  mood: string;
}

// Mode type
type DirectorMode = "discovery" | "precision";

export default function Home() {
  // State
  const [mode, setMode] = useState<DirectorMode>("discovery");
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sceneAnalysis, setSceneAnalysis] = useState<SceneAnalysis | null>(null);
  const [lastDirective, setLastDirective] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [cinematicScore, setCinematicScore] = useState<number>(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const visionRef = useRef<RealtimeVision | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Prompts for different modes
  const getPrompt = useCallback((currentMode: DirectorMode) => {
    if (currentMode === "discovery") {
      return `You are an expert cinematographer analyzing a live camera feed for documentary/street photography.
Analyze the scene and return JSON with this exact structure:
{
  "description": "Brief scene description",
  "lighting": "Lighting analysis (direction, quality, contrast ratio estimate)",
  "composition_tips": ["Tip 1", "Tip 2"],
  "focal_points": ["Point of interest 1", "Point of interest 2"],
  "mood": "Overall mood/atmosphere",
  "cinematic_score": 1-100 score for how cinematic the current frame is
}
Focus on: dynamic subjects, leading lines, color contrasts, narrative potential, decisive moments.`;
    } else {
      return `You are a precision cinematographer analyzing a live camera feed for studio/portrait work.
Analyze the scene and return JSON with this exact structure:
{
  "description": "Technical scene description",
  "lighting": "Detailed lighting setup analysis (key, fill, rim, ratios, shadows)",
  "composition_tips": ["Technical adjustment 1", "Technical adjustment 2"],
  "focal_points": ["Subject positioning", "Background elements"],
  "mood": "Achieved vs intended mood",
  "cinematic_score": 1-100 score for technical perfection
}
Focus on: rule of thirds, golden ratio, depth of field, lighting ratios, color temperature, exposure.`;
    }
  }, []);

  // Connect to LiveKit room
  const connectToRoom = useCallback(async () => {
    try {
      const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!lkUrl) {
        throw new Error("NEXT_PUBLIC_LIVEKIT_URL not configured");
      }

      // Fetch token from our API
      const tokenRes = await fetch("/api/token");
      const { token } = await tokenRes.json();

      const room = new Room();
      roomRef.current = room;

      // Handle agent audio
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
        }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setIsConnected(state === ConnectionState.Connected);
      });

      // Handle data from agent
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload));
          if (message.type === "directive") {
            setLastDirective(message.content);
          }
        } catch (e) {
          // Not JSON, ignore
        }
      });

      await room.connect(lkUrl, token);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(`Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  // Start Overshoot vision stream
  const startVision = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_OVERSHOOT_API_URL;
      const apiKey = process.env.NEXT_PUBLIC_OVERSHOOT_API_KEY;

      if (!apiUrl || !apiKey) {
        throw new Error("Overshoot API credentials not configured");
      }

      const vision = new RealtimeVision({
        apiUrl,
        apiKey,
        prompt: getPrompt(mode),
        source: { type: "camera", cameraFacing: "environment" },
        processing: {
          fps: 30,
          sampling_ratio: 0.1,
          clip_length_seconds: 2.0,
          delay_seconds: 2.0,
        },
        onResult: (result: StreamInferenceResult) => {
          if (result.ok) {
            try {
              const analysis = JSON.parse(result.result) as SceneAnalysis & { cinematic_score?: number };
              setSceneAnalysis(analysis);
              if (analysis.cinematic_score) {
                setCinematicScore(analysis.cinematic_score);
              }

              // Send analysis to LiveKit agent
              if (roomRef.current?.localParticipant) {
                const data = new TextEncoder().encode(JSON.stringify({
                  type: "scene_analysis",
                  mode,
                  analysis,
                  timestamp: Date.now(),
                }));
                roomRef.current.localParticipant.publishData(data, { reliable: true });
              }
            } catch (e) {
              console.error("Failed to parse analysis:", e);
            }
          } else {
            console.error("Vision inference error:", result.error);
          }
        },
        onError: (error) => {
          setError(`Vision error: ${error.message}`);
        },
        debug: false,
      });

      await vision.start();
      visionRef.current = vision;

      // Attach stream to video element
      const stream = vision.getMediaStream();
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      setError(null);
    } catch (err) {
      setError(`Vision start failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [mode, getPrompt]);

  // Stop everything
  const stopSession = useCallback(async () => {
    if (visionRef.current) {
      await visionRef.current.stop();
      visionRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsStreaming(false);
    setIsConnected(false);
    setSceneAnalysis(null);
  }, []);

  // Update prompt when mode changes
  useEffect(() => {
    if (visionRef.current && isStreaming) {
      visionRef.current.updatePrompt(getPrompt(mode));
    }
  }, [mode, getPrompt, isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white font-sans">
      {/* Hidden audio element for agent voice */}
      <audio ref={audioRef} autoPlay />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <span className="text-xl">🎬</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Auteur</h1>
              <p className="text-xs text-white/50">Agentic Co-Director</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 bg-white/5 rounded-full p-1">
            <button
              onClick={() => setMode("discovery")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === "discovery"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                  : "text-white/60 hover:text-white"
                }`}
            >
              🔍 Discovery
            </button>
            <button
              onClick={() => setMode("precision")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === "precision"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25"
                  : "text-white/60 hover:text-white"
                }`}
            >
              🎯 Precision
            </button>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-xs text-white/60">Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isStreaming ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-xs text-white/60">Vision</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-8 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Video Feed */}
          <div className="lg:col-span-2 relative" id="camera-feed-container">
            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-800/50 border border-white/10 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Overlay Grid for Precision Mode */}
              {mode === "precision" && isStreaming && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Rule of thirds grid */}
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                </div>
              )}

              {/* Cinematic Score Badge */}
              {isStreaming && cinematicScore > 0 && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Cinematic Score</div>
                  <div className={`text-2xl font-bold ${cinematicScore >= 70 ? "text-emerald-400" :
                      cinematicScore >= 40 ? "text-amber-400" : "text-red-400"
                    }`}>
                    {cinematicScore}
                  </div>
                </div>
              )}

              {/* Placeholder when not streaming */}
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4 text-white/50">📷</div>
                  <p className="text-white/60">Camera feed will appear here</p>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4 mt-4 justify-center">
              {!isStreaming ? (
                <button
                  onClick={async () => {
                    await connectToRoom();
                    await startVision();
                  }}
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
                  ⏹️ End Session
                </button>
              )}
            </div>
          </div>

          {/* HUD Panel */}
          <div className="space-y-4">
            {/* Last Directive */}
            {lastDirective && (
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 p-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎤</span>
                  <span className="text-sm font-semibold text-amber-400">Director Says</span>
                </div>
                <p className="text-white/90">{lastDirective}</p>
              </div>
            )}

            {/* Scene Analysis */}
            {sceneAnalysis && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4 backdrop-blur-sm">
                <h3 className="font-semibold text-white/90 flex items-center gap-2">
                  <span>📊</span> Scene Analysis
                </h3>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Description</div>
                    <p className="text-sm text-white/80 leading-relaxed">{sceneAnalysis.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Lighting</div>
                      <p className="text-sm text-white/80">{sceneAnalysis.lighting}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Mood</div>
                      <p className="text-sm text-white/80">{sceneAnalysis.mood}</p>
                    </div>
                  </div>

                  {sceneAnalysis.focal_points.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Focal Points</div>
                      <div className="flex flex-wrap gap-2">
                        {sceneAnalysis.focal_points.map((point, i) => (
                          <span key={i} className="px-2 py-1 bg-white/10 rounded-md text-[11px] text-white/80 border border-white/5">
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {sceneAnalysis.composition_tips.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                      <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Composition Tips</div>
                      <ul className="space-y-2">
                        {sceneAnalysis.composition_tips.map((tip, i) => (
                          <li key={i} className="text-sm text-emerald-400/90 flex items-start gap-2">
                            <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400/40 shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="rounded-2xl bg-red-500/20 border border-red-500/30 p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <span className="text-lg">⚠️</span>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Mode Description */}
            <div className={`rounded-2xl border p-4 transition-all ${mode === "discovery"
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-violet-500/5 border-violet-500/20"
              }`}>
              <h3 className={`font-semibold mb-2 flex items-center gap-2 ${mode === "discovery" ? "text-emerald-400" : "text-violet-400"
                }`}>
                {mode === "discovery" ? "🔍 Discovery Mode" : "🎯 Precision Mode"}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {mode === "discovery"
                  ? "Scanning for narrative moments, dynamic subjects, and spontaneous compositions. Perfect for street photography and documentary work."
                  : "Analyzing technical aspects: lighting ratios, composition rules, and frame perfection. Ideal for studio and portrait work."}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/20 backdrop-blur-sm bg-black/20">
        Powered by Overshoot Vision + LiveKit Voice • NexHacks 2026
      </footer>
    </div>
  );
}
