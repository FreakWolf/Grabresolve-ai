"""
GrabResolve AI — Main FastAPI Server v2.1
STRICT MODE: Policy enforcement is mandatory, not advisory.
"""

import asyncio
import json
import time
from typing import Optional, List, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.classifier_agent import ClassifierAgent
from agents.investigator_agent import InvestigatorAgent
from agents.root_cause_agent import RootCauseAgent
from agents.resolution_agent import ResolutionAgent
from agents.prediction_agent import PredictionAgent
from agents.fraud_agent import FraudAgent
from policy_engine import policy_engine, PolicyDecision
from config import AUTO_RESOLVE_CONFIDENCE, HUMAN_REVIEW_THRESHOLD, ESCALATION_THRESHOLD
from token_tracker import start_tracking, finish_tracking

app = FastAPI(
    title="GrabResolve AI Engine",
    description="STRICT Governed Investigation & Resolution",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = ClassifierAgent()
investigator = InvestigatorAgent()
root_cause_analyzer = RootCauseAgent()
resolution_agent = ResolutionAgent()
prediction_agent = PredictionAgent()
fraud_agent = FraudAgent()


class TicketInput(BaseModel):
    ticket_id: str
    subject: str
    description: str
    customer_id: str
    category: Optional[str] = None
    channel: Optional[str] = "app"
    country: Optional[str] = "Singapore"
    trip_id: Optional[str] = None
    order_id: Optional[str] = None
    driver_id: Optional[str] = None
    merchant_id: Optional[str] = None


class InvestigationResult(BaseModel):
    ticket_id: str
    classification: Dict
    investigation: Dict
    fraud_assessment: Dict
    root_cause: Dict
    resolution: Dict  # ⬅️ This is now the ENFORCED resolution, not AI's original
    ai_proposed_resolution: Dict  # ⬅️ NEW: AI's original (for transparency)
    policy_evaluation: Dict
    confidence_score: float
    auto_resolved: bool
    blocked_by_policy: bool
    requires_human: bool
    processing_time_seconds: float
    evidence_trail: List[str]
    token_usage: Optional[Dict] = None
    strict_mode: bool = True


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": "GrabResolve AI Engine",
        "version": "2.1.0",
        "mode": "STRICT",
        "features": ["classification", "investigation", "fraud_detection", "strict_policy_enforcement"]
    }


@app.post("/api/investigate", response_model=InvestigationResult)
async def investigate_ticket(ticket: TicketInput):
    """
    STRICT MODE pipeline:
    Classify → Investigate + Fraud + SLA → Root Cause → AI Resolution → POLICY ENFORCEMENT

    Final resolution is ALWAYS the policy-enforced version, not AI's original.
    """
    start_time = time.time()
    evidence_trail = []
    tracker = start_tracking(ticket.ticket_id)

    try:
        # ============================
        # STEP 1: CLASSIFICATION
        # ============================
        print(f"\n🧠 Step 1: Classifying {ticket.ticket_id}...")
        classification = await classifier.classify(ticket)
        evidence_trail.append(
            f"[Classification] {classification['category']} | "
            f"Urgency: {classification['urgency']}"
        )
        print(f"   ✅ {classification['category']}")

        # ============================
        # STEP 2: PARALLEL (Investigation + Fraud + SLA)
        # ============================
        print(f"🔍 Step 2: Investigation + Fraud + SLA in parallel...")
        investigation, fraud_assessment, sla_prediction = await asyncio.gather(
            investigator.investigate(ticket, classification),
            fraud_agent.assess(ticket, classification, {"findings": [], "data_sources": []}),
            prediction_agent.predict_sla_breach(ticket)
        )

        # Re-run fraud with full investigation if high risk
        if fraud_assessment["fraud_score"] > 0.4:
            fraud_assessment = await fraud_agent.assess(ticket, classification, investigation)

        evidence_trail.append(
            f"[Investigation] {len(investigation['data_sources'])} sources, "
            f"{len(investigation['findings'])} findings"
        )
        evidence_trail.append(
            f"[Fraud] Score: {fraud_assessment['fraud_score']:.2f} ({fraud_assessment['risk_level']})"
        )
        for factor in fraud_assessment.get('risk_factors', []):
            evidence_trail.append(f"[Fraud Factor] {factor['factor']}: {factor['detail']}")

        print(f"   ✅ {len(investigation['findings'])} findings")
        print(f"   🛡️ Fraud: {fraud_assessment['fraud_score']:.2f} ({fraud_assessment['risk_level']})")

        # ============================
        # STEP 3: ROOT CAUSE
        # ============================
        print(f"🎯 Step 3: Root cause analysis...")
        root_cause = await root_cause_analyzer.analyze(ticket, classification, investigation)
        evidence_trail.append(
            f"[Root Cause] {root_cause['primary_cause']} ({root_cause['confidence']:.0%})"
        )
        print(f"   ✅ {root_cause['primary_cause']} ({root_cause['confidence']:.0%})")

        # ============================
        # STEP 4: AI RESOLUTION (Proposal Only)
        # ============================
        print(f"⚡ Step 4: AI generating resolution proposal...")
        ai_resolution = await resolution_agent.resolve(
            ticket, classification, investigation, root_cause
        )
        ai_proposed_resolution = dict(ai_resolution)  # ⬅️ Save AI's original
        print(f"   📝 AI proposes: {ai_resolution.get('action', 'unknown')}")

        # ============================
        # STEP 5: STRICT POLICY ENFORCEMENT
        # ============================
        print(f"📜 Step 5: STRICT policy enforcement...")
        customer_history = fraud_assessment["customer_history"]
        policy_result = policy_engine.evaluate(
            ticket=ticket,
            classification=classification,
            investigation=investigation,
            root_cause=root_cause,
            resolution=ai_resolution,
            fraud_assessment=fraud_assessment,
            customer_history=customer_history
        )

        # ⬇️ STRICT: Use the ENFORCED resolution, not AI's original
        enforced_resolution = policy_result.enforced_resolution
        policy_summary = policy_result.summary()

        evidence_trail.append(
            f"[Policy] STRICT decision: {policy_summary['decision'].upper()} "
            f"({policy_summary['violations_count']} violations)"
        )
        for violation in policy_summary['violations']:
            evidence_trail.append(
                f"[Policy Violation] {violation['rule']} ({violation['severity']}): "
                f"{violation['message']}"
            )
        for reason in policy_summary.get('blocked_reasons', []):
            evidence_trail.append(f"[Block Reason] {reason}")

        # ============================
        # FINAL DECISION (Based on STRICT enforcement)
        # ============================
        confidence = root_cause['confidence']
        decision = policy_result.decision
        blocked_by_policy = decision == PolicyDecision.BLOCK
        requires_human = policy_result.requires_human

        # Set status based on STRICT policy decision
        if decision == PolicyDecision.BLOCK:
            enforced_resolution['status'] = 'blocked'
            auto_resolved = False
            print(f"   🚫 BLOCKED BY POLICY")

        elif decision == PolicyDecision.ESCALATE:
            enforced_resolution['status'] = 'escalated'
            auto_resolved = False
            print(f"   🔴 ESCALATED BY POLICY")

        elif decision == PolicyDecision.MODIFY:
            enforced_resolution['status'] = 'human_review'
            auto_resolved = False
            print(f"   🟡 MODIFIED + HUMAN REVIEW")

        elif decision == PolicyDecision.APPROVE:
            # Even with APPROVE, check confidence one more time
            if confidence >= AUTO_RESOLVE_CONFIDENCE:
                enforced_resolution['status'] = 'auto_resolved'
                auto_resolved = True
                print(f"   ✅ AUTO-RESOLVED (policy approved)")
            else:
                enforced_resolution['status'] = 'human_review'
                auto_resolved = False
                print(f"   🟡 HUMAN REVIEW (low confidence)")

        else:
            enforced_resolution['status'] = 'human_review'
            auto_resolved = False

        enforced_resolution['sla_prediction'] = sla_prediction
        enforced_resolution['policy_decision'] = decision.value
        enforced_resolution['policy_blocked_reasons'] = policy_summary.get('blocked_reasons', [])

        processing_time = time.time() - start_time
        token_summary = finish_tracking(ticket.ticket_id)

        if token_summary:
            print(f"\n💰 Tokens: {token_summary['total_tokens']:,}")
            for call in token_summary['breakdown_by_agent']:
                print(f"   ├─ {call['agent']:18s} "
                      f"{call['prompt_tokens']:>5} in / "
                      f"{call['completion_tokens']:>4} out")

        evidence_trail.append(
            f"[Final] AI proposed: '{ai_proposed_resolution.get('action', 'unknown')}'"
        )
        evidence_trail.append(
            f"[Final] Policy enforced: '{enforced_resolution.get('action', 'unknown')}'"
        )
        evidence_trail.append(
            f"[Final] Status: {enforced_resolution['status']} | "
            f"Auto-resolved: {auto_resolved} | "
            f"Blocked: {blocked_by_policy}"
        )

        print(f"\n✅ Complete in {processing_time:.2f}s\n")

        return InvestigationResult(
            ticket_id=ticket.ticket_id,
            classification=classification,
            investigation=investigation,
            fraud_assessment=fraud_assessment,
            root_cause=root_cause,
            resolution=enforced_resolution,  # ⬅️ ENFORCED, not AI's original
            ai_proposed_resolution=ai_proposed_resolution,  # ⬅️ For transparency
            policy_evaluation=policy_summary,
            confidence_score=confidence,
            auto_resolved=auto_resolved,
            blocked_by_policy=blocked_by_policy,
            requires_human=requires_human,
            processing_time_seconds=round(processing_time, 2),
            evidence_trail=evidence_trail,
            token_usage=token_summary,
            strict_mode=True
        )

    except Exception as e:
        finish_tracking(ticket.ticket_id)
        processing_time = time.time() - start_time
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Investigation failed: {str(e)}")


@app.post("/api/policies/reload")
async def reload_policies():
    policies = policy_engine.reload()
    return {
        "message": "Policies reloaded (STRICT MODE)",
        "version": policies.get("version", "unknown"),
        "strict_mode": True,
        "policy_groups": list(policies.keys())
    }


@app.get("/api/policies")
async def get_policies():
    return policy_engine.policies


@app.post("/api/classify")
async def classify_only(ticket: TicketInput):
    return await classifier.classify(ticket)


@app.post("/api/predict-sla")
async def predict_sla(ticket: TicketInput):
    return await prediction_agent.predict_sla_breach(ticket)


@app.post("/api/fraud-check")
async def fraud_check(ticket: TicketInput):
    classification = await classifier.classify(ticket)
    investigation = await investigator.investigate(ticket, classification)
    return await fraud_agent.assess(ticket, classification, investigation)


@app.get("/api/customer/{customer_id}/history")
async def get_customer_history(customer_id: str):
    return fraud_agent.get_customer_history(customer_id)


@app.get("/api/sample-tickets")
async def get_sample_tickets():
    try:
        with open("data/sample_tickets.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Sample tickets not found")


if __name__ == "__main__":
    import uvicorn
    print("🚀 GrabResolve AI Engine v2.1 (STRICT MODE)")
    print("📜 Policies are MANDATORY, not advisory")
    print("📡 http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=200)