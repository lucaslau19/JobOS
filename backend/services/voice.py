import tempfile
import os
from openai import AsyncOpenAI
from config import OPENAI_API_KEY

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio bytes using OpenAI Whisper."""
    # Write to a temp file since the API expects a file
    suffix = os.path.splitext(filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
        return transcript.text
    finally:
        os.unlink(tmp_path)


async def text_to_speech(text: str) -> bytes:
    """Convert text to speech using OpenAI TTS."""
    response = await client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text,
    )
    return response.content
