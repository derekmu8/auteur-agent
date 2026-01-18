# Auteur: AI Co-Director 🎬

> Bridges physical cinematography and digital intelligence.

**Auteur** is a real-time, multimodal AI agent that acts as your cinematic co-director. It "sees" what you shoot through a camera and "speaks" to you with directorial advice, creating an infinite feedback loop of creativity.

## 🚀 The Stack
Built with a cutting-edge **Next.js + Python** architecture.

- **Vision (The Eyes)**: [Overshoot VLM](https://overshoot.tv) — Real-time frame analysis (Geometry, Lighting, Story).
- **Transport (The Nerves)**: [LiveKit](https://livekit.io) — Ultra-low latency WebRTC for video, audio, and data.
- **Cognition (The Brain)**: [OpenAI](https://openai.com) — GPT-4o-mini with stateful context injection.

## 🎥 Features

### 1. The "Silent Observer"
Unlike standard voice assistants, Auteur doesn't just wait for you to speak. It **continuously watches** your camera feed. When you do ask *"How is this shot?"*, it already knows the answer because it has been building context for seconds.

### 2. Auteur Glass (The Interface)
A cinematic "Heads-Up Display" that overlays technical data onto your world.
- **Geometry Lens**: 3x3 Grid overlays for composition.
- **Light Lens**: Real-time histograms for exposure.
- **Story Lens**: Cinematic letterboxing for narrative framing.

### 3. Infinite Loop
1. **Capture**: You point the camera.
2. **Analyze**: Overshoot VLM extracts insights (e.g., "The subject is back-lit").
3. **Reason**: The Python Agent decides if this aligns with cinematic rules.
4. **Direct**: The Agent speaks: *"Tilt down. You're cutting off their headroom."*

## 🛠️ How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- API Keys for: LiveKit, Overshoot, OpenAI, Cartesia, AssemblyAI.

### 1. Start the Agent (Brain)
```bash
cd agent
# Install dependencies
uv sync
# Run the agent
uv run python src/agent.py dev
```

### 2. Start the Frontend (Interface)
```bash
cd frontend
# Install dependencies
npm install
# Run the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and grant camera/microphone permissions.

## 🧠 Technical Highlights
- **Stateful Context Injection**: We inject vision analysis directly into the LLM's system prompt *in-place*, avoiding the need to send image bytes with every chat request.
- **Data-Driven HUD**: The frontend visualizations are driven entirely by the VLM's JSON output.

---
*Built with ❤️ for the Hackathon.*
