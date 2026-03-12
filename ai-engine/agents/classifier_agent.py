"""
Classifier Agent — Uses LLM to classify incoming tickets
"""

import google.genai as genai
import json
from config import GEMINI_API_KEY, LLM_MODEL

client = genai.Client()


class ClassifierAgent:
    def __init__(self):
        pass

    async def classify(self, ticket) -> dict:
        prompt = f"""
You are a support ticket classifier for Grab, Southeast Asia's leading 
super app (ride-hailing, food delivery, payments).

Analyze the following support ticket and classify it.

TICKET:
- ID: {ticket.ticket_id}
- Subject: {ticket.subject}
- Description: {ticket.description}
- Channel: {ticket.channel}
- Country: {ticket.country}

Respond in this exact JSON format:
{{
    "category": "<one of: fare_dispute, payment_issue, missing_item, 
                  driver_behavior, cancellation_fee, delivery_issue, 
                  account_issue, refund_delay, other>",
    "subcategory": "<specific subcategory>",
    "urgency": "<one of: critical, high, medium, low>",
    "sentiment": "<one of: angry, frustrated, neutral, concerned>",
    "estimated_complexity": "<one of: simple, moderate, complex>",
    "summary": "<one-line summary of the issue>",
    "affected_service": "<one of: GrabCar, GrabFood, GrabPay, 
                          GrabExpress, GXS, other>"
}}

IMPORTANT: Respond ONLY with the JSON. No additional text.
"""

        try:
            response = client.models.generate_content(model=LLM_MODEL, contents=prompt)
            result_text = response.text.strip()

            # Clean the response (remove markdown if present)
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]

            return json.loads(result_text)

        except Exception as e:
            print(f"Classification error: {e}")
            return {
                "category": ticket.category or "unknown",
                "subcategory": "needs_review",
                "urgency": "medium",
                "sentiment": "neutral",
                "estimated_complexity": "moderate",
                "summary": ticket.subject,
                "affected_service": "unknown"
            }