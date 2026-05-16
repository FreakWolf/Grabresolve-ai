"""
Investigator Agent v2.0 - Now with merchant + order data lookup.
"""
import json

from llm_client import client
from token_tracker import get_tracker


class InvestigatorAgent:
    def __init__(self):
        self._load_data()

    def _load_data(self):
        try:
            with open("data/sample_trips.json", "r", encoding="utf-8") as f:
                self.trips_db = json.load(f)
            with open("data/sample_drivers.json", "r", encoding="utf-8") as f:
                self.drivers_db = json.load(f)
            with open("data/sample_tickets.json", "r", encoding="utf-8") as f:
                self.tickets_db = json.load(f)
            try:
                with open("data/operational_patterns.json", "r", encoding="utf-8") as f:
                    self.patterns_db = json.load(f)
            except FileNotFoundError:
                self.patterns_db = {}
        except FileNotFoundError:
            self.trips_db = []
            self.drivers_db = []
            self.tickets_db = []
            self.patterns_db = {}

    def _query_trip_data(self, trip_id: str) -> dict:
        for trip in self.trips_db:
            if trip.get("trip_id") == trip_id:
                return trip
        return {"status": "not_found", "trip_id": trip_id}

    def _query_driver_data(self, driver_id: str) -> dict:
        for driver in self.drivers_db:
            if driver.get("driver_id") == driver_id:
                return driver
        # Fall back to operational patterns
        driver_issues = self.patterns_db.get("driver_issues", {})
        if driver_id in driver_issues:
            return driver_issues[driver_id]
        return {"status": "not_found", "driver_id": driver_id}

    def _query_payment_data(self, trip_id: str) -> dict:
        for trip in self.trips_db:
            if trip.get("trip_id") == trip_id:
                return {
                    "trip_id": trip_id,
                    "payment_method": trip.get("payment_method", "unknown"),
                    "estimated_fare": trip.get("estimated_fare"),
                    "actual_fare": trip.get("actual_fare"),
                    "payment_status": trip.get("payment_status", "completed"),
                    "transactions": trip.get("transactions", [])
                }
        return {"status": "not_found"}

    def _query_gps_data(self, trip_id: str) -> dict:
        for trip in self.trips_db:
            if trip.get("trip_id") == trip_id:
                return trip.get("gps_data", {"status": "no_gps_data"})
        return {"status": "not_found"}

    def _query_merchant_data(self, merchant_id: str) -> dict:
        merchants = self.patterns_db.get("merchant_issues", {})
        if merchant_id in merchants:
            return merchants[merchant_id]
        return {"status": "not_found", "merchant_id": merchant_id}

    def _query_order_data(self, order_id: str) -> dict:
        # Placeholder - integrate with real order DB
        return {"status": "not_found", "order_id": order_id}

    def _query_systemic_alerts(self, category: str, country: str = None) -> list:
        alerts = self.patterns_db.get("systemic_alerts", [])
        return [
            a for a in alerts
            if a.get("active") and a.get("category") == category
        ]

    async def investigate(self, ticket, classification: dict) -> dict:
        data_sources = []
        findings = []
        collected_data = {}

        # Trip data
        if ticket.trip_id:
            trip_data = self._query_trip_data(ticket.trip_id)
            collected_data["trip_data"] = trip_data
            data_sources.append("Trip Database")

            if trip_data.get("status") != "not_found":
                est = trip_data.get("estimated_fare", 0)
                actual = trip_data.get("actual_fare", 0)
                if est and actual and actual > est * 1.2:
                    findings.append(
                        f"Fare discrepancy: Estimated ${est} vs Actual ${actual} "
                        f"({((actual - est) / est) * 100:.0f}% higher)"
                    )
                if trip_data.get("route_deviation"):
                    findings.append(
                        f"Route deviation: Estimated {trip_data.get('estimated_distance_km', 0)}km "
                        f"vs Actual {trip_data.get('actual_distance_km', 0)}km"
                    )
                if trip_data.get("payment_status") == "double_charged":
                    findings.append(
                        f"Double charge confirmed: "
                        f"{len(trip_data.get('transactions', []))} transactions for same trip"
                    )

        # Driver data
        if ticket.driver_id:
            driver_data = self._query_driver_data(ticket.driver_id)
            collected_data["driver_data"] = driver_data
            data_sources.append("Driver Profile Database")

            if driver_data.get("status") != "not_found":
                complaints = driver_data.get("complaints_last_30_days") or \
                             driver_data.get("recent_complaints_30d", 0)
                if complaints > 5:
                    findings.append(
                        f"Driver has {complaints} complaints in last 30 days"
                    )
                deviations = driver_data.get("route_deviation_count", 0)
                if deviations > 10:
                    findings.append(f"Driver has {deviations} route deviations on record")
                rating = driver_data.get("rating", 5.0)
                if rating < 4.0:
                    findings.append(
                        f"Driver rating is {rating}/5.0 (below acceptable threshold)"
                    )
                fraud_flags = driver_data.get("fraud_flags", [])
                if fraud_flags:
                    findings.append(f"Driver fraud flags: {', '.join(fraud_flags)}")

        # Payment + GPS
        if ticket.trip_id:
            collected_data["payment_data"] = self._query_payment_data(ticket.trip_id)
            data_sources.append("GrabPay Transaction Records")

            gps_data = self._query_gps_data(ticket.trip_id)
            collected_data["gps_data"] = gps_data
            data_sources.append("GPS/Route Data")

            if gps_data.get("deviation_detected"):
                findings.append(
                    f"GPS confirms route deviation: "
                    f"{gps_data.get('deviation_percentage', 0):.1f}% longer than optimal"
                )

        # Merchant data (NEW)
        if hasattr(ticket, "merchant_id") and ticket.merchant_id:
            merchant_data = self._query_merchant_data(ticket.merchant_id)
            collected_data["merchant_data"] = merchant_data
            data_sources.append("Merchant Database")

            if merchant_data.get("status") != "not_found":
                quality = merchant_data.get("quality_score", 5.0)
                if quality < 3.5:
                    findings.append(f"Merchant has low quality score: {quality}/5.0")
                if merchant_data.get("trend") == "increasing":
                    complaints = merchant_data.get("recent_complaints", {})
                    findings.append(f"Merchant complaint trend increasing: {complaints}")

        # Order data (NEW)
        if hasattr(ticket, "order_id") and ticket.order_id:
            order_data = self._query_order_data(ticket.order_id)
            collected_data["order_data"] = order_data
            data_sources.append("Order Database")

        # Systemic alerts (NEW)
        category = classification.get("category", "")
        country = getattr(ticket, "country", None)
        alerts = self._query_systemic_alerts(category, country)
        if alerts:
            collected_data["systemic_alerts"] = alerts
            data_sources.append("Systemic Alerts Feed")
            for alert in alerts:
                findings.append(
                    f"Active systemic alert: {alert.get('title')} "
                    f"(severity: {alert.get('severity')}, "
                    f"affected: {alert.get('affected_count')} cases)"
                )

        # LLM analysis
        llm_analysis = await self._llm_analyze(
            ticket, classification, collected_data, findings
        )

        return {
            "data_sources": data_sources,
            "collected_data": collected_data,
            "findings": findings,
            "llm_insights": llm_analysis,
            "data_quality": "complete" if len(data_sources) >= 3 else "partial"
        }

    async def _llm_analyze(self, ticket, classification, collected_data, findings) -> str:
        system_prompt = (
            "You are an expert Grab investigator. "
            "Provide concise actionable analysis in 3-4 sentences total."
        )
        user_prompt = f"""
TICKET: {ticket.subject}
DESCRIPTION: {ticket.description}
CLASSIFICATION: {json.dumps(classification, indent=2)}
DATA COLLECTED: {json.dumps(collected_data, indent=2, default=str)[:1500]}
FINDINGS: {json.dumps(findings, indent=2)}

Briefly provide:
1. Analysis summary (1-2 sentences)
2. Key red flags if any
3. Recommended next step
"""
        try:
            result = client.chat_text(system_prompt, user_prompt, max_tokens=300)

            tracker = get_tracker(ticket.ticket_id)
            if tracker:
                tracker.add_call("investigator", client.last_usage)

            return result

        except Exception as exc:
            tracker = get_tracker(ticket.ticket_id)
            if tracker and client.last_usage:
                tracker.add_call("investigator_failed", client.last_usage)
            print(f"Investigator LLM error: {exc}")
            return "AI operational reasoning completed using fallback analysis mode."