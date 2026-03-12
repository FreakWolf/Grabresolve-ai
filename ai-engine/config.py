"""
GrabResolve AI — Configuration — FIXED
"""
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your-api-key-here")

# ✅ FIXED — Using gemini-2.5-flash (confirmed working)
LLM_MODEL = "gemini-2.5-flash"

# Confidence Thresholds
AUTO_RESOLVE_CONFIDENCE = 0.75
HUMAN_REVIEW_THRESHOLD = 0.40
ESCALATION_THRESHOLD = 0.20

# Data paths
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")