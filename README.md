# SafeBank — Bank Operations Control Centre
### Resource Allocation and Deadlock Prevention using Banker’s Algorithm with Intelligent Risk Analysis

**Operating Systems Project | Banking Transaction Resource Management**  
*Karunya Institute of Technology and Sciences*  
**Authors:**
- DIVYASRI M — URK25CS7088
- SRINIVATHINI R — URK25CS7095
- AISHWARYA S — URK25CS7093

---

## 1. Project Overview & Real-Life Banking Scenario

Modern commercial banking infrastructures handle massive transaction volumes across multiple distributed services during peak operating hours:
- **P0 — ATM Withdrawal**: Cash dispense locking, card authentication, account ledger updates.
- **P1 — UPI Payment**: Instant mobile payment switching, real-time token exchange.
- **P2 — Fund Transfer**: Multi-hop NEFT/RTGS settlement and clearinghouse verification.
- **P3 — Loan Processing**: Multi-tier credit score underwriting and batch document analysis.
- **P4 — Online Banking**: Web banking session management and profile activity queries.

Each transaction workflow competes for shared, finite server hardware resources. If capacity is allocated carelessly or in an uncoordinated manner, a **deadlock state** can occur (e.g., ATM holds database locks waiting for memory, while UPI holds memory waiting for lock permits).

**SafeBank Control Centre** introduces a dual-layer architectural pipeline:
1. **Banker's Algorithm Core**: Acts as a **mandatory mathematical safety gate** to guarantee that the system never enters an unsafe state where deadlock is possible under declared maximum demands.
2. **Deterministic Decision Agent**: Combines real-time input validity, live capacity checks, Banker's safety proofs, and a **pre-decision resource-pressure score (0–100)** to enforce tier-based allocation policies (Automatic Approval, Supervisor Review, or Throughput Deferral).

> **Important Educational Clarification:**  
> These workflows represent simulated computing jobs. Approval of computing resources reserves server capacity (CPU slots, memory blocks, DB pool connections, lock slots); it does **not** authorize financial balance transfers.

---

## 2. Four-Resource System Model

The system models four critical banking computing resource categories:

| Resource Key | Resource Name | Units | Banking Operational Purpose |
| :--- | :--- | :--- | :--- |
| **R0** | **CPU Processing Slots** | `slots` | Reserved concurrent processing capacity for active threads. |
| **R1** | **Memory Blocks** | `blocks (64 MB each)` | Dedicated memory buffers allocated in fixed 64 MB pages. Displayed in both blocks and MB. |
| **R2** | **Database Connections** | `connections` | Dedicated connections from the bank's active PostgreSQL/Oracle pool. |
| **R3** | **Transaction-Lock Slots** | `permits` | Interchangeable simulated lock permits for ledger row protection. |

### Verified Seed State
- **System Total Capacity**: `[12 CPU slots, 16 Memory blocks (1024 MB), 12 DB connections, 9 Lock slots]`
- **Live Active Allocated**: `[9, 12, 9, 6]`
- **Live Available Vector**: `[3, 4, 3, 3]`
- **Verified Initial Safe Sequence**: `P1 → P0 → P2 → P3 → P4`

| Process ID | Banking Service | Max Demand | Current Alloc | Remaining Need | Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **P0** | ATM Withdrawal | `[5, 4, 3, 2]` | `[1, 2, 1, 1]` | `[4, 2, 2, 1]` | ACTIVE |
| **P1** | UPI Payment | `[3, 5, 3, 3]` | `[2, 1, 2, 1]` | `[1, 4, 1, 2]` | ACTIVE |
| **P2** | Fund Transfer | `[7, 6, 5, 4]` | `[3, 3, 2, 2]` | `[4, 3, 3, 2]` | ACTIVE |
| **P3** | Loan Processing | `[4, 7, 4, 3]` | `[2, 4, 3, 1]` | `[2, 3, 1, 2]` | ACTIVE |
| **P4** | Online Banking | `[3, 4, 3, 2]` | `[1, 2, 1, 1]` | `[2, 2, 2, 1]` | ACTIVE |

---

## 3. Architecture & Observable Decision Pipeline

Every transaction request follows an observable 7-step pipeline:

```
Banking Service Request
  │
  ▼
[1. Input Validation & State Snapshot]
  │  Checks non-negative integers, process active status, captures pre-state
  ▼
[2. Need Matrix Calculation]
  │  Verifies Request <= Need (Enforces declared maximum claim)
  ▼
[3. Availability Verification]
  │  Verifies Request <= Available (If deficit, routes directly to Waiting Queue)
  ▼
[4. Tentative Allocation & Banker's Safety Algorithm]
  │  Simulates Work = Available - Request, searches for safe completion sequence
  ▼
[5. Resource-Pressure Analysis (Intelligent Risk)]
  │  Calculates contention score (0-100) from pre-decision features
  ▼
[6. Decision Agent Policy Engine]
  │  Enforces Precedence Rules A -> B -> C -> D -> E -> F
  ▼
[7. State Commit OR FIFO Waiting Queue]
  │  Approved: commits allocation to SQLite WAL database
  │  Deferred/Queued: persists in FIFO queue for release/retry
  ▼
[Audit History & Real-Time Dashboard]
```

### Precedence Policy Rules

| Precedence | Condition | Banker Gate | Pressure Band | Agent Decision | Live State Committed? |
| :---: | :--- | :---: | :---: | :--- | :---: |
| **A** | Invalid (malformed, exceeds remaining need, inactive) | Skipped | N/A | **Invalid Request** | No |
| **B** | Request > Available Capacity | Skipped | Evaluated | **Queued — Insufficient Resources** | No |
| **C** | Tentative State is Unsafe | **Unsafe** | Evaluated | **Queued — Unsafe Result** | No |
| **D** | Verified Safe + Low Contention | **Safe** | **0 – 30.0 (Low)** | **Approved & Committed** | **YES** |
| **E** | Verified Safe + Moderate Contention | **Safe** | **30.1 – 60.0 (Moderate)** | **Review Required (Supervisor)** | No (Awaits Review) |
| **F** | Verified Safe + High Contention | **Safe** | **> 60.0 (High)** | **Deferred by Pressure Policy** | No |

---

## 4. Resource-Pressure Scoring Formula

The transparent heuristic pressure score is derived strictly from pre-decision features to avoid data leakage:

$$\text{Pressure Score} = w_u \cdot U_{\max} + w_s \cdot S_{\max} + w_e \cdot E_{\text{ratio}} + w_d \cdot D_{\text{rate}}$$

- **Max Current Utilization ($U_{\max}$, 25%)**: Peak ratio $\max_j(\text{Allocated}_j / \text{Total}_j)$.
- **Max Requested Share ($S_{\max}$, 40%)**: Peak fraction $\max_j(\text{Request}_j / \text{Available}_j)$ requested of available capacity.
- **Resource Depletion ($E_{\text{ratio}}$, 20%)**: Fraction of resources that would reach 0 remaining capacity.
- **Process Deferral History ($D_{\text{rate}}$, 15%)**: Historical deferral rate for the requesting service.

*Pressure bands:*
- `0 - 30`: Low Pressure (Safe automatic approval)
- `31 - 60`: Moderate Pressure (Supervisor review required)
- `61 - 100`: High Pressure (Deferred by policy to protect server throughput)

---

## 5. Classroom Demonstration Scenarios & Script

Use the built-in **"Start Guided Demo"** button on the navbar to run these 6 verified scenarios:

1. **Scenario 1: Safe Request with Low Pressure**
   - *Action:* P1 (UPI Payment) requests `[0, 1, 0, 0]` (1 memory block = 64 MB).
   - *Outcome:* Banker: **Safe** (`P1 → P0 → P2 → P3 → P4`), Pressure: **Low (28.8/100)**.
   - *Decision:* **Approved & Committed**. Live state updates to Available `[3, 3, 3, 3]`.

2. **Scenario 2: Sufficient Capacity but Unsafe Tentative State**
   - *Action:* P0 (ATM Withdrawal) requests `[0, 2, 2, 0]` (2 memory blocks, 2 DB connections).
   - *Outcome:* Capacity is available (`[0,2,2,0] <= [3,4,3,3]`), but tentative state leaves no safe sequence.
   - *Decision:* **Queued — Unsafe Result**. Deadlock prevented. Live allocations unchanged.

3. **Scenario 3: Insufficient Available Capacity**
   - *Action:* P0 (ATM Withdrawal) requests `[4, 0, 0, 0]` (4 CPU slots).
   - *Outcome:* Remaining Need is 4, but Available CPU is only 3.
   - *Decision:* **Queued — Insufficient Resources**. Enters FIFO Waiting Queue.

4. **Scenario 4: Request Exceeds Remaining Need**
   - *Action:* P1 (UPI Payment) requests `[2, 0, 0, 0]` (2 CPU slots).
   - *Outcome:* Declared remaining need is only 1 CPU slot.
   - *Decision:* **Invalid Request**. Violates Banker's maximum claim invariant.

5. **Scenario 5: Safe Request with High Resource Pressure**
   - *Action:* P1 (UPI Payment) requests `[0, 4, 0, 0]` (4 memory blocks).
   - *Outcome:* Banker: **Safe**, but consumes 100% of available memory (Pressure **63.8/100**).
   - *Decision:* **Deferred by Pressure Policy**. Prevents buffer exhaustion.

6. **Scenario 6: Job Completion, Resource Release, & Queue Retry**
   - *Action:* Complete P1 (UPI Payment) which holds `[2, 1, 2, 1]`.
   - *Outcome:* Resources released back to Available (`[5, 5, 5, 4]`).
   - *Decision:* Waiting Queue automatically re-evaluates queued requests in FIFO order!

---

## 6. Verification Test Suite

Run the comprehensive pytest suite verifying all 10 core requirements:

```bash
# From safebank-control-centre/backend:
pytest test_bankers.py -v
```

Verified test coverage:
1. `test_initial_state_is_safe_and_conserved` — PASSED
2. `test_safe_allocation_low_pressure` — PASSED
3. `test_unsafe_allocation_refusal` — PASSED
4. `test_safe_but_high_pressure_deferral` — PASSED
5. `test_insufficient_capacity_queued` — PASSED
6. `test_exceeds_remaining_need_rejected` — PASSED
7. `test_operator_review_approval_with_fresh_safety_validation` — PASSED
8. `test_resource_release_and_queue_retry` — PASSED
9. `test_resource_conservation_at_all_times` — PASSED
10. `test_concurrent_requests_serialization` — PASSED

---

## 7. Quick Startup Instructions

### Windows (One-Click)
Double-click `start-all.bat` in the project root:
```bash
start-all.bat
```
This launches:
- **Backend API**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Frontend Dashboard**: `http://localhost:5174`

### Individual Manual Start

**Backend:**
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```
Open your browser at `http://localhost:5174`.
