# test_sarvam_tts.py
import asyncio
import time
from pathlib import Path

from app.agents.tts import get_tts


async def main() -> None:
    text = (
        "Good morning everyone. Today I would like to talk about the importance of technology in our daily lives. Over the past decade,
         "artificial intelligence, cloud computing, and the Internet of Things have transformed the way we communicate, work, and solve problems. Businesses now rely on real-time data analysis to make informed decisions, 
         "while students use online learning platforms to improve their knowledge and skills. In healthcare, AI-powered systems assist doctors in diagnosing diseases more accurately and efficiently."
    )

    tts = get_tts()

    started = time.perf_counter()
    audio = await tts.synthesize(text)
    elapsed = time.perf_counter() - started

    assert isinstance(audio, bytes)
    assert audio, "TTS returned empty audio"

    output = Path("sarvam_bulbul_v3_test.wav")
    output.write_bytes(audio)

    print(f"Generated {len(audio):,} bytes in {elapsed:.2f} seconds")
    print(f"Saved audio to: {output.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())