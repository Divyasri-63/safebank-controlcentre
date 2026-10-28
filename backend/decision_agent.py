"""
Decision Agent — Mandatory Intelligent Allocation Policy Engine
Coordinates input validation, Banker's safety check, resource-pressure analysis,
and applies deterministic policy rules with strict safety precedence.
"""

from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone
import uuid

from bankers import (
    vector_add, vector_sub, vector_le,
    run_safety_algorithm, create_state_snapshot,
    RESOURCE_NAMES, BLOCK_SIZE_MB, format_vector
)
from risk_analysis import (
    calculate_resource_pressure_score,
    predict_request
)
from models import (
    ResourceRequest, DecisionAgentResult,
    HeuristicScoreBreakdown, MLPrediction
)

# Policy thresholds (Configurable educational defaults)
POLICY_CONFIG = {
    "low_pressure_threshold": 30.0,
    "moderate_pressure_threshold": 60.0,
    "version": "1.0-deterministic-rule-engine",
    "description": "Banker's Algorithm safety gate with tiered pressure response (Approve, Review, Defer)."
}

POLICY_RULES = [
    {
        "precedence": "A",
        "condition": "Invalid Request (malformed, negative, exceeds remaining need, or inactive process)",
        "banker_check": "Not evaluated",
        "pressure_check": "Not evaluated",
        "action": "Reject",
        "allocation_committed": False,
        "rationale": "Prevents invalid memory bounds or processes claiming beyond declared maximum demand."
    },
    {
        "precedence": "B",
        "condition": "Insufficient Available Resources (Request > Available)",
        "banker_check": "Skipped (pre-condition failed)",
        "pressure_check": "Evaluated",
        "action": "Queue Request",
        "allocation_committed": False,
        "rationale": "Bank cannot allocate capacity it does not hold. Request waits in FIFO queue."
    },
    {
        "precedence": "C",
        "condition": "Unsafe Tentative Allocation (No safe completion sequence exists)",
        "banker_check": "Unsafe (Deadlock risk detected)",
        "pressure_check": "Evaluated",
        "action": "Queue Request (Unsafe)",
        "allocation_committed": False,
        "rationale": "Mandatory safety gate: allocation is refused to prevent potential deadlock. Original live allocations retained."
    },
    {
        "precedence": "D",
        "condition": "Verified Safe + Low Resource Pressure (Score <= 30.0)",
        "banker_check": "Safe (Completion order verified)",
        "pressure_check": "Low Pressure",
        "action": "Approve & Commit Allocation",
        "allocation_committed": True,
        "rationale": "System operates safely under low resource contention. Automatic grant approved."
    },
    {
        "precedence": "E",
        "condition": "Verified Safe + Moderate Resource Pressure (30.0 < Score <= 60.0)",
        "banker_check": "Safe (Completion order verified)",
        "pressure_check": "Moderate Pressure",
        "action": "Queue for Operator Review",
        "allocation_committed": False,
        "rationale": "Safe state, but moderate contention warrants human supervisor confirmation before reserving capacity."
    },
    {
        "precedence": "F",
        "condition": "Verified Safe + High Resource Pressure (Score > 60.0)",
        "banker_check": "Safe (Completion order verified)",
        "pressure_check": "High Pressure (Exhaustion risk)",
        "action": "Deferred by Pressure Policy",
        "allocation_committed": False,
        "rationale": "Safe in theory, but depletes key resource buffers. Policy defers request to protect overall bank throughput."
    }
]


def format_request_summary(proc_name: str, pid: str, req: List[int]) -> str:
    """Generates a plain-language summary of the request with explicit units."""
    return (
        f"{proc_name} ({pid}) requests {req[0]} CPU slot{'s' if req[0] != 1 else ''}, "
        f"{req[1]} memory block{'s' if req[1] != 1 else ''} ({req[1] * BLOCK_SIZE_MB} MB), "
        f"{req[2]} database connection{'s' if req[2] != 1 else ''}, and "
        f"{req[3]} lock slot{'s' if req[3] != 1 else ''}."
    )


def evaluate_banking_request(
    req_in: ResourceRequest,
    current_state: Dict[str, Any],
    past_history: List[Dict[str, Any]],
    request_id: Optional[str] = None
) -> DecisionAgentResult:
    """
    Main evaluation pipeline executed by the Decision Agent:
      1. Input validity & process status check
      2. Need boundary check (Request <= Need)
      3. Available capacity check (Request <= Available)
      4. Tentative state construction & Banker's Safety Algorithm
      5. Pre-decision Resource Pressure analysis
      6. Deterministic Policy application (Precedence A -> F)
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    req_id = request_id or f"REQ-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    total = current_state["total"]
    available = current_state["available"]
    allocated = current_state["allocated"]
    proc_dict = {p["id"]: p for p in current_state["processes"]}
    pre_snapshot = create_state_snapshot(total, available, current_state["processes"])

    # -------------------------------------------------------------
    # Step 1: Validate Process Existence & Status (Precedence A)
    # -------------------------------------------------------------
    if req_in.process_id not in proc_dict:
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=req_in.process_id,
            process_name="Unknown Service",
            request=req_in.request,
            banker_status="Not evaluated",
            pressure_score=0.0,
            pressure_level="N/A",
            agent_decision="Invalid Request",
            decision_reason=f"Process ID '{req_in.process_id}' does not exist in the bank's active registry.",
            safe_sequence=[],
            unfinished_processes=[],
            state_changed=False,
            trace=[],
            pre_state=pre_snapshot,
            heuristic_analysis=HeuristicScoreBreakdown(
                score=0.0, level="N/A", utilization_max=0, utilization_contrib=0,
                available_share_max=0, share_contrib=0, exhaustion_ratio=0,
                exhaustion_contrib=0, process_deferral_rate=0, deferral_contrib=0,
                explanation="Input validation rejected: unknown process."
            )
        )

    proc = proc_dict[req_in.process_id]
    proc_name = proc["name"]

    if proc["status"] != "ACTIVE":
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Not evaluated",
            pressure_score=0.0,
            pressure_level="N/A",
            agent_decision="Invalid Request",
            decision_reason=f"Service {proc_name} ({proc['id']}) is already COMPLETED and cannot claim computing resources.",
            safe_sequence=[],
            unfinished_processes=[],
            state_changed=False,
            trace=[],
            pre_state=pre_snapshot,
            heuristic_analysis=HeuristicScoreBreakdown(
                score=0.0, level="N/A", utilization_max=0, utilization_contrib=0,
                available_share_max=0, share_contrib=0, exhaustion_ratio=0,
                exhaustion_contrib=0, process_deferral_rate=0, deferral_contrib=0,
                explanation="Input validation rejected: process already completed."
            )
        )

    # Check for all-zero request
    if req_in.request == [0, 0, 0, 0]:
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Not evaluated",
            pressure_score=0.0,
            pressure_level="N/A",
            agent_decision="Invalid Request",
            decision_reason="All-zero request [0, 0, 0, 0] rejected. Services must request at least one computing unit.",
            safe_sequence=[],
            unfinished_processes=[],
            state_changed=False,
            trace=[],
            pre_state=pre_snapshot,
            heuristic_analysis=HeuristicScoreBreakdown(
                score=0.0, level="N/A", utilization_max=0, utilization_contrib=0,
                available_share_max=0, share_contrib=0, exhaustion_ratio=0,
                exhaustion_contrib=0, process_deferral_rate=0, deferral_contrib=0,
                explanation="All-zero request carries zero resource pressure."
            )
        )

    # -------------------------------------------------------------
    # Step 2: Resource Pressure & Advisory ML Calculation (Pre-decision features)
    # -------------------------------------------------------------
    heuristic_res = calculate_resource_pressure_score(
        total=total,
        available=available,
        current_allocated=allocated,
        request=req_in.request,
        process_id=proc["id"],
        past_requests=past_history
    )

    ml_pred = predict_request(
        total=total,
        available=available,
        allocated=allocated,
        request=req_in.request,
        need=proc["need"],
        deferral_rate=heuristic_res.process_deferral_rate
    )

    # -------------------------------------------------------------
    # Step 3: Check Request <= Need (Precedence A)
    # -------------------------------------------------------------
    p_need = proc["need"]
    exceeds_need = [
        f"{RESOURCE_NAMES[j]} (requested {req_in.request[j]} > remaining need {p_need[j]})"
        for j in range(4)
        if req_in.request[j] > p_need[j]
    ]
    if exceeds_need:
        reason_str = (
            f"Invalid request: {proc_name} ({proc['id']}) requested {format_vector(req_in.request)}, "
            f"which exceeds its declared remaining need {format_vector(p_need)}. "
            f"Violations: {'; '.join(exceeds_need)}. "
            "Under Banker's Algorithm, a process can never exceed its declared maximum claim."
        )
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Not evaluated",
            pressure_score=heuristic_res.score,
            pressure_level=heuristic_res.level,
            agent_decision="Invalid Request",
            decision_reason=reason_str,
            safe_sequence=[],
            unfinished_processes=[],
            state_changed=False,
            trace=[],
            pre_state=pre_snapshot,
            post_state=pre_snapshot,
            heuristic_analysis=heuristic_res,
            ml_prediction=ml_pred
        )

    # -------------------------------------------------------------
    # Step 4: Check Request <= Available (Precedence B)
    # -------------------------------------------------------------
    exceeds_avail = [
        f"{RESOURCE_NAMES[j]} (requested {req_in.request[j]} > available {available[j]})"
        for j in range(4)
        if req_in.request[j] > available[j]
    ]
    if exceeds_avail:
        reason_str = (
            f"Insufficient available capacity: {proc_name} requested {format_vector(req_in.request)}, "
            f"but current available capacity is {format_vector(available)}. "
            f"Deficit in: {'; '.join(exceeds_avail)}. "
            "The Decision Agent placed the request in the Waiting Queue. Live allocations remain unchanged."
        )
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Skipped",
            pressure_score=heuristic_res.score,
            pressure_level=heuristic_res.level,
            agent_decision="Queued — Insufficient Resources",
            decision_reason=reason_str,
            safe_sequence=[],
            unfinished_processes=[],
            state_changed=False,
            trace=[],
            pre_state=pre_snapshot,
            post_state=pre_snapshot,
            heuristic_analysis=heuristic_res,
            ml_prediction=ml_pred
        )

    # -------------------------------------------------------------
    # Step 5: Tentative Allocation & Mandatory Banker's Safety Check
    # -------------------------------------------------------------
    tentative_available = vector_sub(available, req_in.request)
    tentative_allocs = dict(current_state["active_allocs"])
    tentative_allocs[proc["id"]] = vector_add(tentative_allocs[proc["id"]], req_in.request)
    tentative_needs = dict(current_state["active_needs"])
    tentative_needs[proc["id"]] = vector_sub(tentative_needs[proc["id"]], req_in.request)

    tentative_procs = []
    for p in current_state["processes"]:
        tp = dict(p)
        if tp["id"] == proc["id"]:
            tp["alloc"] = tentative_allocs[proc["id"]]
            tp["need"] = tentative_needs[proc["id"]]
        tentative_procs.append(tp)

    tentative_snapshot = create_state_snapshot(total, tentative_available, tentative_procs)

    safety_res = run_safety_algorithm(
        tentative_available,
        tentative_allocs,
        tentative_needs,
        current_state["active_names"]
    )

    # -------------------------------------------------------------
    # Step 6: Apply Policy Precedence (C -> D -> E -> F)
    # -------------------------------------------------------------

    # Policy C: Unsafe tentative allocation
    if not safety_res.is_safe:
        unfin_names = [
            f"{current_state['active_names'].get(uid, uid)} ({uid})"
            for uid in safety_res.unfinished_processes
        ]
        reason_str = (
            f"Resources are available, but the tentative allocation leaves no safe completion order. "
            f"Blocked processes under declared claims: {', '.join(unfin_names)}. "
            "To prevent potential deadlock, the Decision Agent queued the request. Live allocations remain unchanged."
        )
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Unsafe",
            pressure_score=heuristic_res.score,
            pressure_level=heuristic_res.level,
            agent_decision="Queued — Unsafe Result",
            decision_reason=reason_str,
            safe_sequence=[],
            unfinished_processes=safety_res.unfinished_processes,
            state_changed=False,
            trace=safety_res.trace,
            pre_state=pre_snapshot,
            tentative_state=tentative_snapshot,
            post_state=pre_snapshot,
            heuristic_analysis=heuristic_res,
            ml_prediction=ml_pred
        )

    # Banker's Check Passed! System is verified SAFE.
    safe_seq_str = " → ".join(safety_res.safe_sequence)

    # Policy D: Safe request with Low Pressure (Score <= 30.0) -> Approve & Commit
    if heuristic_res.score <= POLICY_CONFIG["low_pressure_threshold"]:
        reason_str = (
            f"Resources are available, and all processes can still finish in a safe order ({safe_seq_str}). "
            f"Resource pressure is low ({heuristic_res.score}/100), so the Decision Agent approved and committed the allocation."
        )
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Safe",
            pressure_score=heuristic_res.score,
            pressure_level=heuristic_res.level,
            agent_decision="Approved",
            decision_reason=reason_str,
            safe_sequence=safety_res.safe_sequence,
            unfinished_processes=[],
            state_changed=True,
            trace=safety_res.trace,
            pre_state=pre_snapshot,
            tentative_state=tentative_snapshot,
            post_state=tentative_snapshot,
            heuristic_analysis=heuristic_res,
            ml_prediction=ml_pred
        )

    # Policy E: Safe request with Moderate Pressure (30.0 < Score <= 60.0) -> Queue for Review
    elif heuristic_res.score <= POLICY_CONFIG["moderate_pressure_threshold"]:
        reason_str = (
            f"Banker's check verified a safe execution sequence ({safe_seq_str}), "
            f"but resource pressure is moderate ({heuristic_res.score}/100). "
            "Under bank policy, the Decision Agent queued this request for operator review. "
            "An operator can authorize allocation after a fresh safety check against live state."
        )
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Safe",
            pressure_score=heuristic_res.score,
            pressure_level=heuristic_res.level,
            agent_decision="Review Required",
            decision_reason=reason_str,
            safe_sequence=safety_res.safe_sequence,
            unfinished_processes=[],
            state_changed=False,
            trace=safety_res.trace,
            pre_state=pre_snapshot,
            tentative_state=tentative_snapshot,
            post_state=pre_snapshot,
            heuristic_analysis=heuristic_res,
            ml_prediction=ml_pred
        )

    # Policy F: Safe request with High Pressure (Score > 60.0) -> Defer under Pressure Policy
    else:
        reason_str = (
            f"Banker's check passed with safe sequence ({safe_seq_str}), "
            f"but resource pressure is high ({heuristic_res.score}/100). "
            "The Decision Agent deferred the request under the configured pressure policy to protect operational throughput. "
            "Live allocations remain unchanged."
        )
        return DecisionAgentResult(
            request_id=req_id,
            timestamp=timestamp,
            process_id=proc["id"],
            process_name=proc_name,
            request=req_in.request,
            banker_status="Safe",
            pressure_score=heuristic_res.score,
            pressure_level=heuristic_res.level,
            agent_decision="Deferred by Pressure Policy",
            decision_reason=reason_str,
            safe_sequence=safety_res.safe_sequence,
            unfinished_processes=[],
            state_changed=False,
            trace=safety_res.trace,
            pre_state=pre_snapshot,
            tentative_state=tentative_snapshot,
            post_state=pre_snapshot,
            heuristic_analysis=heuristic_res,
            ml_prediction=ml_pred
        )
