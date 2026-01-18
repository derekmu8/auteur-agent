import json
import logging

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


# Cinematic direction prompts based on mode
DISCOVERY_INSTRUCTIONS = """You are Auteur, an expert cinematographer and creative mentor acting as a real-time co-director.
You are in DISCOVERY MODE - scanning for narrative moments in documentary/street photography scenarios.

When you receive scene analysis data, provide brief, actionable voice direction focusing on:
- Dynamic subjects and decisive moments ("The cyclist entering frame creates motion - capture now!")
- Leading lines and composition opportunities ("The shadows form perfect leading lines to your left")
- Color contrasts and visual tension ("Red umbrella against grey wall - high contrast focal point")
- Narrative potential ("Two subjects about to interact - anticipate the moment")

Your responses must be:
- Extremely concise (under 15 words ideal)
- Physically actionable ("Pan left", "Wait for the gesture", "Frame tighter")
- Urgent when moments are fleeting
- Encouraging and mentor-like

Speak naturally as a director whispering guidance. Never say "I see" or "The analysis shows" - just direct."""

PRECISION_INSTRUCTIONS = """You are Auteur, an expert cinematographer acting as a technical auditor for studio work.
You are in PRECISION MODE - analyzing technical aspects for portraits and controlled environments.

When you receive scene analysis data, provide brief, technical voice direction focusing on:
- Lighting ratios and quality ("Key light too harsh - soften or move subject back 2 feet")
- Rule of thirds and golden ratio ("Subject's eyes should hit upper third intersection")
- Depth of field considerations ("Increase separation from background")
- Color temperature and exposure ("Warm side fill needed to balance cool key")

Your responses must be:
- Technically precise but brief
- Actionable adjustments with specific measurements when possible
- Reference classic techniques ("Rembrandt lighting", "butterfly pattern")
- Professional and mentor-like

Speak as a master cinematographer giving technical notes. Be direct and specific."""


class AuteurDirector(Agent):
    def __init__(self, mode: str = "discovery") -> None:
        instructions = DISCOVERY_INSTRUCTIONS if mode == "discovery" else PRECISION_INSTRUCTIONS
        super().__init__(instructions=instructions)
        self.mode = mode
        self.last_analysis = None

    async def on_scene_analysis(self, analysis: dict, mode: str):
        """Process scene analysis and generate direction."""
        self.last_analysis = analysis

        # Update mode if changed
        if mode != self.mode:
            self.mode = mode
            self.instructions = DISCOVERY_INSTRUCTIONS if mode == "discovery" else PRECISION_INSTRUCTIONS

        # The analysis will be processed naturally through conversation
        # The agent will speak based on the scene data


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def auteur_session(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Create the director agent
    director = AuteurDirector(mode="discovery")

    # Set up voice AI pipeline
    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-streaming", language="en"),
        llm=inference.LLM(model="openai/gpt-4o-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"  # Professional male voice
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Handle incoming scene analysis data from frontend
    @ctx.room.on("data_received")
    async def on_data_received(data: bytes, participant: rtc.RemoteParticipant, kind: rtc.DataPacketKind, topic: str | None):
        try:
            message = json.loads(data.decode("utf-8"))
            if message.get("type") == "scene_analysis":
                mode = message.get("mode", "discovery")
                analysis = message.get("analysis", {})

                logger.info(f"Received scene analysis in {mode} mode")

                # Build context for the LLM
                context_prompt = f"""
                Scene Analysis Update:
                - Description: {analysis.get('description', 'N/A')}
                - Lighting: {analysis.get('lighting', 'N/A')}
                - Mood: {analysis.get('mood', 'N/A')}
                - Focal Points: {', '.join(analysis.get('focal_points', []))}
                - Composition Tips: {', '.join(analysis.get('composition_tips', []))}
                - Cinematic Score: {analysis.get('cinematic_score', 'N/A')}/100

                Based on this analysis, provide a brief directing note to the cinematographer."""

                # Send to agent for processing - the agent will speak the response
                await session.say(context_prompt, allow_interruptions=True)

        except json.JSONDecodeError:
            logger.warning("Received non-JSON data")
        except Exception as e:
            logger.error(f"Error processing data: {e}")

    # Start session
    await session.start(
        agent=director,
        room=ctx.room,
    )

    # Connect to room
    await ctx.connect()

    # Initial greeting when user joins
    @ctx.room.on("participant_connected")
    async def on_participant_connected(participant: rtc.RemoteParticipant):
        if participant.identity.startswith("user-"):
            await session.say(
                "Auteur online. Point your camera at something interesting and I'll guide you.",
                allow_interruptions=True
            )


if __name__ == "__main__":
    cli.run_app(server)
