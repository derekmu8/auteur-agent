import pytest
from livekit.agents import AgentSession, inference, llm

from agent import SilentObserverAgent, VisualContext


def _llm() -> llm.LLM:
    return inference.LLM(model="openai/gpt-4.1-mini")


@pytest.mark.asyncio
async def test_responds_to_greeting() -> None:
    """Evaluation of the agent's ability to respond when spoken to."""
    visual_context = VisualContext()
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        await session.start(SilentObserverAgent(visual_context))

        result = await session.run(user_input="Hello, can you see my camera?")

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                Responds to the user's greeting briefly.
                May acknowledge observing or waiting for visual data.
                Should be concise (under 2 sentences).
                """,
            )
        )

        result.expect.no_more_events()


@pytest.mark.asyncio
async def test_uses_visual_context() -> None:
    """Evaluation of the agent's ability to use visual context in responses."""
    visual_context = VisualContext(
        mode="geometry",
        analysis="Subject on right third intersection, strong diagonal leading lines from bottom-left",
        score=8,
        overlays=[{"type": "rule_of_thirds", "status": "match"}],
        timestamp=1234567890,
    )
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        await session.start(SilentObserverAgent(visual_context))

        result = await session.run(user_input="How is my composition?")

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                References visual elements from the context:
                - Leading lines or diagonals
                - Rule of thirds or subject positioning

                Response must be:
                - Concise (under 2 sentences)
                - Action-focused (physical adjustments)
                """,
            )
        )

        result.expect.no_more_events()


@pytest.mark.asyncio
async def test_terse_responses() -> None:
    """Evaluation of the agent's terse response style."""
    visual_context = VisualContext(
        mode="light",
        analysis="Key light from upper-left, high contrast ratio, slight underexposure",
        score=6,
        timestamp=1234567890,
    )
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        await session.start(SilentObserverAgent(visual_context))

        result = await session.run(user_input="What should I adjust?")

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                Gives brief, actionable direction.
                Should be under 2 sentences.
                Focuses on physical adjustments (pan, tilt, step, zoom, etc.)
                Does NOT explain theory unless asked.
                """,
            )
        )

        result.expect.no_more_events()


@pytest.mark.asyncio
async def test_acknowledges_no_visual_data() -> None:
    """Evaluation of the agent's behavior when no visual data is available."""
    visual_context = VisualContext()  # Empty
    async with (
        _llm() as llm,
        AgentSession(llm=llm) as session,
    ):
        await session.start(SilentObserverAgent(visual_context))

        result = await session.run(user_input="What do you think of the lighting?")

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm,
                intent="""
                Acknowledges that visual data is not yet available.
                Does not fabricate visual observations.
                May mention still observing.
                """,
            )
        )

        result.expect.no_more_events()
