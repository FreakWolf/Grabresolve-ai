"""
Evidence Agent - Validates pre-attached evidence against customer claims.
Each ticket comes with evidence already attached - we just verify it.
"""
import json
from typing import List, Dict
from llm_client import client
from token_tracker import get_tracker


class EvidenceAgent:
    """
    Validates pre-attached evidence files for ticket claims.
    Determines if evidence supports, contradicts, or is unrelated to the claim.
    """

    async def validate(self, ticket, classification: dict, investigation: dict) -> dict:
        """
        Main entry point - validates all evidence attached to a ticket.
        Returns validation report.
        """
        evidence_list = self._get_evidence(ticket)

        if not evidence_list:
            return {
                "evidence_count": 0,
                "evidence_provided": False,
                "validations": [],
                "overall_credibility": "unknown",
                "supports_claim": "no_evidence",
                "credibility_score": 0.0,
                "red_flags": [],
                "summary": "No evidence provided - relying on text description only"
            }

        # Validate each piece of evidence
        validations = []
        for evidence in evidence_list:
            try:
                validation = await self._validate_single(
                    evidence, ticket, classification, investigation
                )
                validations.append(validation)
            except Exception as e:
                print(f"   ⚠️ Evidence validation failed: {e}")
                validations.append({
                    "evidence_id": evidence.get("id", "unknown"),
                    "filename": evidence.get("filename", "unknown"),
                    "valid": False,
                    "credibility": "could_not_verify",
                    "supports_claim": "unknown",
                    "error": str(e)
                })

        # Aggregate results
        return self._aggregate_validations(validations, evidence_list, ticket, classification)

    def _get_evidence(self, ticket) -> List[Dict]:
        """Extract pre-attached evidence from ticket."""
        if hasattr(ticket, "evidence") and ticket.evidence:
            return ticket.evidence
        if hasattr(ticket, "attachments") and ticket.attachments:
            return ticket.attachments
        return []

    async def _validate_single(
        self, evidence: Dict, ticket, classification: dict, investigation: dict
    ) -> Dict:
        """
        Validate a single piece of evidence using LLM reasoning.
        """
        evidence_id = evidence.get("id", "unknown")
        filename = evidence.get("filename", "")
        ev_type = evidence.get("type", "")
        description = evidence.get("description", "")
        claimed_content = evidence.get("claimed_content", "")
        metadata = evidence.get("metadata", {})

        system_prompt = (
            "You are an evidence validation specialist for Grab support. "
            "Your job is to determine if pre-attached evidence supports a customer's claim. "
            "Be skeptical but fair. Return strict JSON only."
        )

        user_prompt = f"""
Validate this evidence against the customer's claim.

CUSTOMER CLAIM:
- Subject: {ticket.subject}
- Description: {ticket.description}
- Category: {classification.get('category')}
- Country: {ticket.country}

EVIDENCE TO VALIDATE:
- File: {filename}
- Type: {ev_type}
- Description: {description}
- Claimed Content: {claimed_content}
- Upload time: {metadata.get('uploaded_at', 'unknown')}

INVESTIGATION CONTEXT:
- Findings: {json.dumps(investigation.get('findings', []), indent=2)[:600]}
- Data sources: {investigation.get('data_sources', [])}

Respond in this EXACT JSON format:
{{
  "valid": true,
  "credibility": "high",
  "supports_claim": "yes",
  "key_observations": ["observation 1", "observation 2"],
  "red_flags": [],
  "confidence": 0.85,
  "verdict": "Brief one-sentence assessment"
}}

Validation criteria:
- HIGH credibility: Clear, relevant, content matches description
- MEDIUM credibility: Related but unclear, partial support
- LOW credibility: Tangential, unclear connection to claim
- SUSPICIOUS: Doesn't match claim, contradicts other data

For supports_claim: "yes", "no", "partial", or "unrelated"
"""

        try:
            result = client.json_response(
                system_prompt, user_prompt,
                max_tokens=400
            )

            # Track token usage
            tracker = get_tracker(ticket.ticket_id)
            if tracker:
                tracker.add_call("evidence_agent", client.last_usage)

            # Add original evidence info
            result["evidence_id"] = evidence_id
            result["filename"] = filename
            result["type"] = ev_type
            result["description"] = description
            result["claimed_content"] = claimed_content

            return result

        except Exception as exc:
            tracker = get_tracker(ticket.ticket_id)
            if tracker and client.last_usage:
                tracker.add_call("evidence_agent_failed", client.last_usage)

            return {
                "evidence_id": evidence_id,
                "filename": filename,
                "type": ev_type,
                "valid": False,
                "credibility": "could_not_verify",
                "supports_claim": "unknown",
                "key_observations": [],
                "red_flags": [f"Validation error: {exc}"],
                "confidence": 0.0,
                "verdict": "Could not validate due to error"
            }

    def _aggregate_validations(
        self, validations: List[Dict], evidence_list: List[Dict],
        ticket, classification: dict
    ) -> Dict:
        """Combine all validations into overall report."""
        if not validations:
            return {
                "evidence_count": 0,
                "evidence_provided": False,
                "validations": [],
                "overall_credibility": "unknown",
                "supports_claim": "no_evidence",
                "credibility_score": 0.0,
                "red_flags": [],
                "summary": "No evidence to validate"
            }

        # Calculate credibility score
        credibility_weights = {
            "high": 1.0,
            "medium": 0.6,
            "low": 0.3,
            "suspicious": 0.1,
            "could_not_verify": 0.0
        }

        scores = [
            credibility_weights.get(v.get("credibility", "could_not_verify"), 0.0)
            for v in validations
        ]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        # Overall credibility
        if avg_score >= 0.8:
            overall_credibility = "high"
        elif avg_score >= 0.5:
            overall_credibility = "medium"
        elif avg_score >= 0.2:
            overall_credibility = "low"
        else:
            overall_credibility = "could_not_verify"

        # Aggregate support
        support_counts = {"yes": 0, "no": 0, "partial": 0, "unrelated": 0, "unknown": 0}
        for v in validations:
            support = v.get("supports_claim", "unknown")
            support_counts[support] = support_counts.get(support, 0) + 1

        # Determine overall support
        if support_counts["yes"] > support_counts["no"]:
            overall_support = "supports"
        elif support_counts["no"] > 0:
            overall_support = "contradicts"
        elif support_counts["partial"] > 0:
            overall_support = "partial"
        else:
            overall_support = "inconclusive"

        # Collect all red flags
        all_red_flags = []
        for v in validations:
            all_red_flags.extend(v.get("red_flags", []))

        # Generate summary
        summary_parts = [
            f"{len(validations)} pieces of evidence analyzed",
            f"overall credibility: {overall_credibility}",
            f"claim support: {overall_support}"
        ]
        if all_red_flags:
            summary_parts.append(f"{len(all_red_flags)} red flags detected")

        return {
            "evidence_count": len(validations),
            "evidence_provided": True,
            "validations": validations,
            "overall_credibility": overall_credibility,
            "credibility_score": round(avg_score, 2),
            "supports_claim": overall_support,
            "support_breakdown": support_counts,
            "red_flags": list(set(all_red_flags))[:5],
            "summary": " | ".join(summary_parts)
        }