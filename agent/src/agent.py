import asyncio
import json
from dataclasses import dataclass, field

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
)
from livekit.plugins import silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")


@dataclass
class VisualContext:
    """Stores the latest vision data for context injection."""

    mode: str = "geometry"
    analysis: str = ""
    score: int = 0
    overlays: list = field(default_factory=list)
    timestamp: int = 0


TERSE_INSTRUCTIONS = """You are a terse professional cinematographer.

RULES:
- Keep answers under 2 sentences.
- Focus on physical adjustments: pan left, tilt down, step back, zoom in.
- Never explain theory unless explicitly asked.
- Be direct. No filler words.

When visual context is provided, use it to give specific, actionable feedback.
If no visual context is available, say you're still observing.

STORY MODE:
When in story mode, you are a visual storyteller. The analysis will describe interesting
subjects that create a narrative together. Your role is to:
- Describe the story connection between subjects (what makes them compelling together)
- Suggest framing adjustments to strengthen the visual narrative
- Point out non-obvious relationships (contrast, juxtaposition, scale, causality)
- Be poetic but brief - one evocative observation is better than a paragraph"""


def build_instructions_with_context(ctx: VisualContext) -> str:
    """Build complete instructions with visual context."""
    if not ctx.analysis:
        return f"""{TERSE_INSTRUCTIONS}

[Visual Context: Still observing - no data yet]"""

    # For story mode, include story subject details
    if ctx.mode == "story" and ctx.overlays:
        story_subjects = [o for o in ctx.overlays if o.get("type") == "story_subject"]
        if story_subjects:
            subjects_desc = ", ".join([
                f"{o.get('label', 'unknown')} ({o.get('narrative_role', 'element')})"
                for o in story_subjects
            ])
            return f"""{TERSE_INSTRUCTIONS}

[Visual Context - STORY Mode, Narrative Score: {ctx.score}/10]:
Story Elements: {subjects_desc}
Connection: {ctx.analysis}

Describe what makes these subjects tell a story together. Be evocative."""

    return f"""{TERSE_INSTRUCTIONS}

[Visual Context - {ctx.mode.upper()} Lens, Score: {ctx.score}/10]:
{ctx.analysis}"""


class SilentObserverAgent(Agent):
    """Agent that buffers vision data and responds ONLY when user speaks."""

    def __init__(self, visual_context: VisualContext) -> None:
        self.visual_context = visual_context
        instructions = build_instructions_with_context(visual_context)
        super().__init__(instructions=instructions)

    def update_context(self, new_context: VisualContext):
        """Update instructions based on new visual context."""
        self.visual_context = new_context
        self.instructions = build_instructions_with_context(new_context)
        print(f"[AUTEUR] Agent instructions updated. Analysis len: {len(new_context.analysis)}", flush=True)


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def auteur_session(ctx: JobContext):
    print(f"[AUTEUR] Session started for room: {ctx.room.name}", flush=True)

    # Shared visual context buffer
    visual_context = VisualContext()

    # Create the silent observer agent
    agent = SilentObserverAgent(visual_context)

    # Set up voice AI pipeline
    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-streaming", language="en"),
        llm=inference.LLM(model="openai/gpt-4o-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
        allow_interruptions=True,
    )

    # Start session first
    await session.start(
        agent=agent,
        room=ctx.room,
    )
    print("[AUTEUR] Session started", flush=True)

    # Connect to room
    await ctx.connect()
    print("[AUTEUR] Connected to room", flush=True)

    # Now register handlers AFTER connecting
    def on_data_received(data_packet: rtc.DataPacket):
        # print(f"[AUTEUR] DATA RECEIVED! Size: {len(data_packet.data)} bytes", flush=True)
        try:
            message = json.loads(data_packet.data.decode("utf-8"))
            # print(f"[AUTEUR] Message type: {message.get('type')}", flush=True)
            if message.get("type") == "vision_update":
                vision_data = message.get("data", {})
                
                # Update context object
                visual_context.mode = message.get("mode", "geometry")
                visual_context.analysis = vision_data.get("analysis", "")
                visual_context.score = vision_data.get("score", 0)
                visual_context.overlays = vision_data.get("overlays", [])
                visual_context.timestamp = message.get("timestamp", 0)
                
                if visual_context.analysis:
                    print(f"[AUTEUR] Visual context updated: {visual_context.analysis[:50]}...", flush=True)
                else:
                    print("[AUTEUR] Visual context received EMPTY analysis", flush=True)

                # Update agent instructions directly
                agent.update_context(visual_context)

        except Exception as e:
            print(f"[AUTEUR] Error processing data: {e}", flush=True)

    def on_participant_connected(participant: rtc.RemoteParticipant):
        print(f"[AUTEUR] Participant connected: {participant.identity}", flush=True)
        if participant.identity.startswith("user-"):
            asyncio.create_task(
                session.say(
                    "Auteur ready. Ask me anything about your shot.",
                    allow_interruptions=True,
                )
            )

    ctx.room.on("data_received", on_data_received)
    ctx.room.on("participant_connected", on_participant_connected)
    print("[AUTEUR] Event handlers registered", flush=True)

    # Keep the session alive
    await asyncio.sleep(float("inf"))


if __name__ == "__main__":
    cli.run_app(server)
