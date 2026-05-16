"""
Fraud Detection Agent - Detects suspicious patterns and assigns fraud score.
Combines rule-based checks with LLM-powered pattern analysis.
"""
import json
from datetime import datetime, timedelta
from llm_client import client
from token_tracker import get_tracker


class FraudAgent:
    def __init__(self):
        self._load_history()

    def _load_history(self):
        """Load customer history database."""
        try:
            with open("data/customer_history.json", "r", encoding="utf-8") as f:
                self.history_db = json.load(f)
        except FileNotFoundError:
            self.history_db = {}

    def get_customer_history(self, customer_id: str) -> dict:
        """Retrieve historical data for a customer."""
        return self.history_db.get(customer_id, {
            "customer_id": customer_id,
            "account_age_days": 365,
            "total_tickets": 0,
            "tickets_last_24h": 0,
            "tickets_last_7days": 0,
            "tickets_last_30days": 0,
            "complaints_last_30_days": 0,
            "refunds_last_30_days": 0,
            "total_refund_amount_30days": 0,
            "last_refund_at": None,
            "previous_categories": [],
            "flagged_previously": False,
            "trust_score": 0.85
        })

    async def assess(self, ticket, classification: dict, investigation: dict) -> dict:
        """Main fraud assessment - returns fraud score + risk factors."""
        history = self.get_customer_history(ticket.customer_id)

        # Run rule-based checks
        risk_factors = []
        rule_score = 0.0

        # Check 1: New account + immediate refund request
        if history["account_age_days"] < 7:
            if classification.get("category") in ["refund_delay", "payment_issue", "fare_dispute"]:
                rule_score += 0.25
                risk_factors.append({
                    "factor": "new_account_refund_request",
                    "weight": 0.25,
                    "detail": f"Account is only {history['account_age_days']} days old"
                })

        # Check 2: High velocity
        if history["tickets_last_24h"] >= 5:
            rule_score += 0.30
            risk_factors.append({
                "factor": "high_ticket_velocity",
                "weight": 0.30,
                "detail": f"{history['tickets_last_24h']} tickets in 24h"
            })

        # Check 3: Repeat complaint pattern
        if history["complaints_last_30_days"] > 8:
            rule_score += 0.20
            risk_factors.append({
                "factor": "excessive_complaints",
                "weight": 0.20,
                "detail": f"{history['complaints_last_30_days']} complaints in 30 days"
            })

        # Check 4: Refund frequency
        if history["refunds_last_30_days"] >= 3:
            rule_score += 0.15
            risk_factors.append({
                "factor": "frequent_refunds",
                "weight": 0.15,
                "detail": f"{history['refunds_last_30_days']} refunds in last 30 days"
            })

        # Check 5: Same-category repeat
        category = classification.get("category", "")
        previous_same_category = sum(
            1 for c in history.get("previous_categories", [])
            if c == category
        )
        if previous_same_category >= 3:
            rule_score += 0.20
            risk_factors.append({
                "factor": "repeat_same_category",
                "weight": 0.20,
                "detail": f"{previous_same_category} prior tickets of same type"
            })

        # Check 6: Previously flagged
        if history.get("flagged_previously"):
            rule_score += 0.15
            risk_factors.append({
                "factor": "previously_flagged",
                "weight": 0.15,
                "detail": "Customer was flagged in previous incidents"
            })

        # Check 7: Sentiment manipulation (extreme angry + high refund)
        sentiment = classification.get("sentiment", "")
        if sentiment == "angry" and category in ["refund_delay", "fare_dispute"]:
            rule_score += 0.05
            risk_factors.append({
                "factor": "sentiment_pattern",
                "weight": 0.05,
                "detail": "Extreme sentiment + refund-related category"
            })

        # Check 8: Investigation findings - missing data is suspicious
        findings = investigation.get("findings", [])
        if len(findings) == 0 and ticket.trip_id:
            rule_score += 0.10
            risk_factors.append({
                "factor": "no_supporting_evidence",
                "weight": 0.10,
                "detail": "Customer claims dispute but no evidence found in systems"
            })

        # Cap rule-based score
        rule_score = min(rule_score, 1.0)

        # LLM-powered pattern analysis (only if rule score suggests review needed)
        llm_assessment = None
        if rule_score > 0.30:
            llm_assessment = await self._llm_pattern_analysis(
                ticket, classification, history, risk_factors
            )

        # Combine scores
        if llm_assessment:
            llm_score = llm_assessment.get("fraud_likelihood", 0.0)
            # Weighted: 70% rules, 30% LLM
            final_score = (rule_score * 0.7) + (llm_score * 0.3)
        else:
            final_score = rule_score

        final_score = round(min(final_score, 1.0), 3)

        # Determine risk level
        if final_score >= 0.80:
            risk_level = "critical"
        elif final_score >= 0.60:
            risk_level = "high"
        elif final_score >= 0.40:
            risk_level = "medium"
        elif final_score >= 0.20:
            risk_level = "low"
        else:
            risk_level = "minimal"

        return {
            "fraud_score": final_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "factor_count": len(risk_factors),
            "customer_history": history,
            "llm_assessment": llm_assessment,
            "recommendation": self._get_recommendation(final_score, risk_factors)
        }

    async def _llm_pattern_analysis(self, ticket, classification, history, risk_factors):
        """Use LLM for nuanced pattern detection."""
        system_prompt = (
            "You are a fraud detection specialist. "
            "Analyze patterns and return strict JSON only."
        )
        user_prompt = f"""
Analyze this ticket for fraud indicators.

TICKET:
- Subject: {ticket.subject}
- Description: {ticket.description}
- Category: {classification.get('category')}
- Sentiment: {classification.get('sentiment')}

CUSTOMER HISTORY:
{json.dumps(history, indent=2)}

RULE-BASED RISK FACTORS DETECTED:
{json.dumps(risk_factors, indent=2)}

Respond in this exact JSON format:
{{
  "fraud_likelihood": <float 0.0-1.0>,
  "suspicious_patterns": ["<list of patterns>"],
  "behavioral_red_flags": ["<list of red flags>"],
  "recommendation": "<one of: approve, review, escalate, block>",
  "reasoning": "<one sentence explanation>"
}}
"""
        try:
            result = client.json_response(
                system_prompt, user_prompt,
                max_tokens=400
            )

            tracker = get_tracker(ticket.ticket_id)
            if tracker:
                tracker.add_call("fraud_agent", client.last_usage)

            return result
        except Exception as exc:
            tracker = get_tracker(ticket.ticket_id)
            if tracker and client.last_usage:
                tracker.add_call("fraud_agent_failed", client.last_usage)

            print(f"Fraud LLM analysis error: {exc}")
            return None

    def _get_recommendation(self, score: float, factors: list) -> str:
        """Generate human-readable recommendation."""
        if score >= 0.80:
            return "BLOCK auto-resolution. Immediate fraud team review required."
        elif score >= 0.60:
            return "ESCALATE to fraud team. Multiple risk indicators present."
        elif score >= 0.40:
            return "REVIEW manually. Some suspicious patterns detected."
        elif score >= 0.20:
            return "MONITOR. Low-risk indicators present, proceed with caution."
        else:
            return "APPROVE. No significant fraud indicators."