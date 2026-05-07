"""
Prediction Agent - Predicts SLA breaches and systemic issues.
"""


class PredictionAgent:
    async def predict_sla_breach(self, ticket) -> dict:
        risk_score = 0.3

        if hasattr(ticket, "priority"):
            if ticket.category in ["payment_issue", "double_charge"]:
                risk_score += 0.3
            if ticket.channel == "app":
                risk_score += 0.1

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
            "sla_breach_risk": risk_score,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "predicted_resolution_time_min": int(risk_score * 60),
            "factors": [
                f"Category: {ticket.category or 'unknown'}",
                f"Channel: {ticket.channel}",
                f"Country: {ticket.country}"
            ]
        }
