# test_tts_comparison.py
import asyncio
import time
from pathlib import Path

from app.agents.tts import get_tts

TEXT = (
    "Welcome to your AI interview. "
    "Please describe a challenging technical problem you recently solved."
)


async def generate(provider: str, output_name: str) -> None:
    tts = get_tts(provider)

    started = time.perf_counter()
    audio = await tts.synthesize(TEXT)
    elapsed = time.perf_counter() - started

    assert isinstance(audio, bytes)
    assert audio, f"{provider} returned empty audio"

    output = Path(output_name)
    output.write_bytes(audio)

    print(
        f"{provider}: {len(audio):,} bytes in {elapsed:.2f}s "
        f"-> {output.resolve()}"
    )


async def main() -> None:
    await generate("supertonic", "supertonic_test.wav")
    await generate("sarvam", "sarvam_test.wav")


if __name__ == "__main__":
    asyncio.run(main())