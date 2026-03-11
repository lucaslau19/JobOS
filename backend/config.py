import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

# Claude / Anthropic
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

# OpenAI (Whisper + TTS)
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

# CORS
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
