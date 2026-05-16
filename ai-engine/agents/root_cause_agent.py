"""
Root Cause Agent - Determines the root cause with confidence scoring.
"""
import json

from llm_client import client
from token_tracker import get_tracker


class RootCauseAgent:
    async def analyze(self, ticket, classification: dict, investigation: dict) -> dict:
        system_prompt = (
            "You are a Grab support root-cause analyst. "
            "Return strict JSON only - no markdown, no explanations, no reasoning text."
        )
        user_prompt = f"""
Analyze the following support case and determine the most likely root cause.

TICKET:
- Subject: {ticket.subject}
- Description: {ticket.description}

CLASSIFICATION:
{json.dumps(classification, indent=2)}

INVESTIGATION FINDINGS:
{json.dumps(investigation.get('findings', []), indent=2)}

COLLECTED DATA:
{json.dumps(investigation.get('collected_data', {}), indent=2, default=str)}

LLM INSIGHTS:
{investigation.get('llm_insights', 'N/A')}

Respond in this exact JSON format:
{{
  "primary_cause": "<clear one-line root cause>",
  "secondary_causes": ["<list of contributing factors>"],
  "confidence": <float between 0.0 and 1.0>,
  "evidence_summary": "<summary of evidence supporting this conclusion>",
  "is_systemic": <true/false>,
  "systemic_pattern": "<description if systemic, null if not>",
  "responsible_party": "<one of: driver, system, merchant, customer_error, payment_gateway, unknown>",
  "severity": "<one of: critical, high, medium, low>"
}}

Keep confidence high only when the evidence is strong.
"""

        try:
            # ⬇️ CHANGED: max_tokens 1100 → 600, removed reasoning_effort="high"
            # This single change saves ~5,000 tokens per ticket
            result = client.json_response(
                system_prompt, user_prompt,
                max_tokens=600
            )

            # Track token usage on success
            tracker = get_tracker(ticket.ticket_id)
            if tracker:
                tracker.add_call("root_cause", client.last_usage)

            return result

        except Exception as exc:
            # ⬇️ ADDED: Track tokens even on failure
            tracker = get_tracker(ticket.ticket_id)
            if tracker and client.last_usage:
                tracker.add_call("root_cause_failed", client.last_usage)

            print(f"Root cause analysis error: {exc}")
            return {
                "primary_cause": "Unable to determine - needs manual review",
                "secondary_causes": [],
                "confidence": 0.3,
                "evidence_summary": "Insufficient data for automated analysis",
                "is_systemic": False,
                "systemic_pattern": None,
                "responsible_party": "unknown",
                "severity": "medium"
            }