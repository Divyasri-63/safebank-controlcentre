"""
Database Management for SafeBank Control Centre
Manages SQLite storage with WAL mode, strict thread safety locks,
persistent waiting queue, and comprehensive audit history.
"""

import sqlite3
import threading
from pathlib import Path

DB_FILE = Path(__file__).parent / "safebank_control.db"
db_lock = threading.Lock()


def get_connection():
    """Returns a SQLite connection with Row factory, WAL mode, and foreign keys."""
    conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Initializes tables for 4-resource bank system: config, processes, waiting queue, and history."""
    with db_lock:
        conn = get_connection()
        cursor = conn.cursor()

        # System capacity configuration (4 resources)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            r0_total INTEGER NOT NULL,
            r1_total INTEGER NOT NULL,
            r2_total INTEGER NOT NULL,
            r3_total INTEGER NOT NULL,
            block_size_mb INTEGER NOT NULL DEFAULT 64
        );
        """)

        # Banking services (Processes P0 - P4)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS processes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            service_type TEXT NOT NULL,
            r0_max INTEGER NOT NULL,
            r1_max INTEGER NOT NULL,
            r2_max INTEGER NOT NULL,
            r3_max INTEGER NOT NULL,
            r0_alloc INTEGER NOT NULL,
            r1_alloc INTEGER NOT NULL,
            r2_alloc INTEGER NOT NULL,
            r3_alloc INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Persistent Waiting Queue
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS waiting_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT NOT NULL UNIQUE,
            process_id TEXT NOT NULL,
            process_name TEXT NOT NULL,
            r0_req INTEGER NOT NULL,
            r1_req INTEGER NOT NULL,
            r2_req INTEGER NOT NULL,
            r3_req INTEGER NOT NULL,
            queue_reason TEXT NOT NULL,
            submission_time TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            review_status TEXT NOT NULL CHECK(review_status IN ('PENDING', 'REVIEW_REQUIRED', 'OPERATOR_APPROVED', 'REJECTED')),
            pressure_score REAL,
            pressure_level TEXT,
            banker_status TEXT,
            last_evaluated_at TEXT
        );
        """)

        # Immutable Audit History
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS request_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            timestamp TEXT NOT NULL,
            process_id TEXT NOT NULL,
            process_name TEXT NOT NULL,
            r0_req INTEGER NOT NULL,
            r1_req INTEGER NOT NULL,
            r2_req INTEGER NOT NULL,
            r3_req INTEGER NOT NULL,
            banker_status TEXT NOT NULL,
            pressure_score REAL NOT NULL,
            pressure_level TEXT NOT NULL,
            agent_decision TEXT NOT NULL,
            decision_reason TEXT NOT NULL,
            state_changed INTEGER NOT NULL,
            safe_sequence_json TEXT,
            trace_json TEXT,
            pre_state_json TEXT NOT NULL,
            tentative_state_json TEXT,
            post_state_json TEXT,
            pressure_breakdown_json TEXT,
            ml_prediction_json TEXT
        );
        """)

        conn.commit()
        conn.close()


if __name__ == "__main__":
    init_db()
    print("SafeBank Control Centre database initialized successfully.")
