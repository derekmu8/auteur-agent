```
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, ConnectionState, Participant, Track } from "livekit-client";
import {
  useAuteurVision,
  type VisionStatus,
} from "../hooks/useAuteurVision";
import { DirectorView } from "../components/DirectorView";

export default function Home() {
  // LiveKit state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Session control
  const [sessionActive, setSessionActive] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);

  // Vision hook
  const {
    lens,
    latestInsight,
    insightLog,
    error: visionError,
    mediaStream,
    overlays,
    changeLens,
  } = useAuteurVision({
    roomRef,  // Pass ref instead of value
    enabled: sessionActive,
    isConnected,
  });

  // Connect to LiveKit room
  const connectToRoom = useCallback(async () => {
    try {
      const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!lkUrl) {
        throw new Error("NEXT_PUBLIC_LIVEKIT_URL not configured");
      }

      console.log("Connecting to LiveKit...");
      const tokenRes = await fetch("/api/token");
      const { token } = await tokenRes.json();

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
         // Check if agent is speaking
         const agentSpeaking = speakers.some(s => !s.isLocal);
         setIsSpeaking(agentSpeaking);
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setIsConnected(state === ConnectionState.Connected);
        console.log("Connection state:", state);
      });

      await room.connect(lkUrl, token);
      console.log("Connected to LiveKit");
      setIsConnected(true);
      setConnectionError(null);
    } catch (err) {
      console.error("Connection failed:", err);
      setConnectionError(
        `Connection failed: ${ err instanceof Error ? err.message : "Unknown error" } `
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

  // Start everything
  const startSession = useCallback(async () => {
    setPermissionGranted(true);
    setSessionActive(true);
    await connectToRoom();
    
    // Play audio context if needed
    if (audioRef.current) {
      try {
        await audioRef.current.play();
      } catch (e) {
        console.warn("Audio autoplay blocked", e);
      }
    }
  }, [connectToRoom]);

  // Cleanup
  useEffect(() => {
    return () => {
      disconnectFromRoom();
    };
  }, [disconnectFromRoom]);

  // If permissions not granted/session not active yet, show "Start" overlay
  if (!sessionActive) {
      return (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 text-center z-50">
             <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
                 <div className="relative w-24 h-24 mx-auto mb-8">
                    <div className="absolute inset-0 bg-white/10 rounded-full animate-ping" />
                    <div className="relative bg-white text-black p-6 rounded-full flex items-center justify-center text-4xl shadow-2xl">
                        ▣
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                     <h1 className="text-4xl font-bold tracking-tighter text-white">AUTEUR GLASS</h1>
                     <p className="text-white/50 font-mono text-xs uppercase tracking-widest">
                        Cinematic Vision • Real-time Direction • Voice Logic
                     </p>
                 </div>

                 <button
                    onClick={startSession}
                    className="group relative px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-full transition-all overflow-hidden"
                 >
                    <span className="relative z-10 font-mono text-sm tracking-[0.2em] group-hover:text-white transition-colors">
                        INITIALIZE_SYSTEM
                    </span>
                    <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 </button>
             </div>
             
             <div className="fixed bottom-8 text-[10px] text-white/20 font-mono">
                 v0.2.0 • SYSTEM_READY
             </div>
          </div>
      );
  }

  return (
    <>
      {/* Hidden Audio Element for LiveKit */}
      <audio ref={audioRef} autoPlay />

      {/* Main Director View (Always On) */}
      <DirectorView
        lens={lens}
        isConnected={isConnected}
        isSpeaking={isSpeaking}
        latestInsight={latestInsight}
        insightLog={insightLog}
        overlays={overlays}
        showOverlays={true} // Always show overlays if available
        onLensChange={changeLens}
        onExitFullscreen={() => {
            // Optional: Reload or pause session?
            // For now, reload window to "reset"
            window.location.reload();
        }}
        // Pass mediaStream from hook if available, otherwise DirectorView handles camera
        mediaStream={mediaStream}
      />
      
      {/* Error Toasts */}
      {(connectionError || visionError) && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 px-4 py-2 rounded-full text-red-200 text-xs font-mono flex items-center gap-2">
                 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                 {connectionError || visionError}
              </div>
          </div>
      )}
    </>
  );
}
```
