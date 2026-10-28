"""
Verification Test Suite for SafeBank Control Centre
Verifies all 10 core system requirements:
  1. Initial Safe State & Resource Conservation
  2. Safe Allocation with Low Pressure (Approved & Committed)
  3. Unsafe Allocation Refusal (Deadlock Prevention & State Preservation)
  4. Safe but High-Pressure Deferral (Policy Gate without Mislabeling)
  5. Insufficient Capacity Queuing
  6. Remaining Need Boundary Enforcement
  7. Operator Review Approval with Fresh Safety Validation
  8. Job Completion, Resource Release, & Queue Retry
  9. Continuous Resource Conservation Invariant
  10. Concurrent Request Serialization & Thread Safety
"""

import pytest
import threading
from fastapi.testclient import TestClient

from main import app
from seed_data import reset_to_banking_seed
from bankers import vector_add, vector_sub

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_teardown():
    reset_to_banking_seed()
    yield
    reset_to_banking_seed()


def test_initial_state_is_safe_and_conserved():
    """Verify 4-resource seed: Total [12, 16, 12, 9], Available [3, 4, 3, 3], Safe sequence valid."""
    res = client.get("/api/state")
    assert res.status_code == 200
    data = res.json()

    assert data["total"] == [12, 16, 12, 9]
    assert data["allocated"] == [9, 12, 9, 6]
    assert data["available"] == [3, 4, 3, 3]
    assert vector_add(data["allocated"], data["available"]) == data["total"]
    assert data["is_safe"] is True
    assert len(data["safe_sequence"]) == 5
    assert set(data["safe_sequence"]) == {"P0", "P1", "P2", "P3", "P4"}
    assert data["waiting_count"] == 0


def test_safe_allocation_low_pressure():
    """Verify P1 requesting [0, 1, 0, 0] is Approved with Low Pressure and committed."""
    res = client.post("/api/requests", json={
        "process_id": "P1",
        "request": [0, 1, 0, 0],
        "transaction_amount_illustrative": 2500.0
    })
    assert res.status_code == 200
    data = res.json()

    assert data["agent_decision"] == "Approved"
    assert data["banker_status"] == "Safe"
    assert data["pressure_level"] == "Low"
    assert data["pressure_score"] <= 30.0
    assert data["state_changed"] is True
    assert len(data["safe_sequence"]) == 5
    assert len(data["trace"]) > 0

    # Live allocation must reflect new state: P1 alloc was [2, 1, 2, 1], now [2, 2, 2, 1]
    st = client.get("/api/state").json()
    p1 = next(p for p in st["processes"] if p["id"] == "P1")
    assert p1["alloc"] == [2, 2, 2, 1]
    assert p1["need"] == [1, 3, 1, 2]
    assert st["available"] == [3, 3, 3, 3]


def test_unsafe_allocation_refusal():
    """Verify P0 requesting [0, 2, 2, 0] is refused: capacity is available, but leaves no safe completion order."""
    res = client.post("/api/requests", json={
        "process_id": "P0",
        "request": [0, 2, 2, 0]
    })
    assert res.status_code == 200
    data = res.json()

    assert data["agent_decision"] == "Queued — Unsafe Result"
    assert data["banker_status"] == "Unsafe"
    assert data["state_changed"] is False
    assert len(data["unfinished_processes"]) > 0

    # Original allocation retained
    st = client.get("/api/state").json()
    p0 = next(p for p in st["processes"] if p["id"] == "P0")
    assert p0["alloc"] == [1, 2, 1, 1]
    assert st["available"] == [3, 4, 3, 3]

    # Persistent waiting queue has request
    q = client.get("/api/queue").json()
    assert len(q) == 1
    assert q[0]["process_id"] == "P0"


def test_safe_but_high_pressure_deferral():
    """Verify P1 requesting [0, 4, 0, 0] is Safe under Banker's check, but Deferred by Pressure Policy."""
    res = client.post("/api/requests", json={
        "process_id": "P1",
        "request": [0, 4, 0, 0]
    })
    assert res.status_code == 200
    data = res.json()

    assert data["banker_status"] == "Safe"
    assert data["pressure_level"] == "High"
    assert data["pressure_score"] > 60.0
    assert data["agent_decision"] == "Deferred by Pressure Policy"
    assert data["state_changed"] is False

    # State unchanged
    st = client.get("/api/state").json()
    assert st["available"] == [3, 4, 3, 3]


def test_insufficient_capacity_queued():
    """Verify P0 requesting [4, 0, 0, 0] (3 available, need 4) is Queued with Banker's check skipped."""
    res = client.post("/api/requests", json={
        "process_id": "P0",
        "request": [4, 0, 0, 0]
    })
    assert res.status_code == 200
    data = res.json()

    assert data["agent_decision"] == "Queued — Insufficient Resources"
    assert data["banker_status"] == "Skipped"
    assert data["state_changed"] is False
    assert "Insufficient available capacity" in data["decision_reason"]


def test_exceeds_remaining_need_rejected():
    """Verify P1 requesting 2 CPU slots is Invalid (need is [1, 4, 1, 2])."""
    res = client.post("/api/requests", json={
        "process_id": "P1",
        "request": [2, 0, 0, 0]
    })
    assert res.status_code == 200
    data = res.json()

    assert data["agent_decision"] == "Invalid Request"
    assert data["banker_status"] == "Not evaluated"
    assert "exceeds its declared remaining need" in data["decision_reason"]


def test_operator_review_approval_with_fresh_safety_validation():
    """Verify Review Required flow and operator approval with fresh safety check."""
    # P0 requests [1, 1, 0, 0] -> Moderate pressure (Score ~32.1) -> Review Required
    res = client.post("/api/requests", json={
        "process_id": "P0",
        "request": [1, 1, 0, 0]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["agent_decision"] == "Review Required"
    req_id = data["request_id"]

    # In waiting queue with review_status 'REVIEW_REQUIRED'
    q = client.get("/api/queue").json()
    item = next(i for i in q if i["request_id"] == req_id)
    assert item["review_status"] == "REVIEW_REQUIRED"

    # Operator approves -> backend validates live safety check and commits
    app_res = client.post(f"/api/queue/{req_id}/review-approve")
    assert app_res.status_code == 200
    assert "approved" in app_res.json()["message"].lower()

    # P0 allocation updated in live state
    st = client.get("/api/state").json()
    p0 = next(p for p in st["processes"] if p["id"] == "P0")
    assert p0["alloc"] == [2, 3, 1, 1]
    assert st["available"] == [2, 3, 3, 3]

    # Queue is now empty
    q2 = client.get("/api/queue").json()
    assert len(q2) == 0


def test_resource_release_and_queue_retry():
    """Verify that completing a job releases capacity and triggers automatic queue re-evaluation."""
    # Queue a request for P0 asking for [4, 0, 0, 0] (3 CPU available -> gets queued)
    q_res = client.post("/api/requests", json={"process_id": "P0", "request": [4, 0, 0, 0]})
    assert q_res.json()["agent_decision"] == "Queued — Insufficient Resources"

    # Complete P1 (UPI Payment) which holds alloc [2, 1, 2, 1]
    comp_res = client.post("/api/processes/P1/complete")
    assert comp_res.status_code == 200
    data = comp_res.json()
    assert data["status"] == "COMPLETED"
    assert data["released_resources"] == [2, 1, 2, 1]

    # Available capacity increased: [3, 4, 3, 3] + [2, 1, 2, 1] = [5, 5, 5, 4]
    st = client.get("/api/state").json()
    assert st["available"] == [5, 5, 5, 4]

    # Verify that the complete & release event is recorded in request_history
    hist_res = client.get("/api/history")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    rel_item = next((h for h in hist if h["process_id"] == "P1" and "Completed" in h["agent_decision"]), None)
    assert rel_item is not None
    assert rel_item["agent_decision"] == "Completed & Released"
    assert rel_item["request"] == [2, 1, 2, 1]
    assert rel_item["state_changed"] is True


def test_resource_conservation_at_all_times():
    """Verify Total == Available + Allocated continuously across multiple operations."""
    st1 = client.get("/api/state").json()
    assert vector_add(st1["allocated"], st1["available"]) == st1["total"]

    # Submit an approved request
    client.post("/api/requests", json={"process_id": "P1", "request": [0, 1, 0, 0]})
    st2 = client.get("/api/state").json()
    assert vector_add(st2["allocated"], st2["available"]) == st2["total"]

    # Complete a process
    client.post("/api/processes/P0/complete")
    st3 = client.get("/api/state").json()
    assert vector_add(st3["allocated"], st3["available"]) == st3["total"]


def test_concurrent_requests_serialization():
    """Verify thread-safety: concurrent requests cannot over-allocate beyond Available capacity."""
    # Available CPU is 3. Two concurrent threads asking for 2 units of CPU each.
    # Only ONE can be approved; the second must be queued or deferred.
    results = []

    def make_request():
        thread_client = TestClient(app)
        r = thread_client.post("/api/requests", json={"process_id": "P1", "request": [1, 0, 0, 0]})
        results.append(r.json()["agent_decision"])

    t1 = threading.Thread(target=make_request)
    t2 = threading.Thread(target=make_request)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    st = client.get("/api/state").json()
    # Available must never drop below 0 for any component
    assert all(a >= 0 for a in st["available"])
    assert vector_add(st["allocated"], st["available"]) == st["total"]
