import asyncio
import json
import logging
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

logger = logging.getLogger("auteur-agent")

load_dotenv(".env.local")


@dataclass
class VisualContext:
    """Stores the latest vision data for context injection."""

    mode: str = "geometry"
    analysis: str = ""
    score: int = 0
    overlays: list = field(default_factory=list)
    timestamp: int = 0


# Terse system instructions - no proactive behavior
TERSE_INSTRUCTIONS = """You are a terse professional cinematographer.

RULES:
- Keep answers under 2 sentences.
- Focus on physical adjustments: pan left, tilt down, step back, zoom in.
- Never explain theory unless explicitly asked.
- Be direct. No filler words.

When visual context is provided, use it to give specific, actionable feedback.
If no visual context is available, say you're still observing."""


def build_instructions_with_context(ctx: VisualContext) -> str:
    """Build complete instructions with visual context."""
    if not ctx.analysis:
        return f"""{TERSE_INSTRUCTIONS}

[Visual Context: Still observing - no data yet]"""

    return f"""{TERSE_INSTRUCTIONS}

[Visual Context - {ctx.mode.upper()} Lens, Score: {ctx.score}/10]:
{ctx.analysis}"""


class SilentObserverAgent(Agent):
    """Agent that buffers vision data and responds ONLY when user speaks."""

    def __init__(self, visual_context: VisualContext) -> None:
        instructions = build_instructions_with_context(visual_context)
        super().__init__(instructions=instructions)
        self.visual_context = visual_context


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def auteur_session(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

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

    # Async handler for vision data - must be wrapped for sync .on()
    async def handle_vision_update(message: dict):
        vision_data = message.get("data", {})

        # Update the visual context buffer SILENTLY
        visual_context.mode = message.get("mode", "geometry")
        visual_context.analysis = vision_data.get("analysis", "")
        visual_context.score = vision_data.get("score", 0)
        visual_context.overlays = vision_data.get("overlays", [])
        visual_context.timestamp = message.get("timestamp", 0)

        logger.info(
            f"Visual context updated (mode={visual_context.mode}, score={visual_context.score})"
        )

        # Update agent with new context
        new_agent = SilentObserverAgent(visual_context)
        session.update_agent(new_agent)

    # Sync wrapper for data_received - uses create_task for async work
    def on_data_received(
        data: bytes,
        participant: rtc.RemoteParticipant,
        kind: rtc.DataPacketKind,
        topic: str | None,
    ):
        try:
            message = json.loads(data.decode("utf-8"))
            if message.get("type") == "vision_update":
                asyncio.create_task(handle_vision_update(message))
        except json.JSONDecodeError:
            logger.warning("Received non-JSON data")
        except Exception as e:
            logger.error(f"Error processing data: {e}")

    # Async handler for participant greeting
    async def greet_participant():
        await session.say(
            "Auteur ready. Ask me anything about your shot.",
            allow_interruptions=True,
        )

    # Sync wrapper for participant_connected
    def on_participant_connected(participant: rtc.RemoteParticipant):
        if participant.identity.startswith("user-"):
            asyncio.create_task(greet_participant())

    # Register event handlers (sync wrappers)
    ctx.room.on("data_received", on_data_received)
    ctx.room.on("participant_connected", on_participant_connected)

    # Start session
    await session.start(
        agent=agent,
        room=ctx.room,
    )

    # Connect to room
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
