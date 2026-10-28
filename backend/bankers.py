"""
Banker's Algorithm Core Module — 4-Resource Vector Arithmetic & Safety Check
Supports 4 system resources:
  - R0: CPU Processing Slots
  - R1: Memory Blocks (64 MB per block)
  - R2: Database Connections
  - R3: Transaction-Lock Slots
"""

from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel

RESOURCE_NAMES = [
    "CPU Processing Slots",
    "Memory Blocks (64 MB)",
    "Database Connections",
    "Transaction-Lock Slots"
]

RESOURCE_KEYS = ["CPU", "MEM", "DB", "LOCK"]
BLOCK_SIZE_MB = 64


def vector_add(v1: List[int], v2: List[int]) -> List[int]:
    """Component-wise addition for 4-resource vectors."""
    return [a + b for a, b in zip(v1, v2)]


def vector_sub(v1: List[int], v2: List[int]) -> List[int]:
    """Component-wise subtraction for 4-resource vectors."""
    return [a - b for a, b in zip(v1, v2)]


def vector_le(v1: List[int], v2: List[int]) -> bool:
    """Component-wise comparison: True iff v1[j] <= v2[j] for all j."""
    return all(a <= b for a, b in zip(v1, v2))


def format_vector(v: List[int]) -> str:
    """Formats 4-resource vector with units for logging and explanations."""
    return f"[{v[0]} CPU, {v[1]} Blocks ({v[1] * BLOCK_SIZE_MB} MB), {v[2]} DB, {v[3]} Locks]"


class SafetyStep(BaseModel):
    step: int
    process_id: str
    process_name: str
    need: List[int]
    work_before: List[int]
    allocation: List[int]
    work_after: List[int]
    explanation: str


class SafetyResult(BaseModel):
    is_safe: bool
    safe_sequence: List[str]
    unfinished_processes: List[str]
    trace: List[SafetyStep]
    final_work: List[int]


def run_safety_algorithm(
    available: List[int],
    alloc_map: Dict[str, List[int]],
    need_map: Dict[str, List[int]],
    active_process_names: Dict[str, str]
) -> SafetyResult:
    """
    Executes the classic Banker's Safety Algorithm over 4 resource types.
    Returns SafetyResult with:
      - is_safe: True if all active processes can complete without deadlock.
      - safe_sequence: Ordered list of process IDs that safely release resources.
      - unfinished_processes: Processes that could not complete if unsafe.
      - trace: Step-by-step trace showing Work vector progression.
      - final_work: Total resources reclaimed after all simulated completions.
    """
    work = list(available)
    finish = {pid: False for pid in active_process_names.keys()}
    safe_sequence: List[str] = []
    trace: List[SafetyStep] = []
    step_num = 1

    if not active_process_names:
        return SafetyResult(
            is_safe=True,
            safe_sequence=[],
            unfinished_processes=[],
            trace=[],
            final_work=work
        )

    while True:
        found_process = False
        for pid in active_process_names.keys():
            if not finish[pid]:
                p_need = need_map[pid]
                if vector_le(p_need, work):
                    work_before = list(work)
                    p_alloc = alloc_map[pid]
                    work_after = vector_add(work, p_alloc)

                    finish[pid] = True
                    safe_sequence.append(pid)
                    found_process = True

                    p_name = active_process_names[pid]
                    explanation = (
                        f"Step {step_num}: {p_name} ({pid}) has Need {format_vector(p_need)} <= "
                        f"Work {format_vector(work_before)}. Process can complete safely and release its "
                        f"allocation {format_vector(p_alloc)}, updating Work to {format_vector(work_after)}."
                    )

                    trace.append(SafetyStep(
                        step=step_num,
                        process_id=pid,
                        process_name=p_name,
                        need=p_need,
                        work_before=work_before,
                        allocation=p_alloc,
                        work_after=work_after,
                        explanation=explanation
                    ))
                    step_num += 1
                    work = work_after
                    break  # Restart loop to check all unfinished processes against new Work

        if not found_process:
            break

    all_finished = all(finish.values())
    unfinished = [pid for pid, is_done in finish.items() if not is_done]

    return SafetyResult(
        is_safe=all_finished,
        safe_sequence=safe_sequence if all_finished else [],
        unfinished_processes=unfinished,
        trace=trace,
        final_work=work
    )


def create_state_snapshot(
    total: List[int],
    available: List[int],
    processes: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Serializes complete snapshot of system state for audit history and explainability."""
    allocated_sum = [0, 0, 0, 0]
    proc_list = []
    for p in processes:
        if p["status"] == "ACTIVE":
            allocated_sum = vector_add(allocated_sum, p["alloc"])
        proc_list.append({
            "id": p["id"],
            "name": p["name"],
            "max": list(p["max"]),
            "alloc": list(p["alloc"]),
            "need": list(p["need"]),
            "status": p["status"]
        })

    return {
        "total": list(total),
        "available": list(available),
        "allocated_total": allocated_sum,
        "processes": proc_list,
        "block_size_mb": BLOCK_SIZE_MB
    }
