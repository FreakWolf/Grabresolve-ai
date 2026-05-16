"""
Classifier Agent - Uses Amazon Nova to classify incoming tickets.
"""
from llm_client import client
from token_tracker import get_tracker


class ClassifierAgent:
    async def classify(self, ticket) -> dict:
        system_prompt = (
            "You are a support ticket classifier for Grab. "
            "Return strict JSON only - no markdown, no explanations."
        )
        user_prompt = f"""
Analyze this support ticket and classify it.

TICKET:
- ID: {ticket.ticket_id}
- Subject: {ticket.subject}
- Description: {ticket.description}
- Channel: {ticket.channel}
- Country: {ticket.country}

Respond in this exact JSON format:
{{
  "category": "<one of: fare_dispute, payment_issue, missing_item, driver_behavior, cancellation_fee, delivery_issue, account_issue, refund_delay, other>",
  "subcategory": "<specific subcategory>",
  "urgency": "<one of: critical, high, medium, low>",
  "sentiment": "<one of: angry, frustrated, neutral, concerned>",
  "estimated_complexity": "<one of: simple, moderate, complex>",
  "summary": "<one-line summary of the issue>",
  "affected_service": "<one of: GrabCar, GrabFood, GrabPay, GrabExpress, GXS, other>"
}}
"""

        try:
            # ⬇️ CHANGED: max_tokens 800 → 400, no reasoning_effort
            result = client.json_response(
                system_prompt, user_prompt,
                max_tokens=400
            )

            # Track token usage on success
            tracker = get_tracker(ticket.ticket_id)
            if tracker:
                tracker.add_call("classifier", client.last_usage)

            return result

        except Exception as exc:
            # ⬇️ ADDED: Track tokens even on failure
            tracker = get_tracker(ticket.ticket_id)
            if tracker and client.last_usage:
                tracker.add_call("classifier_failed", client.last_usage)

            print(f"Classification error: {exc}")
            return {
                "category": ticket.category or "other",
                "subcategory": "needs_review",
                "urgency": "medium",
                "sentiment": "neutral",
                "estimated_complexity": "moderate",
                "summary": ticket.subject,
                "affected_service": "other"
            }