"""
Seed Data & Classroom Demo Scenarios
Provides a verified, balanced 4-resource banking seed state with 5 consistent services (P0 - P4).
Includes pre-calibrated classroom demo presets for live presentation.
"""

from typing import List, Dict, Any
from database import get_connection, db_lock, init_db

# System capacity: [CPU Slots, Memory Blocks (64MB), DB Connections, Lock Slots]
DEFAULT_SYSTEM_TOTAL = [12, 16, 12, 9]
DEFAULT_BLOCK_SIZE_MB = 64

# Consistent 5 Banking Services matching PPT
BANKING_PROCESSES = [
    {
        "id": "P0",
        "name": "ATM Withdrawal",
        "service_type": "ATM",
        "max": [5, 4, 3, 2],
        "alloc": [1, 2, 1, 1],
        "status": "ACTIVE"
    },
    {
        "id": "P1",
        "name": "UPI Payment",
        "service_type": "UPI",
        "max": [3, 5, 3, 3],
        "alloc": [2, 1, 2, 1],
        "status": "ACTIVE"
    },
    {
        "id": "P2",
        "name": "Fund Transfer",
        "service_type": "Transfer",
        "max": [7, 6, 5, 4],
        "alloc": [3, 3, 2, 2],
        "status": "ACTIVE"
    },
    {
        "id": "P3",
        "name": "Loan Processing",
        "service_type": "Loan",
        "max": [4, 7, 4, 3],
        "alloc": [2, 4, 3, 1],
        "status": "ACTIVE"
    },
    {
        "id": "P4",
        "name": "Online Banking",
        "service_type": "OnlineBanking",
        "max": [3, 4, 3, 2],
        "alloc": [1, 2, 1, 1],
        "status": "ACTIVE"
    },
]

# 6 Pre-calibrated Classroom Demonstration Scenarios
CLASSROOM_DEMOS = [
    {
        "id": 1,
        "title": "Scenario 1: Safe Request with Low Pressure",
        "badge": "Approved",
        "badge_color": "green",
        "service_id": "P1",
        "service_name": "UPI Payment",
        "request": [0, 1, 0, 0],
        "illustrative_amount": 2500.0,
        "expected_banker": "Safe",
        "expected_pressure": "Low (Score ~28.8)",
        "expected_decision": "Approved",
        "state_changed": True,
        "learning_objective": "Demonstrates automatic approval when tentative state is mathematically safe and contention is low."
    },
    {
        "id": 2,
        "title": "Scenario 2: Sufficient Capacity but Unsafe Allocation",
        "badge": "Queued — Unsafe",
        "badge_color": "amber",
        "service_id": "P0",
        "service_name": "ATM Withdrawal",
        "request": [0, 2, 2, 0],
        "illustrative_amount": 10000.0,
        "expected_banker": "Unsafe",
        "expected_pressure": "Moderate",
        "expected_decision": "Queued — Unsafe Result",
        "state_changed": False,
        "learning_objective": "Resources are available (0<=3, 2<=4, 2<=3, 0<=3), but granting them destroys the safe completion sequence. Deadlock prevention kicks in."
    },
    {
        "id": 3,
        "title": "Scenario 3: Insufficient Available Capacity",
        "badge": "Queued — Capacity",
        "badge_color": "amber",
        "service_id": "P0",
        "service_name": "ATM Withdrawal",
        "request": [4, 0, 0, 0],
        "illustrative_amount": 50000.0,
        "expected_banker": "Skipped",
        "expected_pressure": "High",
        "expected_decision": "Queued — Insufficient Resources",
        "state_changed": False,
        "learning_objective": "ATM Withdrawal requests 4 CPU slots (within its remaining need 4), but only 3 CPU slots are currently available. Enters Waiting Queue."
    },
    {
        "id": 4,
        "title": "Scenario 4: Request Exceeds Remaining Need",
        "badge": "Invalid",
        "badge_color": "red",
        "service_id": "P1",
        "service_name": "UPI Payment",
        "request": [2, 0, 0, 0],
        "illustrative_amount": 500.0,
        "expected_banker": "Not evaluated",
        "expected_pressure": "N/A",
        "expected_decision": "Invalid Request",
        "state_changed": False,
        "learning_objective": "Service asks for 2 CPU slots, but its declared remaining need is only 1. Rejected immediately under OS Banker invariants."
    },
    {
        "id": 5,
        "title": "Scenario 5: Safe Request with High Pressure",
        "badge": "Deferred by Policy",
        "badge_color": "blue",
        "service_id": "P1",
        "service_name": "UPI Payment",
        "request": [0, 4, 0, 0],
        "illustrative_amount": 15000.0,
        "expected_banker": "Safe",
        "expected_pressure": "High (Score ~63.8)",
        "expected_decision": "Deferred by Pressure Policy",
        "state_changed": False,
        "learning_objective": "Tentative state has a valid safe sequence, but request consumes 100% of available memory. Decision Agent defers to protect bank throughput."
    },
    {
        "id": 6,
        "title": "Scenario 6: Job Completion & Queue Re-evaluation",
        "badge": "Release & Retry",
        "badge_color": "purple",
        "service_id": "P1",
        "service_name": "UPI Payment",
        "request": [],
        "action": "COMPLETE_AND_RETRY",
        "expected_banker": "Re-evaluated",
        "expected_pressure": "Reduced",
        "expected_decision": "Resources Released, Queue Processed",
        "state_changed": True,
        "learning_objective": "Job finishes, releases its live allocation, expands Available capacity, and automatically triggers queue retry."
    }
]


def reset_to_banking_seed():
    """Resets database state cleanly to the verified 4-resource banking seed state."""
    init_db()
    with db_lock:
        conn = get_connection()
        cursor = conn.cursor()

        # Reset system config
        cursor.execute("DELETE FROM system_config;")
        cursor.execute("""
            INSERT INTO system_config (id, r0_total, r1_total, r2_total, r3_total, block_size_mb)
            VALUES (1, ?, ?, ?, ?, ?);
        """, (*DEFAULT_SYSTEM_TOTAL, DEFAULT_BLOCK_SIZE_MB))

        # Reset processes
        cursor.execute("DELETE FROM processes;")
        for p in BANKING_PROCESSES:
            cursor.execute("""
                INSERT INTO processes (
                    id, name, service_type,
                    r0_max, r1_max, r2_max, r3_max,
                    r0_alloc, r1_alloc, r2_alloc, r3_alloc,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                p["id"],
                p["name"],
                p["service_type"],
                p["max"][0], p["max"][1], p["max"][2], p["max"][3],
                p["alloc"][0], p["alloc"][1], p["alloc"][2], p["alloc"][3],
                p["status"]
            ))

        # Clear waiting queue and request history
        cursor.execute("DELETE FROM waiting_queue;")
        cursor.execute("DELETE FROM request_history;")

        conn.commit()
        conn.close()


def ensure_initialized():
    """Ensures database has system config and initial processes if empty."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM system_config;")
    count = cursor.fetchone()[0]
    conn.close()
    if count == 0:
        reset_to_banking_seed()
