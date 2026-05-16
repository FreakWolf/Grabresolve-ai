"""
Policy Engine - STRICT MODE v2.2
Hard-coded business rules that OVERRIDE AI decisions.
Policies cannot be bypassed - they are deterministic and enforced.

NEW IN v2.2:
  - Absolute global refund ceiling (currency-agnostic)
  - Null-currency refund blocking
  - 'credit' action_type now covered by refund limits
  - Text-scan for implicit refund promises in customer messages
"""
import re
import yaml
import os
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum


class PolicyDecision(Enum):
    APPROVE = "approve"
    MODIFY = "modify"
    BLOCK = "block"
    ESCALATE = "escalate"


class ViolationSeverity(Enum):
    CRITICAL = "critical"  # Always blocks
    HIGH = "high"          # Forces escalation
    MEDIUM = "medium"      # Forces human review
    LOW = "low"            # Logged but allowed


@dataclass
class PolicyViolation:
    rule: str
    severity: str
    message: str
    suggested_action: str
    enforcement: str = "blocking"  # blocking | escalating | modifying | logging


@dataclass
class PolicyResult:
    decision: PolicyDecision
    violations: List[PolicyViolation] = field(default_factory=list)
    modifications: Dict = field(default_factory=dict)
    audit_trail: List[str] = field(default_factory=list)
    final_action: Optional[str] = None
    requires_human: bool = False
    enforced_resolution: Optional[Dict] = None
    blocked_reasons: List[str] = field(default_factory=list)

    def add_violation(self, rule, severity, message, suggested_action, enforcement="blocking"):
        self.violations.append(PolicyViolation(
            rule=rule,
            severity=severity,
            message=message,
            suggested_action=suggested_action,
            enforcement=enforcement
        ))

    def log(self, message):
        timestamp = datetime.now().isoformat()
        self.audit_trail.append(f"[{timestamp}] {message}")

    def add_blocked_reason(self, reason):
        self.blocked_reasons.append(reason)

    def has_critical(self):
        return any(v.severity == "critical" for v in self.violations)

    def has_blocking(self):
        return any(v.enforcement == "blocking" for v in self.violations)

    def summary(self) -> Dict:
        return {
            "decision": self.decision.value,
            "violations_count": len(self.violations),
            "violations": [
                {
                    "rule": v.rule,
                    "severity": v.severity,
                    "message": v.message,
                    "suggested_action": v.suggested_action,
                    "enforcement": v.enforcement
                } for v in self.violations
            ],
            "modifications": self.modifications,
            "audit_trail": self.audit_trail,
            "final_action": self.final_action,
            "requires_human": self.requires_human,
            "blocked_reasons": self.blocked_reasons,
            "enforced_resolution": self.enforced_resolution,
            "strict_mode": True
        }


class PolicyEngine:
    # Action types subject to refund-limit checks
    REFUND_LIKE_ACTIONS = {"refund", "partial_refund", "credit"}

    # Regex to catch implicit refund promises in free-text fields
    # Matches: "refund $800", "credit 1000 SGD", "reimburse 850", etc.
    IMPLICIT_REFUND_PATTERN = re.compile(
        r'(?:refund|credit|reimburs\w*|payback|pay\s+back)'
        r'[^\d]{0,30}'
        r'(?:sgd|myr|idr|thb|php|vnd|usd|\$)?\s*'
        r'(\d{3,})',
        re.IGNORECASE
    )

    def __init__(self, policy_file="policies.yaml"):
        self.policy_file = policy_file
        self.policies = self._load_policies()
        self.strict_mode = True
        print(f"📜 Policy Engine v2.2 loaded (STRICT MODE): {len(self.policies)} policy groups")

    def _load_policies(self) -> Dict:
        try:
            path = os.path.join(os.path.dirname(__file__), self.policy_file)
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            print(f"⚠️ Policy file not found: {self.policy_file}")
            return {}
        except Exception as e:
            print(f"⚠️ Error loading policies: {e}")
            return {}

    def reload(self):
        self.policies = self._load_policies()
        return self.policies

    def evaluate(
        self,
        ticket,
        classification: dict,
        investigation: dict,
        root_cause: dict,
        resolution: dict,
        fraud_assessment: dict,
        customer_history: dict
    ) -> PolicyResult:
        """
        STRICT evaluation - ALL rules enforced, no bypass possible.
        Returns enforced_resolution that MUST be used (not the AI's original).
        """
        result = PolicyResult(decision=PolicyDecision.APPROVE)
        result.log(f"STRICT policy evaluation v2.2 started for {ticket.ticket_id}")

        # Start with AI's resolution as baseline (will be modified/overridden)
        enforced = dict(resolution)
        enforced["_ai_original_action"] = resolution.get("action")
        enforced["_ai_original_action_type"] = resolution.get("action_type")
        enforced["_ai_original_refund"] = resolution.get("refund_amount")
        enforced["_ai_original_currency"] = resolution.get("refund_currency")

        # Run ALL policy checks (no early exit)
        self._check_fraud_score(result, fraud_assessment, enforced)
        self._check_confidence(result, root_cause, resolution, enforced)
        self._check_refund_limits(result, ticket, resolution, customer_history, enforced)
        self._check_implicit_refund_in_text(result, resolution, enforced)  # NEW
        self._check_prohibited_actions(result, resolution, enforced)
        self._check_category_rules(result, classification, investigation, resolution, enforced)
        self._check_driver_rules(result, resolution, investigation, enforced)
        self._check_velocity(result, customer_history, enforced)
        self._check_data_completeness(result, classification, investigation, enforced)

        # ENFORCE the decision (strict)
        self._enforce_decision(result, enforced)

        result.enforced_resolution = enforced
        result.log(f"STRICT enforcement complete: {result.decision.value}")
        return result

    # ============================================================
    # STRICT POLICY CHECKS
    # ============================================================

    def _check_fraud_score(self, result, fraud, enforced):
        rules = self.policies.get("fraud_rules", {})
        fraud_score = fraud.get("fraud_score", 0.0)

        block_threshold = rules.get("fraud_score_block_threshold", 0.60)
        escalate_threshold = rules.get("fraud_score_escalate_threshold", 0.80)

        if fraud_score >= escalate_threshold:
            result.add_violation(
                rule="fraud_score_critical",
                severity="critical",
                message=f"Fraud score {fraud_score:.2f} exceeds critical threshold {escalate_threshold}",
                suggested_action="BLOCK - escalate to fraud team immediately",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Critical fraud score: {fraud_score:.2f}")
            enforced["action"] = f"BLOCKED: Critical fraud risk ({fraud_score:.2f})"
            enforced["action_type"] = "blocked_fraud"
            enforced["refund_amount"] = None
            result.log(f"🚨 STRICT BLOCK: fraud score {fraud_score:.2f}")

        elif fraud_score >= block_threshold:
            result.add_violation(
                rule="fraud_score_high",
                severity="high",
                message=f"Fraud score {fraud_score:.2f} exceeds block threshold {block_threshold}",
                suggested_action="BLOCK auto-resolution, require human review",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason(f"High fraud score: {fraud_score:.2f}")
            enforced["action"] = f"HOLD: High fraud risk - human review required"
            enforced["action_type"] = "fraud_review"
            enforced["refund_amount"] = None
            result.log(f"⚠️ STRICT HOLD: fraud score {fraud_score:.2f}")

    def _check_confidence(self, result, root_cause, resolution, enforced):
        rules = self.policies.get("confidence_rules", {})
        confidence = root_cause.get("confidence", 0.0)
        action_type = resolution.get("action_type", "")

        auto_min = rules.get("auto_resolve_min", 0.75)
        escalation = rules.get("escalation_threshold", 0.40)
        high_value_min = rules.get("high_value_action_min", 0.85)

        high_value_actions = ["refund", "driver_suspension", "credit"]

        if action_type in high_value_actions and confidence < high_value_min:
            result.add_violation(
                rule="confidence_too_low_for_high_value",
                severity="high",
                message=f"Action '{action_type}' requires confidence >= {high_value_min}, got {confidence:.2f}",
                suggested_action="Require human approval",
                enforcement="escalating"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Low confidence ({confidence:.2f}) for high-value action")

        elif confidence < escalation:
            result.add_violation(
                rule="confidence_below_escalation",
                severity="high",
                message=f"Confidence {confidence:.2f} below escalation threshold {escalation}",
                suggested_action="Escalate to senior agent",
                enforcement="escalating"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Confidence too low: {confidence:.2f}")

        elif confidence < auto_min:
            result.add_violation(
                rule="confidence_below_auto_resolve",
                severity="medium",
                message=f"Confidence {confidence:.2f} below auto-resolve threshold {auto_min}",
                suggested_action="Require human review",
                enforcement="escalating"
            )
            result.requires_human = True

    def _check_refund_limits(self, result, ticket, resolution, history, enforced):
        """
        UPDATED v2.2: Strict enforcement with absolute ceiling.
        Precedence: absolute_block > hard_cap > auto_approve > monthly > cooldown
        """
        rules = self.policies.get("refund_limits", {})

        # Patch 3: Cover credit action_type as well
        if resolution.get("action_type") not in self.REFUND_LIKE_ACTIONS:
            return

        amount = resolution.get("refund_amount")
        currency = resolution.get("refund_currency")

        # Patch 2: Block null-currency refunds (cannot validate caps without currency)
        if amount is None:
            return  # No refund proposed, nothing to check

        try:
            amount = float(amount)
        except (ValueError, TypeError):
            result.add_violation(
                rule="refund_malformed_amount",
                severity="critical",
                message=f"Refund amount '{amount}' is not numeric",
                suggested_action="BLOCK - reject malformed resolution",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason("Malformed refund amount")
            enforced["action"] = "BLOCKED: Refund amount is not numeric"
            enforced["action_type"] = "blocked_malformed"
            enforced["refund_amount"] = None
            return

        if currency is None:
            result.add_violation(
                rule="refund_missing_currency",
                severity="critical",
                message=f"Refund amount {amount} proposed without currency - cannot validate caps",
                suggested_action="BLOCK - reject malformed resolution",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason("Refund proposed without currency")
            enforced["action"] = f"BLOCKED: Refund {amount} missing currency field"
            enforced["action_type"] = "blocked_malformed"
            enforced["refund_amount"] = None
            result.log(f"🚫 STRICT BLOCK: null currency for amount {amount}")
            return

        # ============================================================
        # PATCH 1: ABSOLUTE GLOBAL CEILING (highest precedence)
        # Blocks ANY refund >= threshold regardless of currency
        # ============================================================
        absolute_block = rules.get("absolute_block_threshold")
        if absolute_block and amount >= absolute_block:
            result.add_violation(
                rule="refund_exceeds_absolute_ceiling",
                severity="critical",
                message=(
                    f"Refund {amount} {currency} >= absolute ceiling "
                    f"{absolute_block} (currency-agnostic, never auto-approved)"
                ),
                suggested_action="BLOCK - senior management approval required",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason(
                f"Absolute ceiling: {amount} {currency} >= {absolute_block}"
            )
            enforced["action"] = (
                f"BLOCKED: Refund {amount} {currency} exceeds absolute ceiling "
                f"of {absolute_block} (any currency). Senior approval required."
            )
            enforced["action_type"] = "blocked_absolute_ceiling"
            enforced["refund_amount"] = None
            result.log(f"🚫 ABSOLUTE BLOCK: {amount} {currency} >= {absolute_block}")
            return  # Hard stop - no further refund processing

        # ============================================================
        # HARD CAP (per-currency)
        # ============================================================
        hard_cap = rules.get("hard_cap", {}).get(currency)
        if hard_cap and amount > hard_cap:
            result.add_violation(
                rule="refund_exceeds_hard_cap",
                severity="critical",
                message=f"Refund {amount} {currency} exceeds HARD cap {hard_cap}",
                suggested_action=f"BLOCK refund - requires senior management approval",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Refund {amount} exceeds hard cap {hard_cap} {currency}")
            enforced["action"] = f"BLOCKED: Refund {amount} {currency} exceeds hard cap of {hard_cap}"
            enforced["action_type"] = "blocked_amount"
            enforced["refund_amount"] = None
            result.log(f"🚫 STRICT BLOCK: amount {amount} > hard cap {hard_cap}")
            return

        # ============================================================
        # AUTO-APPROVE CAP (modify down to cap)
        # ============================================================
        auto_cap = rules.get("auto_approve_max", {}).get(currency)
        if auto_cap and amount > auto_cap:
            result.add_violation(
                rule="refund_exceeds_auto_approve",
                severity="high",
                message=f"Refund {amount} {currency} exceeds auto-approve limit {auto_cap}",
                suggested_action=f"Cap at {auto_cap} {currency} OR escalate full amount",
                enforcement="modifying"
            )
            result.requires_human = True
            result.modifications["original_refund"] = amount
            result.modifications["capped_refund"] = auto_cap
            enforced["refund_amount"] = auto_cap
            enforced["action"] = (
                f"MODIFIED: Refund capped at {auto_cap} {currency} "
                f"(original: {amount}) - human must approve full amount"
            )
            result.add_blocked_reason(f"Refund capped from {amount} to {auto_cap}")
            result.log(f"✂️ STRICT CAP: {amount} → {auto_cap} {currency}")

        # ============================================================
        # MONTHLY LIMIT
        # ============================================================
        monthly_max = rules.get("max_per_customer_monthly", 5)
        recent_refunds = history.get("refunds_last_30_days", 0)
        if recent_refunds >= monthly_max:
            result.add_violation(
                rule="customer_monthly_refund_limit",
                severity="high",
                message=f"Customer has {recent_refunds} refunds in last 30 days (max: {monthly_max})",
                suggested_action="Block - review customer history",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Monthly limit hit: {recent_refunds}/{monthly_max}")
            enforced["action"] = f"BLOCKED: Customer at monthly refund limit ({recent_refunds}/{monthly_max})"
            enforced["action_type"] = "blocked_limit"
            enforced["refund_amount"] = None
            result.log(f"🚫 STRICT BLOCK: monthly limit {recent_refunds}/{monthly_max}")

        # ============================================================
        # COOLDOWN
        # ============================================================
        cooldown = rules.get("cooldown_hours", 24)
        last_refund = history.get("last_refund_at")
        if last_refund:
            try:
                last_refund_dt = datetime.fromisoformat(last_refund.replace("Z", "+00:00"))
                hours_since = (datetime.now() - last_refund_dt.replace(tzinfo=None)).total_seconds() / 3600
                if hours_since < cooldown:
                    result.add_violation(
                        rule="refund_cooldown",
                        severity="high",
                        message=f"Last refund only {hours_since:.1f}h ago (cooldown: {cooldown}h)",
                        suggested_action="Block until cooldown expires",
                        enforcement="blocking"
                    )
                    result.requires_human = True
                    result.add_blocked_reason(f"Cooldown active: {hours_since:.1f}h ago")
                    enforced["action"] = (
                        f"BLOCKED: Cooldown active (last refund {hours_since:.1f}h ago, "
                        f"requires {cooldown}h)"
                    )
                    enforced["action_type"] = "blocked_cooldown"
                    enforced["refund_amount"] = None
                    result.log(f"🚫 STRICT COOLDOWN BLOCK: {hours_since:.1f}h < {cooldown}h")
            except (ValueError, AttributeError):
                pass

    def _check_implicit_refund_in_text(self, result, resolution, enforced):
        """
        PATCH 4 (NEW): Catch AI promising refunds in free-text fields
        while action_type is non-refund. Prevents bypass via natural language.
        """
        rules = self.policies.get("refund_limits", {})
        absolute_block = rules.get("absolute_block_threshold", 800)
        action_type = resolution.get("action_type", "")

        # Skip if action_type is already a refund type (will be caught by refund_limits)
        if action_type in self.REFUND_LIKE_ACTIONS:
            return

        text_fields = {
            "customer_message": str(resolution.get("customer_message", "")),
            "internal_notes": str(resolution.get("internal_notes", "")),
            "action": str(resolution.get("action", "")),
            "follow_up_action": str(resolution.get("follow_up_action", ""))
        }

        for field_name, text in text_fields.items():
            if not text:
                continue

            matches = self.IMPLICIT_REFUND_PATTERN.findall(text)
            for match in matches:
                try:
                    amt = int(match)
                except ValueError:
                    continue

                if amt >= absolute_block:
                    result.add_violation(
                        rule="implicit_refund_in_text",
                        severity="critical",
                        message=(
                            f"AI mentions refund amount {amt} (>= absolute ceiling "
                            f"{absolute_block}) in '{field_name}' but action_type is "
                            f"'{action_type}' - possible bypass attempt"
                        ),
                        suggested_action="BLOCK - AI attempting to bypass via free-text",
                        enforcement="blocking"
                    )
                    result.requires_human = True
                    result.add_blocked_reason(
                        f"Hidden refund {amt} in '{field_name}' text"
                    )
                    enforced["customer_message"] = (
                        "Your case has been escalated to senior management for review. "
                        "We will contact you with next steps."
                    )
                    enforced["action"] = (
                        f"BLOCKED: Implicit refund {amt} detected in {field_name} "
                        f"(absolute ceiling: {absolute_block})"
                    )
                    enforced["action_type"] = "blocked_implicit_refund"
                    enforced["refund_amount"] = None
                    result.log(f"🚫 STRICT BLOCK: implicit refund {amt} in {field_name}")
                    return  # Stop on first match

    def _check_prohibited_actions(self, result, resolution, enforced):
        prohibited = self.policies.get("prohibited_actions", [])
        action = resolution.get("action", "").lower()
        action_type = resolution.get("action_type", "").lower()

        check_strings = [action, action_type]
        check_strings.append(str(resolution.get("internal_notes", "")).lower())
        check_strings.append(str(resolution.get("customer_message", "")).lower())
        check_strings.append(str(resolution.get("driver_action", "")).lower())

        for forbidden in prohibited:
            forbidden_lower = forbidden.lower().replace("_", " ")
            for s in check_strings:
                if forbidden_lower in s or forbidden.lower() in s:
                    result.add_violation(
                        rule="prohibited_action",
                        severity="critical",
                        message=f"AI attempted prohibited action: {forbidden}",
                        suggested_action="BLOCK immediately - escalate to senior management",
                        enforcement="blocking"
                    )
                    result.requires_human = True
                    result.add_blocked_reason(f"Prohibited action: {forbidden}")
                    enforced["action"] = f"BLOCKED: Prohibited action attempted ({forbidden})"
                    enforced["action_type"] = "blocked_prohibited"
                    enforced["refund_amount"] = None
                    enforced["customer_message"] = "Your request has been escalated to senior management for review."
                    result.log(f"🚫 STRICT BLOCK: prohibited '{forbidden}'")
                    return

    def _check_category_rules(self, result, classification, investigation, resolution, enforced):
        category = classification.get("category", "")
        rules = self.policies.get("category_rules", {}).get(category, {})

        if not rules.get("auto_resolve_allowed", True):
            result.add_violation(
                rule=f"category_{category}_no_auto_resolve",
                severity="high",
                message=f"Category '{category}' requires human review per policy",
                suggested_action="Route to human agent",
                enforcement="escalating"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Category '{category}' never auto-resolves")

        data_sources = investigation.get("data_sources", [])

        if rules.get("require_payment_data") and "GrabPay Transaction Records" not in data_sources:
            result.add_violation(
                rule=f"category_{category}_missing_payment_data",
                severity="high",
                message="Payment data required for this category but not collected",
                suggested_action="BLOCK until payment data gathered",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason("Required payment data missing")

        if rules.get("require_trip_data") and "Trip Database" not in data_sources:
            result.add_violation(
                rule=f"category_{category}_missing_trip_data",
                severity="high",
                message="Trip data required for this category but not collected",
                suggested_action="BLOCK until trip data gathered",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason("Required trip data missing")

        if rules.get("require_gps_data") and "GPS/Route Data" not in data_sources:
            result.add_violation(
                rule=f"category_{category}_missing_gps_data",
                severity="medium",
                message="GPS data required for this category but not collected",
                suggested_action="Gather GPS data before resolving",
                enforcement="escalating"
            )
            result.requires_human = True

        if rules.get("require_driver_data") and "Driver Profile Database" not in data_sources:
            result.add_violation(
                rule=f"category_{category}_missing_driver_data",
                severity="high",
                message="Driver data required for this category but not collected",
                suggested_action="BLOCK until driver data gathered",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason("Required driver data missing")

    def _check_driver_rules(self, result, resolution, investigation, enforced):
        rules = self.policies.get("driver_rules", {})
        action_type = resolution.get("action_type", "")

        if action_type == "driver_suspension" and not rules.get("ai_can_suspend", False):
            result.add_violation(
                rule="driver_suspension_not_allowed",
                severity="critical",
                message="AI cannot suspend drivers - requires human approval",
                suggested_action="Convert to driver_warning OR escalate",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason("AI cannot suspend drivers")
            enforced["action_type"] = "driver_warning"
            enforced["action"] = (
                f"BLOCKED: AI cannot suspend drivers. Converted to warning. "
                f"Senior approval required for suspension."
            )
            enforced["driver_action"] = "warning_only_pending_human_review"
            result.log(f"🛡️ STRICT: suspension → warning")

        driver_data = investigation.get("collected_data", {}).get("driver_data", {})
        if driver_data and driver_data.get("status") != "not_found":
            rating = driver_data.get("rating", 0)
            protected = rules.get("protected_rating_threshold", 4.5)

            if rating >= protected and action_type in ["driver_warning", "driver_suspension"]:
                result.add_violation(
                    rule="protected_driver_rating",
                    severity="high",
                    message=f"Driver rating {rating} above protected threshold {protected}",
                    suggested_action="Require additional investigation",
                    enforcement="blocking"
                )
                result.requires_human = True
                result.add_blocked_reason(f"Protected driver (rating: {rating})")
                enforced["driver_action"] = "no_action_protected_driver"
                if "driver" in enforced.get("action", "").lower():
                    enforced["action"] = (
                        f"BLOCKED: Protected driver (rating {rating}) - requires senior review"
                    )
                result.log(f"🛡️ STRICT: protected driver {rating}★")

    def _check_velocity(self, result, history, enforced):
        rules = self.policies.get("fraud_rules", {})
        max_24h = rules.get("max_tickets_24h", 5)
        tickets_24h = history.get("tickets_last_24h", 0)

        if tickets_24h >= max_24h:
            result.add_violation(
                rule="velocity_check_failed",
                severity="high",
                message=f"Customer submitted {tickets_24h} tickets in 24h (limit: {max_24h})",
                suggested_action="BLOCK - review for ticket abuse",
                enforcement="blocking"
            )
            result.requires_human = True
            result.add_blocked_reason(f"Velocity violation: {tickets_24h}/{max_24h} in 24h")
            if not enforced.get("action", "").startswith("BLOCKED"):
                enforced["action"] = f"BLOCKED: Velocity check failed ({tickets_24h} tickets in 24h)"
                enforced["action_type"] = "blocked_velocity"
                enforced["refund_amount"] = None
            result.log(f"🚫 STRICT VELOCITY: {tickets_24h}/{max_24h}")

    def _check_data_completeness(self, result, classification, investigation, enforced):
        """Strict: AI cannot resolve without sufficient evidence."""
        findings_count = len(investigation.get("findings", []))
        data_sources_count = len(investigation.get("data_sources", []))

        category = classification.get("category", "")
        if category in ["fare_dispute", "payment_issue"] and findings_count == 0 and data_sources_count > 0:
            result.add_violation(
                rule="insufficient_evidence",
                severity="medium",
                message=f"No findings detected for {category} - cannot auto-resolve without evidence",
                suggested_action="Manual review required - insufficient evidence",
                enforcement="escalating"
            )
            result.requires_human = True
            result.add_blocked_reason("Zero supporting findings")

    # ============================================================
    # STRICT ENFORCEMENT
    # ============================================================

    def _enforce_decision(self, result: PolicyResult, enforced: dict):
        """
        STRICT decision tree - no escape hatches.
        Priority: BLOCK > ESCALATE > MODIFY > APPROVE
        """
        critical_count = sum(1 for v in result.violations if v.severity == "critical")
        high_count = sum(1 for v in result.violations if v.severity == "high")
        medium_count = sum(1 for v in result.violations if v.severity == "medium")
        blocking_count = sum(1 for v in result.violations if v.enforcement == "blocking")

        # CRITICAL or any blocking → BLOCK
        if critical_count > 0 or blocking_count > 0:
            result.decision = PolicyDecision.BLOCK
            result.requires_human = True
            block_summary = "; ".join(result.blocked_reasons[:3])
            result.final_action = (
                f"🚫 BLOCKED BY POLICY: {block_summary}"
                if block_summary
                else "🚫 BLOCKED BY POLICY"
            )
            enforced["status"] = "blocked"
            result.log(f"🚫 STRICT DECISION: BLOCK ({critical_count} critical, {blocking_count} blocking)")

        elif high_count > 0:
            result.decision = PolicyDecision.ESCALATE
            result.requires_human = True
            result.final_action = f"🟡 ESCALATED: {high_count} high-severity policy concerns"
            enforced["status"] = "escalated"
            result.log(f"🟡 STRICT DECISION: ESCALATE ({high_count} high)")

        elif medium_count > 0 or result.requires_human or result.modifications:
            result.decision = PolicyDecision.MODIFY
            result.requires_human = True
            result.final_action = f"🔧 MODIFIED: {len(result.violations)} policy adjustments applied"
            enforced["status"] = "human_review"
            result.log(f"🔧 STRICT DECISION: MODIFY ({medium_count} medium)")

        else:
            result.decision = PolicyDecision.APPROVE
            result.final_action = enforced.get("action", "Approved")
            enforced["status"] = "auto_resolved"
            result.log(f"✅ STRICT DECISION: APPROVE (clean)")


# Global instance
policy_engine = PolicyEngine()