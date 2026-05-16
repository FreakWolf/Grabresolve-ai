"""
Prediction Agent - Predicts SLA breaches and systemic issues.
"""


class PredictionAgent:
    async def predict_sla_breach(self, ticket) -> dict:
        risk_score = 0.3
        factors = []

        category = (ticket.category or "").lower()
        subject = (ticket.subject or "").lower()
        description = (ticket.description or "").lower()
        priority = (getattr(ticket, "priority", None) or "").lower()
        channel = (ticket.channel or "").lower()

        if category in ["payment_issue", "payment", "refund_delay"] or "double charge" in description:
            risk_score += 0.25
            factors.append("Payment/refund issue can breach SLA quickly")

        if priority in ["critical", "high"]:
            risk_score += 0.2
            factors.append(f"Priority is {priority}")

        if any(word in f"{subject} {description}" for word in ["angry", "urgent", "immediately", "5 days", "overdue"]):
            risk_score += 0.15
            factors.append("Customer language suggests escalation risk")

        if channel == "app":
            risk_score += 0.05
            factors.append("In-app tickets are expected to move quickly")

        if not ticket.trip_id and category in ["fare_dispute", "ride", "payment"]:
            risk_score += 0.1
            factors.append("Missing trip data can slow investigation")

        risk_score = min(risk_score, 1.0)

        if risk_score > 0.7:
            risk_level = "high"
            recommendation = "Prioritize immediately - high SLA breach risk"
        elif risk_score > 0.4:
            risk_level = "medium"
            recommendation = "Monitor closely - moderate SLA breach risk"
        else:
            risk_level = "low"
            recommendation = "On track - low SLA breach risk"

        return {
            "ticket_id": ticket.ticket_id,
            "sla_breach_probability": risk_score,
            "sla_breach_risk": risk_score,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "recommended_action": recommendation,
            "predicted_resolution_time_min": int(risk_score * 60),
            "factors": factors or [
                f"Category: {ticket.category or 'unknown'}",
                f"Channel: {ticket.channel}",
                f"Country: {ticket.country}"
            ]
        }
