"""
Resolution Agent - Generates resolution recommendations.
"""
import json

from llm_client import client


class ResolutionAgent:
    async def resolve(self, ticket, classification: dict, investigation: dict, root_cause: dict) -> dict:
        system_prompt = (
            "You are a Grab resolution specialist. "
            "Return strict JSON only."
        )
        user_prompt = f"""
Based on the following case details, propose a fair and practical resolution.

TICKET:
- ID: {ticket.ticket_id}
- Subject: {ticket.subject}
- Description: {ticket.description}
- Customer: {ticket.customer_id}

CLASSIFICATION:
{json.dumps(classification, indent=2)}

ROOT CAUSE:
{json.dumps(root_cause, indent=2)}

INVESTIGATION FINDINGS:
{json.dumps(investigation.get('findings', []), indent=2)}

Respond in this exact JSON format:
{{
  "action": "<specific action to take>",
  "action_type": "<one of: refund, partial_refund, credit, apology, driver_warning, driver_suspension, escalate, no_action, investigate_further>",
  "refund_amount": <amount or null>,
  "refund_currency": "<SGD/MYR/IDR/THB etc. or null>",
  "customer_message": "<professional message to send to customer>",
  "internal_notes": "<notes for internal team>",
  "follow_up_required": <true/false>,
  "follow_up_action": "<what follow-up if any>",
  "driver_action": "<action regarding driver if applicable, else null>",
  "estimated_resolution_time": "<e.g., Immediate, 1-2 hours, 24 hours>"
}}
"""

        try:
            return client.json_response(system_prompt, user_prompt, max_tokens=1200, reasoning_effort="medium")
        except Exception as exc:
            print(f"Resolution error: {exc}")
            return {
                "action": "Escalate to senior agent for manual review",
                "action_type": "escalate",
                "refund_amount": None,
                "refund_currency": None,
                "customer_message": "We're reviewing your concern and will update you shortly.",
                "internal_notes": f"Auto-resolution failed: {exc}",
                "follow_up_required": True,
                "follow_up_action": "Senior agent review",
                "driver_action": None,
                "estimated_resolution_time": "2-4 hours"
            }
