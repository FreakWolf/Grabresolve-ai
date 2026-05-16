"""
GrabResolve AI - Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

NOVA_API_KEY = os.getenv("NOVA_API_KEY", "")
NOVA_BASE_URL = os.getenv("NOVA_BASE_URL", "https://api.nova.amazon.com/v1")
LLM_MODEL = os.getenv("NOVA_MODEL", "nova-2-lite-v1")

# ⬇️ CHANGED: 30 → 60 seconds (gives each LLM call more headroom)
NOVA_TIMEOUT_SECONDS = int(os.getenv("NOVA_TIMEOUT_SECONDS", "60"))

# ⬇️ ADDED: Retry config for Nova API resilience
NOVA_MAX_RETRIES = int(os.getenv("NOVA_MAX_RETRIES", "2"))
NOVA_RETRY_BACKOFF_SECONDS = float(os.getenv("NOVA_RETRY_BACKOFF_SECONDS", "1.5"))

AUTO_RESOLVE_CONFIDENCE = 0.75
HUMAN_REVIEW_THRESHOLD = 0.40
ESCALATION_THRESHOLD = 0.20

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")