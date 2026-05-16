"""
Evidence Agent v3.0 - Nova-Optimized Batched Vision Validation

Validates ALL ticket evidence in a SINGLE multimodal Nova call.
Massively reduces token cost and rate limit consumption.
"""
import json
from typing import List, Dict
from llm_client import client
from token_tracker import get_tracker


class EvidenceAgent:
    """Vision-based evidence validator using Nova multimodal API."""

    EVIDENCE_REQUIRED_CATEGORIES = {
        "missing_items", "damaged_delivery", "package_damaged",
        "wrong_delivery", "safety_critical", "delivery_issue"
    }

    VISION_TYPES = {"image", "photo", "screenshot"}
    DOCUMENT_TYPES = {"document", "pdf", "receipt", "invoice"}

    MAX_IMAGES_PER_REQUEST = 10
    MAX_DOCUMENTS_PER_REQUEST = 5

    async def validate(self, ticket, classification: dict, investigation: dict) -> dict:
        """Main entry: validates all ticket evidence in ONE Nova call."""
        evidence_list = self._get_evidence(ticket)
        category = classification.get("category", "")
        evidence_required = category in self.EVIDENCE_REQUIRED_CATEGORIES

        if not evidence_list:
            return self._no_evidence_result(category, evidence_required)

        # Split images vs documents
        images = [
            e for e in evidence_list
            if (e.get("type") or "").lower() in self.VISION_TYPES
        ]
        documents = [
            e for e in evidence_list
            if (e.get("type") or "").lower() in self.DOCUMENT_TYPES
        ]

        truncation_notes = []
        if len(images) > self.MAX_IMAGES_PER_REQUEST:
            truncation_notes.append(
                f"images truncated: {len(images)} → {self.MAX_IMAGES_PER_REQUEST}"
            )
            images = images[:self.MAX_IMAGES_PER_REQUEST]
        if len(documents) > self.MAX_DOCUMENTS_PER_REQUEST:
            truncation_notes.append(
                f"docs truncated: {len(documents)} → {self.MAX_DOCUMENTS_PER_REQUEST}"
            )
            documents = documents[:self.MAX_DOCUMENTS_PER_REQUEST]

        # Filter out evidence without URLs
        images = [e for e in images if e.get("url")]
        documents = [e for e in documents if e.get("url")]

        if not images and not documents:
            return self._no_evidence_result(
                category, evidence_required,
                summary="Evidence attached but no valid URLs found"
            )

        # ONE batched vision call
        try:
            validations = await self._batch_validate(
                images, documents, ticket, classification, investigation
            )
        except Exception as exc:
            print(f"   ⚠️ Batch evidence validation failed: {exc}")
            return self._failure_result(evidence_list, evidence_required, str(exc))

        result = self._aggregate_validations(
            validations, evidence_list, ticket, classification, evidence_required
        )
        if truncation_notes:
            result["truncation_notes"] = truncation_notes
        return result

    def _get_evidence(self, ticket) -> List[Dict]:
        if hasattr(ticket, "evidence") and ticket.evidence:
            return ticket.evidence
        if hasattr(ticket, "attachments") and ticket.attachments:
            return ticket.attachments
        return []

    async def _batch_validate(
        self, images: List[Dict], documents: List[Dict],
        ticket, classification: dict, investigation: dict
    ) -> List[Dict]:
        """SINGLE Nova call validating all evidence at once."""
        category = classification.get("category", "")
        category_focus = self._get_category_focus(category)

        # Build evidence manifest
        all_evidence = []
        for i, ev in enumerate(images):
            all_evidence.append({
                "index": i,
                "kind": "image",
                "id": ev.get("id", f"img_{i}"),
                "filename": ev.get("filename", ""),
                "customer_description": ev.get("description", ""),
                "customer_claims_shows": ev.get("claimed_content", ""),
                "metadata": ev.get("metadata", {})
            })
        for j, ev in enumerate(documents):
            all_evidence.append({
                "index": len(images) + j,
                "kind": "document",
                "id": ev.get("id", f"doc_{j}"),
                "filename": ev.get("filename", ""),
                "customer_description": ev.get("description", ""),
                "customer_claims_shows": ev.get("claimed_content", ""),
                "metadata": ev.get("metadata", {})
            })

        system_prompt = (
            "You are a forensic evidence analyst for Grab support. "
            "You will receive multiple images and/or documents attached to a single "
            "support ticket. Examine EACH ONE in order and validate the customer's claim. "
            "Be objective and skeptical of inconsistencies. "
            "Return ONLY a strict JSON object - no markdown, no commentary."
        )

        user_prompt = f"""
Validate {len(all_evidence)} pieces of evidence for this support ticket.

CUSTOMER CLAIM:
- Subject: {ticket.subject}
- Description: {ticket.description}
- Category: {category}
- Country: {getattr(ticket, 'country', 'Unknown')}

WHAT TO LOOK FOR ({category}):
{category_focus}

EVIDENCE MANIFEST (analyze attached files in this order):
{json.dumps(all_evidence, indent=2)[:2500]}

INVESTIGATION CONTEXT:
- Findings so far: {json.dumps(investigation.get('findings', []), indent=2)[:600]}
- Data sources: {investigation.get('data_sources', [])}

The attached files appear in the same order as the manifest above.
Return this EXACT JSON structure:

{{
  "overall_assessment": {{
    "supports_claim": "yes" | "no" | "partial" | "inconclusive",
    "credibility": "high" | "medium" | "low" | "suspicious",
    "confidence": 0.0,
    "summary": "<one paragraph overall finding>",
    "critical_red_flags": ["<inconsistencies across evidence>"]
  }},
  "validations": [
    {{
      "evidence_index": 0,
      "evidence_id": "<id from manifest>",
      "image_describes": "<what you actually see, 1-2 sentences>",
      "matches_claim": "yes" | "partial" | "no" | "unclear",
      "credibility": "high" | "medium" | "low" | "suspicious",
      "supports_claim": "yes" | "no" | "partial" | "unrelated",
      "key_observations": ["specific detail 1", "specific detail 2"],
      "red_flags": ["any inconsistency, manipulation sign, mismatch"],
      "confidence": 0.0,
      "verdict": "<one-sentence assessment>"
    }}
  ]
}}

Be specific. If you see 2 burgers but customer claims 3 ordered with 1 missing, say so.
If image quality is poor or location seems wrong, flag it.
If documents (receipts/reports) contradict customer's claim, flag it.
"""

        image_urls = [ev["url"] for ev in images]
        document_specs = [
            {
                "url": ev["url"],
                "name": ev.get("filename", "document"),
                "format": self._infer_doc_format(ev.get("filename", ""))
            }
            for ev in documents
        ]

        # Make the call
        if document_specs:
            response = client.vision_with_documents(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_urls=image_urls,
                document_urls=document_specs,
                max_tokens=2000
            )
        else:
            response = client.vision_json_response(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_urls=image_urls,
                max_tokens=2000
            )

        # Track tokens
        tracker = get_tracker(ticket.ticket_id)
        if tracker:
            tracker.add_call("evidence_batch_vision", client.last_usage)

        # Validate response shape
        validations = response.get("validations", [])
        overall = response.get("overall_assessment", {})

        # Enrich each validation with original evidence info
        enriched = []
        all_input = images + documents
        for i, ev in enumerate(all_input):
            matched = None
            for v in validations:
                if (v.get("evidence_index") == i or
                        v.get("evidence_id") == ev.get("id")):
                    matched = v
                    break

            if matched:
                matched["evidence_id"] = ev.get("id", f"ev_{i}")
                matched["filename"] = ev.get("filename", "")
                matched["type"] = ev.get("type", "")
                matched["url"] = ev.get("url", "")
                matched["analyzed_method"] = "vision_batch"
                matched["vision_used"] = True
                enriched.append(matched)
            else:
                enriched.append({
                    "evidence_id": ev.get("id", f"ev_{i}"),
                    "filename": ev.get("filename", ""),
                    "type": ev.get("type", ""),
                    "url": ev.get("url", ""),
                    "credibility": "could_not_verify",
                    "supports_claim": "unknown",
                    "matches_claim": "unclear",
                    "key_observations": [],
                    "red_flags": ["Vision did not return validation for this evidence"],
                    "confidence": 0.0,
                    "verdict": "Validation skipped",
                    "vision_used": False,
                    "analyzed_method": "vision_batch_skipped"
                })

        # Stash overall for aggregation
        for v in enriched:
            v["_overall_assessment"] = overall

        return enriched

    def _infer_doc_format(self, filename: str) -> str:
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "pdf"
        mapping = {
            "pdf": "pdf", "csv": "csv", "txt": "txt",
            "xls": "xls", "xlsx": "xls", "html": "html",
            "htm": "html", "doc": "doc", "docx": "doc"
        }
        return mapping.get(ext, "pdf")

    def _get_category_focus(self, category: str) -> str:
        focus_map = {
            "missing_items": (
                "Count the visible items. Compare to what customer claims was ordered. "
                "Note packaging - sealed/unsealed? Any space where missing items could fit? "
                "Cross-check images with receipts/order screenshots."
            ),
            "damaged_delivery": (
                "Look for visible damage: cracks, leaks, dents, broken seals, spillage. "
                "Is damage consistent with shipping/handling? Note severity. "
                "Cross-check damage shown vs customer's narrative."
            ),
            "package_damaged": (
                "Examine box condition: dents, crushing, water damage, FRAGILE labels. "
                "Compare external box damage to internal item damage if both shown. "
                "Verify high-value items via invoice if attached."
            ),
            "wrong_delivery": (
                "Look at delivery location/doorstep. Compare to any reference image. "
                "Note door color, mat, surroundings, house number visibility. "
                "If two location images shown, compare them side-by-side."
            ),
            "safety_critical": (
                "CRITICAL: Look for mold, discoloration, foreign objects, signs of spoilage. "
                "Note visible health hazards. Check medical reports if attached. "
                "Verify timeline: prep time vs delivery time on container labels."
            ),
            "delivery_issue": (
                "Examine what was delivered vs what was ordered. Note any discrepancies "
                "in items, quantities, or quality. Cross-check against receipts."
            ),
        }
        return focus_map.get(
            category,
            "Examine carefully and note all relevant details related to the customer's claim."
        )

    def _no_evidence_result(self, category, required, summary=None):
        return {
            "evidence_count": 0,
            "evidence_provided": False,
            "evidence_required": required,
            "validations": [],
            "overall_credibility": "no_evidence",
            "supports_claim": "no_evidence",
            "credibility_score": 0.0,
            "red_flags": ["No evidence provided"] if required else [],
            "summary": summary or (
                f"⚠️ No evidence provided for '{category}' (evidence required)"
                if required else "No evidence provided - relying on text description"
            )
        }

    def _failure_result(self, evidence_list, required, error):
        return {
            "evidence_count": len(evidence_list),
            "evidence_provided": True,
            "evidence_required": required,
            "validations": [],
            "overall_credibility": "could_not_verify",
            "supports_claim": "unknown",
            "credibility_score": 0.0,
            "red_flags": [f"Vision API error: {error}"],
            "summary": f"⚠️ Could not validate evidence: {error}",
            "validation_failed": True
        }

    def _aggregate_validations(
        self, validations: List[Dict], evidence_list: List[Dict],
        ticket, classification: dict, evidence_required: bool
    ) -> Dict:
        if not validations:
            return self._no_evidence_result(
                classification.get("category", ""), evidence_required
            )

        overall = validations[0].get("_overall_assessment", {}) if validations else {}

        credibility_weights = {
            "high": 1.0, "medium": 0.6, "low": 0.3,
            "suspicious": 0.05, "could_not_verify": 0.0
        }
        scores = [
            credibility_weights.get(v.get("credibility", "could_not_verify"), 0.0)
            for v in validations
        ]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        if overall.get("credibility"):
            overall_credibility = overall["credibility"]
        elif avg_score >= 0.8:
            overall_credibility = "high"
        elif avg_score >= 0.5:
            overall_credibility = "medium"
        elif avg_score >= 0.2:
            overall_credibility = "low"
        else:
            overall_credibility = "could_not_verify"

        support_counts = {"yes": 0, "no": 0, "partial": 0, "unrelated": 0, "unknown": 0}
        for v in validations:
            s = v.get("supports_claim", "unknown")
            support_counts[s] = support_counts.get(s, 0) + 1

        if overall.get("supports_claim"):
            overall_support = overall["supports_claim"]
            if overall_support == "no":
                overall_support = "contradicts"
        elif support_counts["no"] >= support_counts["yes"] and support_counts["no"] > 0:
            overall_support = "contradicts"
        elif support_counts["yes"] > 0 and support_counts["no"] == 0:
            overall_support = "supports"
        elif support_counts["partial"] > 0:
            overall_support = "partial"
        else:
            overall_support = "inconclusive"

        all_red_flags = list(overall.get("critical_red_flags", []))
        for v in validations:
            all_red_flags.extend(v.get("red_flags", []) or [])

        suspicious_count = sum(
            1 for v in validations if v.get("credibility") == "suspicious"
        )

        clean_validations = [
            {k: v for k, v in val.items() if k != "_overall_assessment"}
            for val in validations
        ]

        summary_parts = [
            f"{len(validations)} pieces analyzed in 1 batched vision call",
            f"credibility: {overall_credibility}",
            f"claim support: {overall_support}"
        ]
        if all_red_flags:
            summary_parts.append(f"{len(all_red_flags)} red flags")
        if suspicious_count > 0:
            summary_parts.append(f"⚠️ {suspicious_count} SUSPICIOUS")

        return {
            "evidence_count": len(validations),
            "evidence_provided": True,
            "evidence_required": evidence_required,
            "validations": clean_validations,
            "overall_credibility": overall_credibility,
            "credibility_score": round(avg_score, 2),
            "supports_claim": overall_support,
            "support_breakdown": support_counts,
            "suspicious_count": suspicious_count,
            "red_flags": list(set(all_red_flags))[:8],
            "ai_summary": overall.get("summary", ""),
            "summary": " | ".join(summary_parts),
            "method": "batched_nova_vision"
        }