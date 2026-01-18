# Auteur: "Silent Observer" Implementation Plan

## Overview
Refactor Auteur into a **truly passive** cinematography assistant. The agent runs a vision loop but remains **completely silent** until the user explicitly asks a question. Visual feedback comes through **on-screen overlays**, not audio.

---

## 🏗️ Architecture

### 1. Frontend (Next.js) - `useAuteurVision` Hook
**Goal:** Manage Overshoot streaming with structured JSON output for visual overlays.

- **Loop Integration:**
  - Standardize an interval of **4 seconds** for vision processing.
  - Process a 1-second clip of video every 4 seconds (`clip_length_seconds: 1.0`, `delay_seconds: 4.0`).
- **Structured JSON Output:**
  - VLM returns JSON only (no prose):
    ```json
    {
      "analysis": "Short text summary of the scene",
      "score": 8,
      "overlays": [
        { "type": "rule_of_thirds", "status": "match" },
        { "type": "subject_highlight", "coordinates": [0.5, 0.5, 0.2, 0.4] }
      ]
    }
    ```
  - `coordinates` are normalized [x, y, width, height] where 0-1 maps to frame dimensions.
- **Client-Side Parsing:**
  - Parse JSON response, extract `overlays` for UI rendering.
  - Send full JSON to backend for LLM context.
- **Throttling & Deduplication:**
  - Compare new `analysis` text vs old. If similarity > 80%, discard the update.
- **Lens Modes:**
  - **Geometry:** Rule of thirds, leading lines, symmetry, frame balance.
  - **Light:** Key/fill direction, contrast ratios, exposure, color temperature.
  - **Story:** Mood, narrative, emotion, subject relationships.

### 2. The Data Bridge
**Goal:** Transmit structured updates to the agent without triggering responses.

- **Transmission:** When vision data changes, send a LiveKit Data Packet:
  ```json
  {
    "type": "vision_update",
    "mode": "geometry",
    "data": {
      "analysis": "Subject on right third, strong diagonal lines",
      "score": 8,
      "overlays": [...]
    },
    "timestamp": 123456789
  }
  ```

### 3. Backend (Python Agent) - True Silent Observer
**Goal:** Buffer vision data silently. Only respond when user speaks.

- **State Management:**
  - `self.last_visual_context` stores the latest vision JSON.
- **Event Handler:**
  - `on_data_received` updates `self.last_visual_context` silently.
  - **NEVER call `session.say()` from this handler.** No proactive speech at all.
- **LLM Context Injection:**
  - When user speaks, inject visual context into the prompt:
    ```
    [Visual Context - GEOMETRY Lens, Score: 8/10]:
    Subject on right third, strong diagonal lines.

    User: How is this shot?
    ```
- **System Prompt (Terse Mode):**
  ```
  You are a terse professional cinematographer.
  Keep answers under 2 sentences.
  Focus on physical adjustments (pan left, tilt down, step back).
  Never explain theory unless asked.
  ```

### 4. Visual Overlay Layer
**Goal:** Draw compositional guides directly on the video feed.

- **DirectorOverlay Component:**
  - Transparent absolute-positioned layer over video.
  - Renders based on `overlays` array from vision data.
- **Overlay Types:**
  - `rule_of_thirds`: Draw 3x3 grid. Green if `status: "match"`, Red if `status: "mismatch"`.
  - `subject_highlight`: Draw bounding box at normalized coordinates.
  - `leading_line`: Draw line indicator (future).
- **Coordinate System:**
  - All coordinates normalized 0-1.
  - Convert to pixels using video container dimensions.

---

## 🛠️ Components to Create/Update

### [UPDATE] `frontend/hooks/useAuteurVision.ts`
- Change prompts to request **JSON-only output**.
- Parse response into `{ analysis, score, overlays }`.
- Export `overlays` array for UI consumption.

### [NEW] `frontend/components/DirectorOverlay.tsx`
- Accepts `overlays` array and container dimensions.
- Renders rule-of-thirds grid with color based on match status.
- Renders bounding boxes for subject highlights.

### [UPDATE] `frontend/components/LensSelector.tsx`
- No changes needed (already implemented).

### [UPDATE] `frontend/app/page.tsx`
- Integrate `DirectorOverlay` over video element.
- Pass `overlays` from vision hook to overlay component.

### [UPDATE] `agent/src/agent.py`
- Remove ALL proactive speech triggers.
- Update system prompt for terse, action-focused responses.
- Store `last_visual_context` as structured data.
- Inject context only when user initiates conversation.

---

## 🎯 Key Behavioral Changes

| Scenario | Before | After |
|----------|--------|-------|
| Vision update received | Agent might speak | **Completely silent** |
| "PERFECT SHOT" detected | Agent says "Now. Capture it." | **Silent** (user sees score) |
| User asks "How's this?" | Agent responds with context | Agent responds with context |
| Visual feedback | Text in sidebar | **Overlays on video** |

---

## 📊 Overlay Schema Reference

```typescript
interface VisionOverlay {
  type: "rule_of_thirds" | "subject_highlight" | "leading_line";
  status?: "match" | "mismatch";  // For rule_of_thirds
  coordinates?: [number, number, number, number];  // [x, y, w, h] normalized 0-1
  angle?: number;  // For leading_line (future)
}

interface VisionData {
  analysis: string;
  score: number;  // 1-10
  overlays: VisionOverlay[];
}
```
