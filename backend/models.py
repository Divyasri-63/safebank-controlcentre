"""
Pydantic Models for SafeBank — Bank Operations Control Centre
Defines 4-resource request/response structures, queue models, and state schemas.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator
from bankers import SafetyStep, SafetyResult


class ProcessCreate(BaseModel):
    id: str = Field(..., description="Unique process ID (e.g. P0, P1)")
    name: str = Field(..., min_length=2, description="Banking service name (e.g. ATM Withdrawal)")
    max_demand: List[int] = Field(..., min_length=4, max_length=4, description="Max demand [CPU, MEM, DB, LOCK]")

    @field_validator("max_demand")
    @classmethod
    def validate_demand(cls, v):
        for val in v:
            if not isinstance(val, int) or val < 0:
                raise ValueError("Resource demand values must be non-negative integers")
        return v


class ResourceRequest(BaseModel):
    process_id: str
    request: List[int] = Field(..., min_length=4, max_length=4, description="Requested units [CPU, MEM, DB, LOCK]")
    transaction_amount_illustrative: Optional[float] = Field(
        None,
        description="Illustrative financial transaction amount ($/INR) for business context; NOT used as an OS computing resource."
    )

    @field_validator("request")
    @classmethod
    def validate_request(cls, v):
        for val in v:
            if not isinstance(val, int) or val < 0:
                raise ValueError("Resource request values must be non-negative integers")
        return v


class ProcessView(BaseModel):
    id: str
    name: str
    max: List[int]
    alloc: List[int]
    need: List[int]
    status: Literal["ACTIVE", "COMPLETED"]


class HeuristicScoreBreakdown(BaseModel):
    score: float
    level: Literal["Low", "Moderate", "High", "N/A"]
    utilization_max: float
    utilization_contrib: float
    available_share_max: float
    share_contrib: float
    exhaustion_ratio: float
    exhaustion_contrib: float
    process_deferral_rate: float
    deferral_contrib: float
    explanation: str


class MLPrediction(BaseModel):
    predicted_safe: bool
    confidence_granted: float
    feature_summary: Dict[str, float]
    model_trained: bool
    status_note: str


class DecisionAgentResult(BaseModel):
    request_id: str
    timestamp: str
    process_id: str
    process_name: str
    request: List[int]
    banker_status: Literal["Safe", "Unsafe", "Skipped", "Not evaluated"]
    pressure_score: float
    pressure_level: Literal["Low", "Moderate", "High", "N/A"]
    agent_decision: Literal[
        "Approved",
        "Queued — Insufficient Resources",
        "Queued — Unsafe Result",
        "Review Required",
        "Deferred by Pressure Policy",
        "Invalid Request"
    ]
    decision_reason: str
    safe_sequence: List[str] = []
    unfinished_processes: List[str] = []
    state_changed: bool
    trace: List[SafetyStep] = []
    pre_state: Dict[str, Any]
    tentative_state: Optional[Dict[str, Any]] = None
    post_state: Optional[Dict[str, Any]] = None
    heuristic_analysis: HeuristicScoreBreakdown
    ml_prediction: Optional[MLPrediction] = None


class QueueItemView(BaseModel):
    id: int
    request_id: str
    process_id: str
    process_name: str
    request: List[int]
    queue_reason: str
    submission_time: str
    retry_count: int
    review_status: Literal["PENDING", "REVIEW_REQUIRED", "OPERATOR_APPROVED", "REJECTED"]
    pressure_score: Optional[float] = None
    pressure_level: Optional[str] = None
    banker_status: Optional[str] = None
    wait_duration_sec: int = 0
    is_long_wait: bool = False


class SystemStateResponse(BaseModel):
    total: List[int]
    allocated: List[int]
    available: List[int]
    is_safe: bool
    safe_sequence: List[str]
    safety_trace: List[SafetyStep] = []
    active_count: int
    completed_count: int
    waiting_count: int
    block_size_mb: int
    processes: List[ProcessView]
    summary_stats: Dict[str, int]
