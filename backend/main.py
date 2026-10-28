"""
SafeBank — Bank Operations Control Centre API
Backend server orchestrating Banker's Algorithm, Resource-Pressure Analysis,
Mandatory Decision Agent, Persistent Waiting Queue, and Classroom Demonstration Engine.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_connection, db_lock
from models import (
    ProcessCreate, ResourceRequest, ProcessView,
    DecisionAgentResult, QueueItemView, SystemStateResponse,
    HeuristicScoreBreakdown, MLPrediction, SafetyStep
)
from bankers import (
    vector_add, vector_sub, vector_le,
    run_safety_algorithm, create_state_snapshot,
    RESOURCE_NAMES, BLOCK_SIZE_MB, format_vector
)
from risk_analysis import (
    calculate_resource_pressure_score,
    predict_request,
    train_simulator_decision_tree,
    MODEL_METRICS
)
from decision_agent import (
    evaluate_banking_request,
    POLICY_CONFIG,
    POLICY_RULES,
    format_request_summary
)
from seed_data import (
    reset_to_banking_seed,
    ensure_initialized,
    CLASSROOM_DEMOS
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_initialized()
    try:
        train_simulator_decision_tree()
    except Exception as e:
        print(f"Advisory ML initialization note: {e}")
    yield


app = FastAPI(
    title="SafeBank — Bank Operations Control Centre API",
    description="Intelligent resource management and deadlock prevention using Banker's Algorithm with Decision Agent.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_current_state(conn) -> Dict[str, Any]:
    """Helper to read current system capacity, active processes, and derive live available vector."""
    cursor = conn.cursor()
    cursor.execute("SELECT r0_total, r1_total, r2_total, r3_total, block_size_mb FROM system_config WHERE id = 1;")
    cfg = cursor.fetchone()
    if not cfg:
        raise HTTPException(status_code=500, detail="System configuration not initialized.")
    total = [cfg["r0_total"], cfg["r1_total"], cfg["r2_total"], cfg["r3_total"]]
    block_size_mb = cfg["block_size_mb"]

    cursor.execute("""
        SELECT id, name, service_type, r0_max, r1_max, r2_max, r3_max,
               r0_alloc, r1_alloc, r2_alloc, r3_alloc, status
        FROM processes
        ORDER BY id ASC;
    """)
    rows = cursor.fetchall()

    processes = []
    active_alloc_sum = [0, 0, 0, 0]
    active_names = {}
    active_allocs = {}
    active_needs = {}

    for r in rows:
        max_v = [r["r0_max"], r["r1_max"], r["r2_max"], r["r3_max"]]
        alloc_v = [r["r0_alloc"], r["r1_alloc"], r["r2_alloc"], r["r3_alloc"]]
        need_v = vector_sub(max_v, alloc_v)
        p_data = {
            "id": r["id"],
            "name": r["name"],
            "service_type": r["service_type"],
            "max": max_v,
            "alloc": alloc_v,
            "need": need_v,
            "status": r["status"]
        }
        processes.append(p_data)
        if r["status"] == "ACTIVE":
            active_alloc_sum = vector_add(active_alloc_sum, alloc_v)
            active_names[r["id"]] = r["name"]
            active_allocs[r["id"]] = alloc_v
            active_needs[r["id"]] = need_v

    available = vector_sub(total, active_alloc_sum)

    # Run Banker's safety check on current live state
    safety_res = run_safety_algorithm(
        available,
        active_allocs,
        active_needs,
        active_names
    )

    return {
        "total": total,
        "allocated": active_alloc_sum,
        "available": available,
        "block_size_mb": block_size_mb,
        "is_safe": safety_res.is_safe,
        "safe_sequence": safety_res.safe_sequence,
        "safety_trace": safety_res.trace,
        "processes": processes,
        "active_names": active_names,
        "active_allocs": active_allocs,
        "active_needs": active_needs
    }


def reevaluate_waiting_queue(conn) -> List[Dict[str, Any]]:
    """
    Re-evaluates waiting requests in FIFO order after resource release.
    Prevents duplicate grants and re-validates fresh state for each candidate.
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, request_id, process_id, process_name,
               r0_req, r1_req, r2_req, r3_req, review_status, retry_count
        FROM waiting_queue
        ORDER BY id ASC;
    """)
    queue_items = cursor.fetchall()
    eval_results = []

    for item in queue_items:
        current_state = fetch_current_state(conn)
        req_vector = [item["r0_req"], item["r1_req"], item["r2_req"], item["r3_req"]]

        cursor.execute("SELECT process_id, agent_decision FROM request_history;")
        past_hist = [dict(r) for r in cursor.fetchall()]

        req_obj = ResourceRequest(process_id=item["process_id"], request=req_vector)
        res = evaluate_banking_request(req_obj, current_state, past_hist, request_id=item["request_id"])

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        if res.agent_decision == "Approved":
            # Commit allocation to DB
            proc = next(p for p in current_state["processes"] if p["id"] == item["process_id"])
            new_alloc = vector_add(proc["alloc"], req_vector)
            cursor.execute("""
                UPDATE processes
                SET r0_alloc = ?, r1_alloc = ?, r2_alloc = ?, r3_alloc = ?
                WHERE id = ?;
            """, (*new_alloc, item["process_id"]))

            # Remove from waiting queue
            cursor.execute("DELETE FROM waiting_queue WHERE id = ?;", (item["id"],))

            # Record in history
            cursor.execute("""
                INSERT INTO request_history (
                    request_id, timestamp, process_id, process_name,
                    r0_req, r1_req, r2_req, r3_req,
                    banker_status, pressure_score, pressure_level,
                    agent_decision, decision_reason, state_changed,
                    safe_sequence_json, trace_json,
                    pre_state_json, tentative_state_json, post_state_json,
                    pressure_breakdown_json, ml_prediction_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                res.request_id, timestamp, res.process_id, res.process_name,
                *req_vector,
                res.banker_status, res.pressure_score, res.pressure_level,
                res.agent_decision, f"[Queue Retry Granted] {res.decision_reason}", 1,
                json.dumps(res.safe_sequence),
                json.dumps([t.model_dump() for t in res.trace]),
                json.dumps(res.pre_state), json.dumps(res.tentative_state), json.dumps(res.post_state),
                json.dumps(res.heuristic_analysis.model_dump()),
                json.dumps(res.ml_prediction.model_dump() if res.ml_prediction else None)
            ))

            eval_results.append({
                "request_id": item["request_id"],
                "process_id": item["process_id"],
                "decision": "Approved",
                "reason": "Queue retry approved and committed."
            })
        else:
            # Increment retry count and update pressure assessment
            cursor.execute("""
                UPDATE waiting_queue
                SET retry_count = retry_count + 1,
                    last_evaluated_at = ?,
                    pressure_score = ?,
                    pressure_level = ?,
                    banker_status = ?
                WHERE id = ?;
            """, (timestamp, res.pressure_score, res.pressure_level, res.banker_status, item["id"]))

            eval_results.append({
                "request_id": item["request_id"],
                "process_id": item["process_id"],
                "decision": res.agent_decision,
                "reason": "Still blocked under current state."
            })

    conn.commit()
    return eval_results


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/state", response_model=SystemStateResponse)
def get_system_state():
    """Returns current live system state, active/completed processes, waiting count, and safe sequence."""
    with db_lock:
        conn = get_connection()
        try:
            state = fetch_current_state(conn)
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM waiting_queue;")
            waiting_c = cursor.fetchone()[0]

            cursor.execute("SELECT agent_decision FROM request_history;")
            hist_rows = cursor.fetchall()

            approved_c = sum(1 for r in hist_rows if r["agent_decision"] == "Approved")
            queued_c = sum(1 for r in hist_rows if "Queued" in r["agent_decision"])
            deferred_c = sum(1 for r in hist_rows if "Deferred" in r["agent_decision"])
            invalid_c = sum(1 for r in hist_rows if "Invalid" in r["agent_decision"])

            active_c = sum(1 for p in state["processes"] if p["status"] == "ACTIVE")
            completed_c = sum(1 for p in state["processes"] if p["status"] == "COMPLETED")

            proc_views = [
                ProcessView(
                    id=p["id"],
                    name=p["name"],
                    max=p["max"],
                    alloc=p["alloc"],
                    need=p["need"],
                    status=p["status"]
                ) for p in state["processes"]
            ]

            return SystemStateResponse(
                total=state["total"],
                allocated=state["allocated"],
                available=state["available"],
                is_safe=state["is_safe"],
                safe_sequence=state["safe_sequence"],
                safety_trace=state["safety_trace"],
                active_count=active_c,
                completed_count=completed_c,
                waiting_count=waiting_c,
                block_size_mb=state["block_size_mb"],
                processes=proc_views,
                summary_stats={
                    "total_requests": len(hist_rows),
                    "approved_count": approved_c,
                    "queued_count": queued_c,
                    "deferred_count": deferred_c,
                    "invalid_count": invalid_c,
                    "waiting_queue_active": waiting_c
                }
            )
        finally:
            conn.close()


@app.get("/api/processes")
def list_processes():
    """Returns all banking service processes."""
    with db_lock:
        conn = get_connection()
        try:
            state = fetch_current_state(conn)
            return state["processes"]
        finally:
            conn.close()


@app.post("/api/processes", status_code=status.HTTP_201_CREATED)
def create_process(proc_in: ProcessCreate):
    """
    Admits a new banking service workflow with declared 4-resource maximum claim.
    Validates claim against total capacity and ensures admission preserves safety.
    """
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM processes WHERE id = ?;", (proc_in.id,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Service with ID '{proc_in.id}' already exists.")

            state = fetch_current_state(conn)
            total = state["total"]

            for j in range(4):
                if proc_in.max_demand[j] > total[j]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Claim for {RESOURCE_NAMES[j]} ({proc_in.max_demand[j]}) exceeds total capacity ({total[j]})."
                    )

            tentative_allocs = dict(state["active_allocs"])
            tentative_allocs[proc_in.id] = [0, 0, 0, 0]
            tentative_needs = dict(state["active_needs"])
            tentative_needs[proc_in.id] = list(proc_in.max_demand)
            tentative_names = dict(state["active_names"])
            tentative_names[proc_in.id] = proc_in.name

            safety_check = run_safety_algorithm(
                state["available"],
                tentative_allocs,
                tentative_needs,
                tentative_names
            )

            if not safety_check.is_safe:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot admit service: declared maximum demand immediately creates an unsafe state."
                )

            cursor.execute("""
                INSERT INTO processes (
                    id, name, service_type,
                    r0_max, r1_max, r2_max, r3_max,
                    r0_alloc, r1_alloc, r2_alloc, r3_alloc,
                    status
                ) VALUES (?, ?, 'Custom', ?, ?, ?, ?, 0, 0, 0, 0, 'ACTIVE');
            """, (proc_in.id, proc_in.name, *proc_in.max_demand))
            conn.commit()

            return {"message": f"Service {proc_in.name} ({proc_in.id}) admitted safely.", "is_safe": True}
        finally:
            conn.close()


@app.post("/api/processes/{process_id}/complete")
def complete_process(process_id: str):
    """
    Completes a running job, releases all its allocated resources back to Available,
    records the completion event in Audit History, and automatically triggers waiting queue re-evaluation.
    """
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, r0_alloc, r1_alloc, r2_alloc, r3_alloc, status
                FROM processes WHERE id = ?;
            """, (process_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Service '{process_id}' not found.")
            if row["status"] != "ACTIVE":
                raise HTTPException(status_code=400, detail=f"Service '{process_id}' is already {row['status']}.")

            released = [row["r0_alloc"], row["r1_alloc"], row["r2_alloc"], row["r3_alloc"]]

            # 1. Capture snapshot before completion & release
            pre_state_obj = fetch_current_state(conn)
            pre_snapshot = create_state_snapshot(
                pre_state_obj["total"], pre_state_obj["available"], pre_state_obj["processes"]
            )

            # 2. Complete the process and release all its allocations
            cursor.execute("""
                UPDATE processes
                SET status = 'COMPLETED', r0_alloc = 0, r1_alloc = 0, r2_alloc = 0, r3_alloc = 0
                WHERE id = ?;
            """, (process_id,))
            conn.commit()

            # 3. Capture snapshot after release (Available capacity has expanded)
            post_state_obj = fetch_current_state(conn)
            post_snapshot = create_state_snapshot(
                post_state_obj["total"], post_state_obj["available"], post_state_obj["processes"]
            )

            # 4. Automatically trigger FIFO queue re-evaluation
            queue_reeval = reevaluate_waiting_queue(conn)

            # Summarize queue re-evaluation outcome
            granted_items = [q for q in queue_reeval if q.get("decision") == "Approved"]
            if granted_items:
                granted_pids = ", ".join([str(q.get("process_id", "")) for q in granted_items])
                queue_desc = f"{len(granted_items)} queued request(s) granted ({granted_pids})"
            elif queue_reeval:
                queue_desc = f"{len(queue_reeval)} queued request(s) re-evaluated; waiting for further capacity"
            else:
                queue_desc = "No queued requests pending in FIFO waiting queue"

            # 5. Calculate post-release resource pressure score
            pressure_calc = calculate_resource_pressure_score(
                total=post_state_obj["total"],
                available=post_state_obj["available"],
                current_allocated=post_state_obj["allocated"],
                request=[0, 0, 0, 0],
                process_id=process_id,
                past_requests=[]
            )

            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            req_id = f"REL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
            safe_seq_str = " → ".join(post_state_obj["safe_sequence"]) if post_state_obj["safe_sequence"] else "None (all jobs complete)"

            decision_reason = (
                f"Job '{row['name']}' ({process_id}) completed execution and successfully released all allocated resources "
                f"{format_vector(released)} back to the Available pool (Available increased from {format_vector(pre_state_obj['available'])} "
                f"to {format_vector(post_state_obj['available'])}). Banker's safety verified with remaining safe sequence: {safe_seq_str}. "
                f"Automatic queue re-evaluation triggered ({queue_desc})."
            )

            # 6. Record the Complete & Release transaction in request_history (Audit Trail)
            cursor.execute("""
                INSERT INTO request_history (
                    request_id, timestamp, process_id, process_name,
                    r0_req, r1_req, r2_req, r3_req,
                    banker_status, pressure_score, pressure_level,
                    agent_decision, decision_reason, state_changed,
                    safe_sequence_json, trace_json,
                    pre_state_json, tentative_state_json, post_state_json,
                    pressure_breakdown_json, ml_prediction_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                req_id,
                timestamp,
                process_id,
                row["name"],
                *released,
                "Safe",
                pressure_calc.score,
                pressure_calc.level,
                "Completed & Released",
                decision_reason,
                1,
                json.dumps(post_state_obj["safe_sequence"]),
                json.dumps([t.model_dump() for t in post_state_obj["safety_trace"]]),
                json.dumps(pre_snapshot),
                json.dumps(post_snapshot),
                json.dumps(post_snapshot),
                json.dumps(pressure_calc.model_dump()),
                None
            ))
            conn.commit()

            return {
                "message": f"Job '{row['name']}' ({process_id}) completed successfully.",
                "request_id": req_id,
                "released_resources": released,
                "released_formatted": format_vector(released),
                "status": "COMPLETED",
                "queue_reevaluation": queue_reeval,
                "queue_description": queue_desc,
                "safe_sequence": post_state_obj["safe_sequence"],
                "available_now": post_state_obj["available"]
            }
        finally:
            conn.close()


@app.post("/api/requests", response_model=DecisionAgentResult)
def submit_resource_request(req_in: ResourceRequest):
    """
    Submits a resource request to the Decision Agent:
      - Mandatory participation of Decision Agent
      - Input validity check
      - Banker's Safety Check
      - Pre-decision Resource Pressure scoring
      - Deterministic policy precedence
      - Commits allocation if approved, or persists to Waiting Queue if blocked
      - Immutable audit trail recording
    """
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            current_state = fetch_current_state(conn)

            # Retrieve past requests for process deferral rate calculation
            cursor.execute("SELECT process_id, agent_decision FROM request_history;")
            past_hist = [dict(r) for r in cursor.fetchall()]

            # Evaluate through the real Decision Agent
            decision_result = evaluate_banking_request(req_in, current_state, past_hist)

            # Persist action based on decision
            if decision_result.agent_decision == "Approved":
                # Commit allocation to DB
                proc = next(p for p in current_state["processes"] if p["id"] == req_in.process_id)
                new_alloc = vector_add(proc["alloc"], req_in.request)
                cursor.execute("""
                    UPDATE processes
                    SET r0_alloc = ?, r1_alloc = ?, r2_alloc = ?, r3_alloc = ?
                    WHERE id = ?;
                """, (*new_alloc, req_in.process_id))

            elif decision_result.agent_decision in [
                "Queued — Insufficient Resources",
                "Queued — Unsafe Result",
                "Review Required"
            ]:
                # Insert into persistent Waiting Queue
                review_stat = "REVIEW_REQUIRED" if decision_result.agent_decision == "Review Required" else "PENDING"
                cursor.execute("""
                    INSERT INTO waiting_queue (
                        request_id, process_id, process_name,
                        r0_req, r1_req, r2_req, r3_req,
                        queue_reason, submission_time, retry_count, review_status,
                        pressure_score, pressure_level, banker_status, last_evaluated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?);
                """, (
                    decision_result.request_id,
                    decision_result.process_id,
                    decision_result.process_name,
                    *req_in.request,
                    decision_result.decision_reason,
                    decision_result.timestamp,
                    review_stat,
                    decision_result.pressure_score,
                    decision_result.pressure_level,
                    decision_result.banker_status,
                    decision_result.timestamp
                ))

            # Record in request history (audit trail)
            cursor.execute("""
                INSERT INTO request_history (
                    request_id, timestamp, process_id, process_name,
                    r0_req, r1_req, r2_req, r3_req,
                    banker_status, pressure_score, pressure_level,
                    agent_decision, decision_reason, state_changed,
                    safe_sequence_json, trace_json,
                    pre_state_json, tentative_state_json, post_state_json,
                    pressure_breakdown_json, ml_prediction_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                decision_result.request_id,
                decision_result.timestamp,
                decision_result.process_id,
                decision_result.process_name,
                *req_in.request,
                decision_result.banker_status,
                decision_result.pressure_score,
                decision_result.pressure_level,
                decision_result.agent_decision,
                decision_result.decision_reason,
                1 if decision_result.state_changed else 0,
                json.dumps(decision_result.safe_sequence),
                json.dumps([t.model_dump() for t in decision_result.trace]),
                json.dumps(decision_result.pre_state),
                json.dumps(decision_result.tentative_state),
                json.dumps(decision_result.post_state),
                json.dumps(decision_result.heuristic_analysis.model_dump()),
                json.dumps(decision_result.ml_prediction.model_dump() if decision_result.ml_prediction else None)
            ))

            conn.commit()
            return decision_result
        finally:
            conn.close()


@app.get("/api/queue", response_model=List[QueueItemView])
def get_waiting_queue():
    """Returns all queued requests with waiting duration, retry count, and review status."""
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, request_id, process_id, process_name,
                       r0_req, r1_req, r2_req, r3_req,
                       queue_reason, submission_time, retry_count, review_status,
                       pressure_score, pressure_level, banker_status, last_evaluated_at
                FROM waiting_queue
                ORDER BY id ASC;
            """)
            rows = cursor.fetchall()
            now = datetime.now(timezone.utc)

            items = []
            for r in rows:
                try:
                    sub_dt = datetime.strptime(r["submission_time"], "%Y-%m-%d %H:%M:%S UTC").replace(tzinfo=timezone.utc)
                    wait_sec = int((now - sub_dt).total_seconds())
                except Exception:
                    wait_sec = 0

                is_long_wait = wait_sec > 180  # flagged if waiting > 3 minutes

                items.append(QueueItemView(
                    id=r["id"],
                    request_id=r["request_id"],
                    process_id=r["process_id"],
                    process_name=r["process_name"],
                    request=[r["r0_req"], r["r1_req"], r["r2_req"], r["r3_req"]],
                    queue_reason=r["queue_reason"],
                    submission_time=r["submission_time"],
                    retry_count=r["retry_count"],
                    review_status=r["review_status"],
                    pressure_score=r["pressure_score"],
                    pressure_level=r["pressure_level"],
                    banker_status=r["banker_status"],
                    wait_duration_sec=wait_sec,
                    is_long_wait=is_long_wait
                ))
            return items
        finally:
            conn.close()


@app.post("/api/queue/{request_id}/retry")
def retry_queue_item(request_id: str):
    """
    Retries an individual queued request against current live state.
    Repeats Need check, Banker's check, and Decision Agent policy.
    """
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, request_id, process_id, process_name,
                       r0_req, r1_req, r2_req, r3_req, retry_count
                FROM waiting_queue WHERE request_id = ?;
            """, (request_id,))
            item = cursor.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail=f"Queued request '{request_id}' not found.")

            current_state = fetch_current_state(conn)
            req_vector = [item["r0_req"], item["r1_req"], item["r2_req"], item["r3_req"]]

            cursor.execute("SELECT process_id, agent_decision FROM request_history;")
            past_hist = [dict(r) for r in cursor.fetchall()]

            req_obj = ResourceRequest(process_id=item["process_id"], request=req_vector)
            res = evaluate_banking_request(req_obj, current_state, past_hist, request_id=item["request_id"])

            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

            if res.agent_decision == "Approved":
                proc = next(p for p in current_state["processes"] if p["id"] == item["process_id"])
                new_alloc = vector_add(proc["alloc"], req_vector)
                cursor.execute("""
                    UPDATE processes
                    SET r0_alloc = ?, r1_alloc = ?, r2_alloc = ?, r3_alloc = ?
                    WHERE id = ?;
                """, (*new_alloc, item["process_id"]))

                cursor.execute("DELETE FROM waiting_queue WHERE id = ?;", (item["id"],))

                cursor.execute("""
                    INSERT INTO request_history (
                        request_id, timestamp, process_id, process_name,
                        r0_req, r1_req, r2_req, r3_req,
                        banker_status, pressure_score, pressure_level,
                        agent_decision, decision_reason, state_changed,
                        safe_sequence_json, trace_json,
                        pre_state_json, tentative_state_json, post_state_json,
                        pressure_breakdown_json, ml_prediction_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    res.request_id, timestamp, res.process_id, res.process_name,
                    *req_vector,
                    res.banker_status, res.pressure_score, res.pressure_level,
                    res.agent_decision, f"[Manual Retry Granted] {res.decision_reason}", 1,
                    json.dumps(res.safe_sequence),
                    json.dumps([t.model_dump() for t in res.trace]),
                    json.dumps(res.pre_state), json.dumps(res.tentative_state), json.dumps(res.post_state),
                    json.dumps(res.heuristic_analysis.model_dump()),
                    json.dumps(res.ml_prediction.model_dump() if res.ml_prediction else None)
                ))
                conn.commit()
                return {"message": "Request granted and allocation committed.", "result": res}
            else:
                cursor.execute("""
                    UPDATE waiting_queue
                    SET retry_count = retry_count + 1,
                        last_evaluated_at = ?,
                        pressure_score = ?,
                        pressure_level = ?,
                        banker_status = ?
                    WHERE id = ?;
                """, (timestamp, res.pressure_score, res.pressure_level, res.banker_status, item["id"]))
                conn.commit()
                return {"message": "Request still blocked under current state.", "result": res}
        finally:
            conn.close()


@app.post("/api/queue/retry-all")
def retry_all_queue():
    """Re-evaluates all waiting requests in FIFO order."""
    with db_lock:
        conn = get_connection()
        try:
            results = reevaluate_waiting_queue(conn)
            return {"message": "All queue requests re-evaluated.", "results": results}
        finally:
            conn.close()


@app.post("/api/queue/{request_id}/review-approve")
def operator_review_approve(request_id: str):
    """
    Operator review approval action.
    MANDATORY GATE: An operator cannot bypass Banker's safety validation.
    The backend repeats the safety check against latest state before authorizing commitment.
    """
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, request_id, process_id, process_name,
                       r0_req, r1_req, r2_req, r3_req, review_status
                FROM waiting_queue WHERE request_id = ?;
            """, (request_id,))
            item = cursor.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail=f"Request '{request_id}' not found in waiting queue.")

            current_state = fetch_current_state(conn)
            req_vector = [item["r0_req"], item["r1_req"], item["r2_req"], item["r3_req"]]

            # Check capacity
            if not vector_le(req_vector, current_state["available"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot approve: Insufficient capacity available ({current_state['available']}) for request ({req_vector})."
                )

            # Mandatory Banker's check on tentative state
            tentative_avail = vector_sub(current_state["available"], req_vector)
            tentative_allocs = dict(current_state["active_allocs"])
            tentative_allocs[item["process_id"]] = vector_add(tentative_allocs[item["process_id"]], req_vector)
            tentative_needs = dict(current_state["active_needs"])
            tentative_needs[item["process_id"]] = vector_sub(tentative_needs[item["process_id"]], req_vector)

            safety_res = run_safety_algorithm(
                tentative_avail,
                tentative_allocs,
                tentative_needs,
                current_state["active_names"]
            )

            if not safety_res.is_safe:
                raise HTTPException(
                    status_code=400,
                    detail="OPERATOR OVERRIDE REFUSED: Tentative allocation leaves system in an UNSAFE state. Safety gate is mandatory."
                )

            # Safe! Commit allocation
            proc = next(p for p in current_state["processes"] if p["id"] == item["process_id"])
            new_alloc = vector_add(proc["alloc"], req_vector)
            cursor.execute("""
                UPDATE processes
                SET r0_alloc = ?, r1_alloc = ?, r2_alloc = ?, r3_alloc = ?
                WHERE id = ?;
            """, (*new_alloc, item["process_id"]))

            cursor.execute("DELETE FROM waiting_queue WHERE id = ?;", (item["id"],))

            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            cursor.execute("""
                INSERT INTO request_history (
                    request_id, timestamp, process_id, process_name,
                    r0_req, r1_req, r2_req, r3_req,
                    banker_status, pressure_score, pressure_level,
                    agent_decision, decision_reason, state_changed,
                    safe_sequence_json, trace_json,
                    pre_state_json, tentative_state_json, post_state_json,
                    pressure_breakdown_json, ml_prediction_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Safe', 50.0, 'Moderate', 'Approved', ?, 1, ?, ?, ?, ?, ?, NULL, NULL);
            """, (
                item["request_id"], timestamp, item["process_id"], item["process_name"],
                *req_vector,
                f"Operator approved under supervisor authority. Live safety check verified safe sequence: {' → '.join(safety_res.safe_sequence)}.",
                json.dumps(safety_res.safe_sequence),
                json.dumps([t.model_dump() for t in safety_res.trace]),
                json.dumps(create_state_snapshot(current_state["total"], current_state["available"], current_state["processes"])),
                json.dumps(create_state_snapshot(current_state["total"], tentative_avail, current_state["processes"])),
                json.dumps(create_state_snapshot(current_state["total"], tentative_avail, current_state["processes"]))
            ))

            conn.commit()
            return {
                "message": f"Operator authorization approved for {item['process_name']}. Fresh safety check passed.",
                "safe_sequence": safety_res.safe_sequence
            }
        finally:
            conn.close()


@app.post("/api/queue/{request_id}/reject")
def operator_reject_queue_item(request_id: str):
    """Operator rejects a waiting request and removes it from the queue."""
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, process_name FROM waiting_queue WHERE request_id = ?;", (request_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Request not found in queue.")

            cursor.execute("DELETE FROM waiting_queue WHERE id = ?;", (row["id"],))
            conn.commit()
            return {"message": f"Request {request_id} for {row['process_name']} rejected and removed from queue."}
        finally:
            conn.close()


@app.get("/api/history")
def get_request_history(
    process_id: Optional[str] = Query(None, description="Filter by process ID"),
    decision_filter: Optional[str] = Query(None, description="Filter by agent decision"),
    banker_filter: Optional[str] = Query(None, description="Filter by banker status")
):
    """Returns audit trail with filter support."""
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            query = """
                SELECT id, request_id, timestamp, process_id, process_name,
                       r0_req, r1_req, r2_req, r3_req,
                       banker_status, pressure_score, pressure_level,
                       agent_decision, decision_reason, state_changed,
                       safe_sequence_json, trace_json,
                       pre_state_json, tentative_state_json, post_state_json,
                       pressure_breakdown_json, ml_prediction_json
                FROM request_history
            """
            clauses = []
            params = []
            if process_id:
                clauses.append("process_id = ?")
                params.append(process_id)
            if decision_filter:
                clauses.append("agent_decision LIKE ?")
                params.append(f"%{decision_filter}%")
            if banker_filter:
                clauses.append("banker_status = ?")
                params.append(banker_filter)

            if clauses:
                query += " WHERE " + " AND ".join(clauses)
            query += " ORDER BY id DESC;"

            cursor.execute(query, params)
            rows = cursor.fetchall()

            results = []
            for r in rows:
                results.append({
                    "id": r["id"],
                    "request_id": r["request_id"],
                    "timestamp": r["timestamp"],
                    "process_id": r["process_id"],
                    "process_name": r["process_name"],
                    "request": [r["r0_req"], r["r1_req"], r["r2_req"], r["r3_req"]],
                    "banker_status": r["banker_status"],
                    "pressure_score": r["pressure_score"],
                    "pressure_level": r["pressure_level"],
                    "agent_decision": r["agent_decision"],
                    "decision_reason": r["decision_reason"],
                    "state_changed": bool(r["state_changed"]),
                    "safe_sequence": json.loads(r["safe_sequence_json"]) if r["safe_sequence_json"] else [],
                    "trace": json.loads(r["trace_json"]) if r["trace_json"] else [],
                    "pre_state": json.loads(r["pre_state_json"]) if r["pre_state_json"] else None,
                    "tentative_state": json.loads(r["tentative_state_json"]) if r["tentative_state_json"] else None,
                    "post_state": json.loads(r["post_state_json"]) if r["post_state_json"] else None,
                    "pressure_breakdown": json.loads(r["pressure_breakdown_json"]) if r["pressure_breakdown_json"] else None,
                    "ml_prediction": json.loads(r["ml_prediction_json"]) if r["ml_prediction_json"] else None
                })
            return results
        finally:
            conn.close()


@app.get("/api/history/{history_id}")
def get_history_detail(history_id: int):
    """Returns detailed historical snapshot and algorithm trace for a specific transaction decision."""
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, request_id, timestamp, process_id, process_name,
                       r0_req, r1_req, r2_req, r3_req,
                       banker_status, pressure_score, pressure_level,
                       agent_decision, decision_reason, state_changed,
                       safe_sequence_json, trace_json,
                       pre_state_json, tentative_state_json, post_state_json,
                       pressure_breakdown_json, ml_prediction_json
                FROM request_history WHERE id = ?;
            """, (history_id,))
            r = cursor.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Request history record not found.")

            return {
                "id": r["id"],
                "request_id": r["request_id"],
                "timestamp": r["timestamp"],
                "process_id": r["process_id"],
                "process_name": r["process_name"],
                "request": [r["r0_req"], r["r1_req"], r["r2_req"], r["r3_req"]],
                "banker_status": r["banker_status"],
                "pressure_score": r["pressure_score"],
                "pressure_level": r["pressure_level"],
                "agent_decision": r["agent_decision"],
                "decision_reason": r["decision_reason"],
                "state_changed": bool(r["state_changed"]),
                "safe_sequence": json.loads(r["safe_sequence_json"]) if r["safe_sequence_json"] else [],
                "trace": json.loads(r["trace_json"]) if r["trace_json"] else [],
                "pre_state": json.loads(r["pre_state_json"]) if r["pre_state_json"] else None,
                "tentative_state": json.loads(r["tentative_state_json"]) if r["tentative_state_json"] else None,
                "post_state": json.loads(r["post_state_json"]) if r["post_state_json"] else None,
                "pressure_breakdown": json.loads(r["pressure_breakdown_json"]) if r["pressure_breakdown_json"] else None,
                "ml_prediction": json.loads(r["ml_prediction_json"]) if r["ml_prediction_json"] else None
            }
        finally:
            conn.close()


@app.get("/api/agent/policy")
def get_agent_policy():
    """Returns active Decision Agent policy rules, precedence, and thresholds."""
    return {
        "config": POLICY_CONFIG,
        "rules": POLICY_RULES,
        "role_statement": "The Decision Agent coordinates checks and applies allocation policy. Banker’s Algorithm provides the mandatory safety gate."
    }


@app.post("/api/agent/policy")
def update_agent_policy(low_threshold: float = Query(...), moderate_threshold: float = Query(...)):
    """Updates educational policy thresholds."""
    if low_threshold < 0 or low_threshold >= moderate_threshold or moderate_threshold > 100:
        raise HTTPException(status_code=400, detail="Invalid threshold values: Ensure 0 <= low < moderate <= 100.")

    POLICY_CONFIG["low_pressure_threshold"] = low_threshold
    POLICY_CONFIG["moderate_pressure_threshold"] = moderate_threshold
    return {"message": "Policy thresholds updated.", "config": POLICY_CONFIG}


@app.get("/api/demo/scenarios")
def get_classroom_demos():
    """Returns the 6 verified classroom demonstration scenarios."""
    return CLASSROOM_DEMOS


@app.post("/api/demo/reset")
def reset_demo_scenario():
    """Explicitly resets database state cleanly back to the verified 4-resource banking seed state."""
    reset_to_banking_seed()
    return {"message": "System state cleanly reset to verified 4-resource banking seed."}


@app.post("/api/demo/run/{scenario_id}")
def run_classroom_demo(scenario_id: int):
    """Executes a specific classroom demonstration scenario and returns the real result."""
    demo = next((d for d in CLASSROOM_DEMOS if d["id"] == scenario_id), None)
    if not demo:
        raise HTTPException(status_code=404, detail=f"Demo scenario {scenario_id} not found.")

    if demo.get("action") == "COMPLETE_AND_RETRY":
        return complete_process(demo["service_id"])

    req = ResourceRequest(
        process_id=demo["service_id"],
        request=demo["request"],
        transaction_amount_illustrative=demo.get("illustrative_amount")
    )
    res = submit_resource_request(req)
    return {
        "scenario": demo,
        "result": res
    }


@app.get("/api/ml/metrics")
def get_ml_metrics():
    """Returns training metrics and feature importances for the advisory ML model."""
    global MODEL_METRICS
    if MODEL_METRICS is None:
        MODEL_METRICS = train_simulator_decision_tree()
    return MODEL_METRICS


@app.post("/api/ml/train")
def trigger_ml_train():
    """Re-runs synthetic simulator training."""
    global MODEL_METRICS
    MODEL_METRICS = train_simulator_decision_tree()
    return {"message": "Advisory Decision Tree model re-trained successfully.", "metrics": MODEL_METRICS}
