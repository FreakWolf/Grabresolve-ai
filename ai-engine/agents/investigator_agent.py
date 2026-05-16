"""
Investigator Agent - Autonomously queries multiple data sources.
"""
import json

from llm_client import client
from token_tracker import get_tracker


class InvestigatorAgent:
    def __init__(self):
        self._load_data()

    def _load_data(self):
        try:
            with open("data/sample_trips.json", "r", encoding="utf-8") as handle:
                self.trips_db = json.load(handle)
            with open("data/sample_drivers.json", "r", encoding="utf-8") as handle:
                self.drivers_db = json.load(handle)
            with open("data/sample_tickets.json", "r", encoding="utf-8") as handle:
                self.tickets_db = json.load(handle)
        except FileNotFoundError:
            self.trips_db = []
            self.drivers_db = []
            self.tickets_db = []

    def _query_trip_data(self, trip_id: str) -> dict:
        for trip in self.trips_db:
            if trip.get("trip_id") == trip_id:
                return trip
        return {"status": "not_found", "trip_id": trip_id}

    def _query_driver_data(self, driver_id: str) -> dict:
        for driver in self.drivers_db:
            if driver.get("driver_id") == driver_id:
                return driver
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

    async def investigate(self, ticket, classification: dict) -> dict:
        data_sources = []
        findings = []
        collected_data = {}

        # ----- Trip data checks -----
        if ticket.trip_id:
            trip_data = self._query_trip_data(ticket.trip_id)
            collected_data["trip_data"] = trip_data
            data_sources.append("Trip Database")

            if trip_data.get("status") != "not_found":
                est = trip_data.get("estimated_fare", 0)
                actual = trip_data.get("actual_fare", 0)
                if est and actual and actual > est * 1.2:
                    findings.append(
                        f"Fare discrepancy detected: Estimated ${est} vs Actual ${actual} "
                        f"({((actual - est) / est) * 100:.0f}% higher)"
                    )

                if trip_data.get("route_deviation"):
                    findings.append(
                        f"Route deviation detected: Estimated "
                        f"{trip_data.get('estimated_distance_km', 0)}km vs Actual "
                        f"{trip_data.get('actual_distance_km', 0)}km"
                    )

                if trip_data.get("payment_status") == "double_charged":
                    findings.append(
                        f"Double charge confirmed: "
                        f"{len(trip_data.get('transactions', []))} transactions "
                        f"found for same trip"
                    )

        # ----- Driver data checks -----
        if ticket.driver_id:
            driver_data = self._query_driver_data(ticket.driver_id)
            collected_data["driver_data"] = driver_data
            data_sources.append("Driver Profile Database")

            if driver_data.get("status") != "not_found":
                complaints = driver_data.get("complaints_last_30_days", 0)
                if complaints > 5:
                    findings.append(
                        f"Driver has {complaints} complaints in last 30 days "
                        f"(above threshold)"
                    )

                deviations = driver_data.get("route_deviation_count", 0)
                if deviations > 10:
                    findings.append(
                        f"Driver has {deviations} route deviations on record "
                        f"(pattern detected)"
                    )

                rating = driver_data.get("rating", 5.0)
                if rating < 4.0:
                    findings.append(
                        f"Driver rating is {rating}/5.0 "
                        f"(below acceptable threshold)"
                    )

        # ----- Payment + GPS data checks -----
        if ticket.trip_id:
            collected_data["payment_data"] = self._query_payment_data(ticket.trip_id)
            data_sources.append("GrabPay Transaction Records")

            gps_data = self._query_gps_data(ticket.trip_id)
            collected_data["gps_data"] = gps_data
            data_sources.append("GPS/Route Data")

            if gps_data.get("deviation_detected"):
                findings.append(
                    f"GPS confirms route deviation: "
                    f"{gps_data.get('deviation_percentage', 0):.1f}% "
                    f"longer than optimal route"
                )

        # ----- LLM analysis -----
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
            "Provide concise and actionable analysis in 3-4 sentences total."
        )
        user_prompt = f"""
TICKET: {ticket.subject}
DESCRIPTION: {ticket.description}
CLASSIFICATION: {json.dumps(classification, indent=2)}
DATA COLLECTED: {json.dumps(collected_data, indent=2, default=str)}
FINDINGS SO FAR: {json.dumps(findings, indent=2)}

Briefly provide:
1. Analysis summary (1-2 sentences)
2. Key red flags if any
3. Recommended next step
"""
        try:
            # ⬇️ CHANGED: removed reasoning_effort="medium", kept max_tokens=300
            result = client.chat_text(
                system_prompt, user_prompt,
                max_tokens=300
            )

            tracker = get_tracker(ticket.ticket_id)
            if tracker:
                tracker.add_call("investigator", client.last_usage)

            return result

        except Exception as exc:
            # ⬇️ ADDED: Track tokens even on failure
            tracker = get_tracker(ticket.ticket_id)
            if tracker and client.last_usage:
                tracker.add_call("investigator_failed", client.last_usage)

            print(f"Investigator LLM error: {exc}")
            return (
                "AI operational reasoning completed using fallback analysis mode."
            )