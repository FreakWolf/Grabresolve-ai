"""
Investigator Agent — Autonomously queries multiple data sources
"""

import json
import google.genai as genai
from config import GEMINI_API_KEY, LLM_MODEL

client = genai.Client()


class InvestigatorAgent:
    def __init__(self):
        self._load_data()

    def _load_data(self):
        """Load sample data to simulate Grab's internal databases"""
        try:
            with open("data/sample_trips.json", "r") as f:
                self.trips_db = json.load(f)
            with open("data/sample_drivers.json", "r") as f:
                self.drivers_db = json.load(f)
            with open("data/sample_tickets.json", "r") as f:
                self.tickets_db = json.load(f)
        except FileNotFoundError:
            self.trips_db = []
            self.drivers_db = []
            self.tickets_db = []

    def _query_trip_data(self, trip_id: str) -> dict:
        """Simulate querying Grab's trip database"""
        for trip in self.trips_db:
            if trip.get("trip_id") == trip_id:
                return trip
        return {"status": "not_found", "trip_id": trip_id}

    def _query_driver_data(self, driver_id: str) -> dict:
        """Simulate querying Grab's driver database"""
        for driver in self.drivers_db:
            if driver.get("driver_id") == driver_id:
                return driver
        return {"status": "not_found", "driver_id": driver_id}

    def _query_payment_data(self, trip_id: str) -> dict:
        """Simulate querying GrabPay transaction records"""
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
        """Simulate querying GPS/route data"""
        for trip in self.trips_db:
            if trip.get("trip_id") == trip_id:
                return trip.get("gps_data", {"status": "no_gps_data"})
        return {"status": "not_found"}

    async def investigate(self, ticket, classification: dict) -> dict:
        """
        Main investigation method — queries relevant data sources
        based on ticket type
        """
        data_sources = []
        findings = []
        collected_data = {}

        # Query trip data if trip_id exists
        if ticket.trip_id:
            trip_data = self._query_trip_data(ticket.trip_id)
            collected_data["trip_data"] = trip_data
            data_sources.append("Trip Database")

            if trip_data.get("status") != "not_found":
                # Check for fare discrepancy
                est = trip_data.get("estimated_fare", 0)
                actual = trip_data.get("actual_fare", 0)
                if est and actual and actual > est * 1.2:
                    findings.append(
                        f"Fare discrepancy detected: Estimated "
                        f"${est} vs Actual ${actual} "
                        f"({((actual-est)/est)*100:.0f}% higher)"
                    )

                # Check for route deviation
                if trip_data.get("route_deviation"):
                    est_km = trip_data.get("estimated_distance_km", 0)
                    actual_km = trip_data.get("actual_distance_km", 0)
                    findings.append(
                        f"Route deviation detected: Estimated "
                        f"{est_km}km vs Actual {actual_km}km"
                    )

                # Check for double charge
                if trip_data.get("payment_status") == "double_charged":
                    txns = trip_data.get("transactions", [])
                    findings.append(
                        f"Double charge confirmed: "
                        f"{len(txns)} transactions found for same trip"
                    )

        # Query driver data if driver_id exists
        if ticket.driver_id:
            driver_data = self._query_driver_data(ticket.driver_id)
            collected_data["driver_data"] = driver_data
            data_sources.append("Driver Profile Database")

            if driver_data.get("status") != "not_found":
                complaints = driver_data.get(
                    "complaints_last_30_days", 0
                )
                if complaints > 5:
                    findings.append(
                        f"Driver has {complaints} complaints "
                        f"in last 30 days (above threshold)"
                    )

                deviations = driver_data.get("route_deviation_count", 0)
                if deviations > 10:
                    findings.append(
                        f"Driver has {deviations} route deviations "
                        f"on record (pattern detected)"
                    )

                rating = driver_data.get("rating", 5.0)
                if rating < 4.0:
                    findings.append(
                        f"Driver rating is {rating}/5.0 "
                        f"(below acceptable threshold)"
                    )

        # Query payment data
        if ticket.trip_id:
            payment_data = self._query_payment_data(ticket.trip_id)
            collected_data["payment_data"] = payment_data
            data_sources.append("GrabPay Transaction Records")

        # Query GPS data
        if ticket.trip_id:
            gps_data = self._query_gps_data(ticket.trip_id)
            collected_data["gps_data"] = gps_data
            data_sources.append("GPS/Route Data")

            if gps_data.get("deviation_detected"):
                dev_pct = gps_data.get("deviation_percentage", 0)
                findings.append(
                    f"GPS confirms route deviation: "
                    f"{dev_pct:.1f}% longer than optimal route"
                )

        # Use LLM to generate additional insights
        llm_analysis = await self._llm_analyze(
            ticket, classification, collected_data, findings
        )

        return {
            "data_sources": data_sources,
            "collected_data": collected_data,
            "findings": findings,
            "llm_insights": llm_analysis,
            "data_quality": "complete" if len(data_sources) >= 3 
                           else "partial"
        }

    async def _llm_analyze(self, ticket, classification,
                            collected_data, findings) -> str:
        """Use LLM to provide additional investigation insights"""
        prompt = f"""
You are an expert investigator at Grab analyzing a support ticket.

TICKET: {ticket.subject}
DESCRIPTION: {ticket.description}
CLASSIFICATION: {json.dumps(classification, indent=2)}
DATA COLLECTED: {json.dumps(collected_data, indent=2, default=str)}
FINDINGS SO FAR: {json.dumps(findings)}

Based on all the data above, provide:
1. A brief analysis summary (2-3 sentences)
2. Any additional patterns or red flags you notice
3. Recommended next steps

Keep it concise and actionable.
"""
        try:
            response = client.models.generate_content(model=LLM_MODEL, contents=prompt)
            return response.text.strip()
        except Exception as e:
            return f"LLM analysis unavailable: {str(e)}"