"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { RealtimeVision, StreamInferenceResult } from "@overshoot/sdk";
import { Room } from "livekit-client";

// Lens types for different analysis modes
export type LensMode = "geometry" | "light" | "story";

// Vision status for freshness indicator
export type VisionStatus = "fresh" | "stale" | "idle";

// Overlay types for visual rendering
export interface VisionOverlay {
  type: "rule_of_thirds" | "subject_highlight" | "focus_point" | "direction" | "leading_line";
  status?: "match" | "mismatch" | "left" | "right" | "up" | "down";
  coordinates?: [number, number, number, number]; // [x, y, w, h] normalized 0-1
}

// Structured vision data from VLM
export interface VisionData {
  analysis: string;
  score: number;
  overlays: VisionOverlay[];
}

// Full insight with metadata
export interface VisionInsight {
  data: VisionData;
  lens: LensMode;
  timestamp: number;
}

// Hook configuration
interface UseAuteurVisionConfig {
  room: Room | null;
  enabled: boolean;
}

// Lens-specific prompts - requesting JSON output with overlays
const LENS_PROMPTS: Record<LensMode, string> = {
  geometry: `Analyze composition. Return ONLY valid JSON:

{"analysis":"One sentence on composition","score":7,"overlays":[{"type":"rule_of_thirds","status":"match"},{"type":"subject_highlight","coordinates":[0.3,0.2,0.4,0.5]}]}

Rules:
- analysis: Short composition observation
- score: 1-10 rating
- overlays array must include:
  - rule_of_thirds with status "match" or "mismatch"
  - subject_highlight with [x,y,width,height] as 0-1 decimals if subject exists
- coordinates: x,y is top-left, values 0.0-1.0

Return ONLY the JSON object, no other text.`,

  light: `Analyze lighting. Return ONLY valid JSON:

{"analysis":"One sentence on lighting","score":6,"overlays":[{"type":"subject_highlight","coordinates":[0.4,0.3,0.3,0.4]},{"type":"direction","status":"left"}]}

Rules:
- analysis: Key light direction, ratio, exposure note
- score: 1-10 rating
- overlays array should include:
  - subject_highlight for lit subject [x,y,width,height] as 0-1 decimals
  - direction with status "left"/"right"/"up"/"down" if adjustment needed
- coordinates: x,y is top-left, values 0.0-1.0

Return ONLY the JSON object, no other text.`,

  story: `Analyze emotion and narrative. Return ONLY valid JSON:

{"analysis":"One sentence on mood/story","score":8,"overlays":[{"type":"subject_highlight","coordinates":[0.5,0.4,0.2,0.3]},{"type":"focus_point","coordinates":[0.6,0.5,0,0]}]}

Rules:
- analysis: Mood, emotion, or story observation
- score: 1-10 rating
- overlays array should include:
  - subject_highlight for emotional subject [x,y,width,height] as 0-1 decimals
  - focus_point at emotional focal point [x,y,0,0] (only x,y matter)
- coordinates: values 0.0-1.0

Return ONLY the JSON object, no other text.`,
};

// Parse VLM response to structured data
function parseVisionResponse(raw: string): VisionData | null {
  try {
    // Clean the response - remove markdown code blocks if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Try to extract JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize overlays
    const overlays: VisionOverlay[] = [];
    if (Array.isArray(parsed.overlays)) {
      for (const o of parsed.overlays) {
        if (o.type && typeof o.type === "string") {
          const overlay: VisionOverlay = { type: o.type };
          if (o.status) overlay.status = o.status;
          if (Array.isArray(o.coordinates) && o.coordinates.length >= 2) {
            overlay.coordinates = [
              Math.max(0, Math.min(1, o.coordinates[0] || 0)),
              Math.max(0, Math.min(1, o.coordinates[1] || 0)),
              Math.max(0, Math.min(1, o.coordinates[2] || 0)),
              Math.max(0, Math.min(1, o.coordinates[3] || 0)),
            ];
          }
          overlays.push(overlay);
        }
      }
    }

    return {
      analysis: parsed.analysis || "",
      score: Math.min(10, Math.max(1, parseInt(parsed.score) || 5)),
      overlays,
    };
  } catch (e) {
    console.error("Failed to parse vision response:", raw, e);
    return null;
  }
}

// Simple token-based similarity check
function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const tokenize = (s: string) =>
    s.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  return intersection / union;
}

export function useAuteurVision({ room, enabled }: UseAuteurVisionConfig) {
  // State
  const [lens, setLens] = useState<LensMode>("geometry");
  const [visionStatus, setVisionStatus] = useState<VisionStatus>("idle");
  const [latestInsight, setLatestInsight] = useState<VisionInsight | null>(null);
  const [insightLog, setInsightLog] = useState<VisionInsight[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Refs
  const visionRef = useRef<RealtimeVision | null>(null);
  const lastAnalysisRef = useRef<string>("");
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLensRef = useRef<LensMode>(lens);

  // Keep lens ref updated
  useEffect(() => {
    currentLensRef.current = lens;
  }, [lens]);

  // Send vision update to agent via LiveKit data packet
  const sendVisionUpdate = useCallback(
    (insight: VisionInsight) => {
      if (!room?.localParticipant) return;

      const data = new TextEncoder().encode(
        JSON.stringify({
          type: "vision_update",
          mode: insight.lens,
          data: insight.data,
          timestamp: insight.timestamp,
        })
      );

      room.localParticipant.publishData(data, { reliable: true });
    },
    [room]
  );

  // Process vision result with deduplication
  const processVisionResult = useCallback(
    (result: StreamInferenceResult) => {
      if (!result.ok || !result.result) {
        console.error("Vision inference error:", result.error);
        return;
      }

      const visionData = parseVisionResponse(result.result);
      if (!visionData) return;

      const now = Date.now();
      const currentLens = currentLensRef.current;

      // Check similarity with last analysis (deduplication)
      const similarity = calculateSimilarity(visionData.analysis, lastAnalysisRef.current);
      if (similarity > 0.8) {
        console.log(`Skipping similar content (${Math.round(similarity * 100)}% match)`);
        return;
      }

      // Update last analysis
      lastAnalysisRef.current = visionData.analysis;

      // Create insight
      const insight: VisionInsight = {
        data: visionData,
        lens: currentLens,
        timestamp: now,
      };

      // Update state
      setLatestInsight(insight);
      setInsightLog((prev) => [insight, ...prev].slice(0, 50));
      setVisionStatus("fresh");

      // Send to agent
      sendVisionUpdate(insight);

      // Reset stale timer
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
      }
      staleTimerRef.current = setTimeout(() => {
        setVisionStatus("stale");
      }, 10000);
    },
    [sendVisionUpdate]
  );

  // Start vision stream
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
        prompt: LENS_PROMPTS[currentLensRef.current],
        source: { type: "camera", cameraFacing: "environment" },
        processing: {
          fps: 30,
          sampling_ratio: 0.1,
          clip_length_seconds: 1.0,
          delay_seconds: 4.0,
        },
        onResult: processVisionResult,
        onError: (err) => {
          setError(`Vision error: ${err.message}`);
        },
        debug: false,
      });

      await vision.start();
      visionRef.current = vision;

      const stream = vision.getMediaStream();
      if (stream) {
        setMediaStream(stream);
      }

      setIsStreaming(true);
      setVisionStatus("idle");
      setError(null);
    } catch (err) {
      setError(`Vision start failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [processVisionResult]);

  // Stop vision stream
  const stopVision = useCallback(async () => {
    if (visionRef.current) {
      await visionRef.current.stop();
      visionRef.current = null;
    }

    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }

    setIsStreaming(false);
    setVisionStatus("idle");
    setMediaStream(null);
    lastAnalysisRef.current = "";
  }, []);

  // Change lens (updates prompt)
  const changeLens = useCallback(
    async (newLens: LensMode) => {
      setLens(newLens);
      currentLensRef.current = newLens;
      lastAnalysisRef.current = ""; // Reset dedup for new lens

      if (visionRef.current && isStreaming) {
        await visionRef.current.updatePrompt(LENS_PROMPTS[newLens]);
      }
    },
    [isStreaming]
  );

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !isStreaming) {
      startVision();
    } else if (!enabled && isStreaming) {
      stopVision();
    }
  }, [enabled, isStreaming, startVision, stopVision]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVision();
    };
  }, [stopVision]);

  return {
    // State
    lens,
    visionStatus,
    latestInsight,
    insightLog,
    isStreaming,
    error,
    mediaStream,
    // Computed - easy access to current overlays
    overlays: latestInsight?.data.overlays ?? [],
    score: latestInsight?.data.score ?? 0,

    // Actions
    startVision,
    stopVision,
    changeLens,
  };
}
