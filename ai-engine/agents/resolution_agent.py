"""
Resolution Agent — Generates resolution recommendations
"""

import json
import google.genai as genai
from config import GEMINI_API_KEY, LLM_MODEL

client = genai.Client()


class ResolutionAgent:
    def __init__(self):
        pass

    async def resolve(self, ticket, classification: dict,
                      investigation: dict, root_cause: dict) -> dict:
        prompt = f"""
You are a resolution specialist at Grab. Based on the investigation, 
generate a resolution.

TICKET:
- ID: {ticket.ticket_id}
- Subject: {ticket.subject}
- Description: {ticket.description}
- Customer: {ticket.customer_id}

ROOT CAUSE: {json.dumps(root_cause, indent=2)}

INVESTIGATION FINDINGS: 
{json.dumps(investigation.get('findings', []), indent=2)}

Respond in this exact JSON format:
{{
    "action": "<specific action to take>",
    "action_type": "<one of: refund, partial_refund, credit, 
                     apology, driver_warning, driver_suspension, 
                     escalate, no_action, investigate_further>",
    "refund_amount": <amount or null>,
    "refund_currency": "<SGD/MYR/IDR/THB etc. or null>",
    "customer_message": "<professional message to send to customer>",
    "internal_notes": "<notes for internal team>",
    "follow_up_required": <true/false>,
    "follow_up_action": "<what follow-up if any>",
    "driver_action": "<action regarding driver if applicable, else null>",
    "estimated_resolution_time": "<e.g., 'Immediate', '1-2 hours', 
                                   '24 hours'>"
}}

GUIDELINES:
- Be fair to both customer and driver
- Follow Grab's customer-first approach
- Refund only when evidence supports it
- Always provide a professional customer message
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
            print(f"Resolution error: {e}")
            return {
                "action": "Escalate to senior agent for manual review",
                "action_type": "escalate",
                "refund_amount": None,
                "customer_message": "We're looking into your concern "
                                    "and will get back to you shortly.",
                "internal_notes": f"Auto-resolution failed: {str(e)}",
                "follow_up_required": True,
                "estimated_resolution_time": "2-4 hours"
            }