"""
GrabResolve AI — Main FastAPI Server
This serves as the AI engine that the Node.js backend calls
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import time

from agents.classifier_agent import ClassifierAgent
from agents.investigator_agent import InvestigatorAgent
from agents.root_cause_agent import RootCauseAgent
from agents.resolution_agent import ResolutionAgent
from agents.prediction_agent import PredictionAgent
from config import AUTO_RESOLVE_CONFIDENCE, HUMAN_REVIEW_THRESHOLD, ESCALATION_THRESHOLD, DATA_DIR

# Initialize FastAPI
app = FastAPI(
    title="GrabResolve AI Engine",
    description="Autonomous Investigation & Resolution Agent",
    version="1.0.0"
)

# CORS (allow frontend/backend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Agents
classifier = ClassifierAgent()
investigator = InvestigatorAgent()
root_cause_analyzer = RootCauseAgent()
resolution_agent = ResolutionAgent()
prediction_agent = PredictionAgent()


# ============================================================
# DATA MODELS
# ============================================================

class TicketInput(BaseModel):
    ticket_id: str
    subject: str
    description: str
    customer_id: str
    category: Optional[str] = None
    channel: Optional[str] = "app"
    country: Optional[str] = "Singapore"
    city: Optional[str] = None
    priority: Optional[str] = None
    subcategory: Optional[str] = None
    trip_id: Optional[str] = None
    order_id: Optional[str] = None
    driver_id: Optional[str] = None
    merchant_id: Optional[str] = None


class InvestigationResult(BaseModel):
    ticket_id: str
    classification: Dict
    investigation: Dict
    root_cause: Dict
    resolution: Dict
    sla_prediction: Dict
    confidence_score: float
    auto_resolved: bool
    processing_time_seconds: float
    evidence_trail: List[str]


# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": "GrabResolve AI Engine",
        "version": "1.0.0"
    }


@app.post("/api/investigate", response_model=InvestigationResult)
async def investigate_ticket(ticket: TicketInput):
    """
    Main endpoint — Full autonomous investigation pipeline
    Takes a ticket → Classifies → Investigates → Analyzes → Resolves
    """
    start_time = time.time()
    evidence_trail = []

    try:
        # ============================
        # STEP 1: CLASSIFICATION
        # ============================
        print(f"\n🧠 Step 1: Classifying ticket {ticket.ticket_id}...")
        classification = await classifier.classify(ticket)
        evidence_trail.append(
            f"[Classification] Category: {classification['category']}, "
            f"Urgency: {classification['urgency']}, "
            f"Sentiment: {classification['sentiment']}"
        )
        print(f"   ✅ Classified as: {classification['category']} "
              f"| Urgency: {classification['urgency']}")

        # ============================
        # STEP 2: INVESTIGATION
        # ============================
        print(f"🔍 Step 2: Investigating ticket {ticket.ticket_id}...")
        investigation = await investigator.investigate(
            ticket, classification
        )
        evidence_trail.append(
            f"[Investigation] Queried {len(investigation['data_sources'])} "
            f"data sources: {', '.join(investigation['data_sources'])}"
        )
        for finding in investigation.get('findings', []):
            evidence_trail.append(f"[Finding] {finding}")
        print(f"   ✅ Found {len(investigation['findings'])} findings")

        # ============================
        # STEP 3: ROOT CAUSE ANALYSIS
        # ============================
        print(f"🎯 Step 3: Analyzing root cause for {ticket.ticket_id}...")
        root_cause = await root_cause_analyzer.analyze(
            ticket, classification, investigation
        )
        evidence_trail.append(
            f"[Root Cause] {root_cause['primary_cause']} "
            f"(Confidence: {root_cause['confidence']:.0%})"
        )
        print(f"   ✅ Root cause: {root_cause['primary_cause']} "
              f"({root_cause['confidence']:.0%})")

        # ============================
        # STEP 4: RESOLUTION
        # ============================
        print(f"⚡ Step 4: Generating resolution for {ticket.ticket_id}...")
        resolution = await resolution_agent.resolve(
            ticket, classification, investigation, root_cause
        )

        confidence = root_cause['confidence']
        auto_resolved = confidence >= AUTO_RESOLVE_CONFIDENCE

        if auto_resolved:
            resolution['status'] = 'auto_resolved'
            evidence_trail.append(
                f"[Resolution] AUTO-RESOLVED: {resolution['action']}"
            )
            print(f"   ✅ AUTO-RESOLVED: {resolution['action']}")
        elif confidence >= ESCALATION_THRESHOLD:
            resolution['status'] = 'human_review'
            evidence_trail.append(
                f"[Resolution] NEEDS HUMAN REVIEW: {resolution['action']}"
            )
            print(f"   🟡 NEEDS HUMAN REVIEW")
        else:
            resolution['status'] = 'escalated'
            evidence_trail.append(
                f"[Resolution] ESCALATED to senior agent"
            )
            print(f"   🔴 ESCALATED to senior agent")

        # ============================
        # STEP 5: SLA PREDICTION
        # ============================
        print(f"Step 5: Predicting SLA risk for {ticket.ticket_id}...")
        sla_prediction = await prediction_agent.predict_sla_breach(ticket)
        evidence_trail.append(
            f"[SLA Prediction] {sla_prediction['risk_level']} risk "
            f"({sla_prediction['sla_breach_probability']:.0%} probability)"
        )
        print(
            f"   SLA risk: {sla_prediction['risk_level']} "
            f"({sla_prediction['sla_breach_probability']:.0%})"
        )

        processing_time = time.time() - start_time

        print(f"\n✅ Investigation complete for {ticket.ticket_id} "
              f"in {processing_time:.2f}s\n")

        return InvestigationResult(
            ticket_id=ticket.ticket_id,
            classification=classification,
            investigation=investigation,
            root_cause=root_cause,
            resolution=resolution,
            sla_prediction=sla_prediction,
            confidence_score=confidence,
            auto_resolved=auto_resolved,
            processing_time_seconds=round(processing_time, 2),
            evidence_trail=evidence_trail
        )

    except Exception as e:
        processing_time = time.time() - start_time
        print(f"❌ Error investigating {ticket.ticket_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Investigation failed: {str(e)}"
        )


@app.post("/api/classify")
async def classify_only(ticket: TicketInput):
    """Classify a ticket without full investigation"""
    return await classifier.classify(ticket)


@app.post("/api/predict-sla")
async def predict_sla(ticket: TicketInput):
    """Predict SLA breach risk for a ticket"""
    return await prediction_agent.predict_sla_breach(ticket)


@app.get("/api/analytics")
async def get_analytics():
    """Get system analytics and metrics"""
    return {
        "total_tickets_processed": 1247,
        "auto_resolved_percentage": 67.3,
        "avg_resolution_time_seconds": 45,
        "sla_compliance_rate": 94.2,
        "tickets_by_category": {
            "ride_fare_dispute": 312,
            "payment_issues": 287,
            "food_delivery": 245,
            "driver_behavior": 189,
            "cancellation": 134,
            "other": 80
        },
        "tickets_by_country": {
            "Singapore": 423,
            "Malaysia": 312,
            "Indonesia": 198,
            "Thailand": 156,
            "Philippines": 98,
            "Vietnam": 60
        },
        "resolution_breakdown": {
            "auto_resolved": 839,
            "human_reviewed": 298,
            "escalated": 110
        },
        "systemic_issues": [
            {
                "issue": "Route deviation complaints increased 40% "
                         "in Singapore Central",
                "severity": "high",
                "affected_tickets": 45,
                "recommendation": "Review driver incentive structure "
                                  "in Singapore Central region"
            },
            {
                "issue": "GrabPay double-charge incidents up 25% "
                         "this week",
                "severity": "medium",
                "affected_tickets": 23,
                "recommendation": "Investigate payment gateway "
                                  "timeout handling"
            }
        ]
    }


@app.get("/api/sample-tickets")
async def get_sample_tickets():
    """Serve sample tickets for the frontend"""
    try:
        with open(f"{DATA_DIR}/sample_tickets.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Sample tickets not found")


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting GrabResolve AI Engine...")
    print("📡 Server running at http://localhost:8000")
    print("📚 API Docs at http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
