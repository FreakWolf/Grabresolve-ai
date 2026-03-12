"""
Root Cause Agent — Determines the root cause with confidence scoring
"""

import json
import google.genai as genai
from config import GEMINI_API_KEY, LLM_MODEL

client = genai.Client()


class RootCauseAgent:
    def __init__(self):
        pass

    async def analyze(self, ticket, classification: dict,
                      investigation: dict) -> dict:
        prompt = f"""
You are a root cause analysis expert at Grab, Southeast Asia's 
leading super app.

Analyze the following investigation results and determine the 
root cause.

TICKET:
- Subject: {ticket.subject}
- Description: {ticket.description}

CLASSIFICATION: {json.dumps(classification, indent=2)}

INVESTIGATION FINDINGS: 
{json.dumps(investigation.get('findings', []), indent=2)}

COLLECTED DATA: 
{json.dumps(investigation.get('collected_data', {}), indent=2, default=str)}

LLM INSIGHTS: {investigation.get('llm_insights', 'N/A')}

Respond in this exact JSON format:
{{
    "primary_cause": "<clear one-line root cause>",
    "secondary_causes": ["<list of contributing factors>"],
    "confidence": <float between 0.0 and 1.0>,
    "evidence_summary": "<summary of evidence supporting this conclusion>",
    "is_systemic": <true/false>,
    "systemic_pattern": "<description if systemic, null if not>",
    "responsible_party": "<one of: driver, system, merchant, 
                          customer_error, payment_gateway, unknown>",
    "severity": "<one of: critical, high, medium, low>"
}}

IMPORTANT: 
- Confidence should be HIGH (>0.85) only if data clearly supports 
  the conclusion
- Confidence should be MEDIUM (0.5-0.85) if evidence is partial
- Confidence should be LOW (<0.5) if unclear
- Respond ONLY with JSON
"""

        try:
            response = client.models.generate_content(model=LLM_MODEL, contents=prompt)
            result_text = response.text.strip()

            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]

            return json.loads(result_text)

        except Exception as e:
            print(f"Root cause analysis error: {e}")
            return {
                "primary_cause": "Unable to determine — needs manual review",
                "secondary_causes": [],
                "confidence": 0.3,
                "evidence_summary": "Insufficient data for automated analysis",
                "is_systemic": False,
                "systemic_pattern": None,
                "responsible_party": "unknown",
                "severity": "medium"
            }