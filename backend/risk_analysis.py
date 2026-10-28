"""
Resource-Pressure Analysis & Advisory ML Decision Tree
Computes transparent rule-based resource-pressure score (0–100) from pre-decision state snapshot.
Provides educational ML Decision Tree predictor strictly as an advisory comparison.
"""

import random
from typing import List, Dict, Any, Optional
import numpy as np
from models import HeuristicScoreBreakdown, MLPrediction
from bankers import vector_sub, vector_le, run_safety_algorithm

TRAINED_MODEL = None
MODEL_METRICS = None

FEATURE_NAMES = [
    "util_cpu", "util_mem", "util_db", "util_lock",
    "req_cpu", "req_mem", "req_db", "req_lock",
    "avail_cpu", "avail_mem", "avail_db", "avail_lock",
    "need_cpu", "need_mem", "need_db", "need_lock",
    "proc_deferral_rate"
]


def calculate_resource_pressure_score(
    total: List[int],
    available: List[int],
    current_allocated: List[int],
    request: List[int],
    process_id: str,
    past_requests: List[Dict[str, Any]]
) -> HeuristicScoreBreakdown:
    """
    Computes a transparent, documented rule-based resource-pressure score from 0 to 100.
    Derived strictly from pre-decision features to prevent data leakage.

    Weights:
      1. Max Current System Utilization: 25%
      2. Max Requested Share of Available Capacity: 40%
      3. Fraction of Resource Types Depleted (exhausted to 0): 20%
      4. Historical Deferral Rate for Requesting Process: 15%
    """
    # 1. Utilization Feature across 4 resources
    utils = []
    for alloc_val, tot_val in zip(current_allocated, total):
        utils.append(alloc_val / tot_val if tot_val > 0 else 0.0)
    util_max = max(utils) if utils else 0.0
    util_contrib = 25.0 * min(1.0, max(0.0, util_max))

    # 2. Available Share Feature
    shares = []
    for req_val, avail_val in zip(request, available):
        if avail_val > 0:
            shares.append(req_val / avail_val)
        else:
            shares.append(1.0 if req_val > 0 else 0.0)
    share_max = max(shares) if shares else 0.0
    share_capped = min(1.0, max(0.0, share_max))
    share_contrib = 40.0 * share_capped

    # 3. Resource Exhaustion Feature (resources depleted to 0)
    exhausted_count = 0
    for req_val, avail_val in zip(request, available):
        if avail_val - req_val <= 0 and req_val > 0:
            exhausted_count += 1
    exhaustion_ratio = exhausted_count / 4.0
    exhaustion_contrib = 20.0 * exhaustion_ratio

    # 4. Process Deferral Rate Feature
    proc_requests = [r for r in past_requests if r.get("process_id") == process_id]
    if proc_requests:
        deferred_count = sum(
            1 for r in proc_requests
            if "DEFERRED" in str(r.get("agent_decision", r.get("decision", ""))).upper()
            or "QUEUED" in str(r.get("agent_decision", r.get("decision", ""))).upper()
        )
        deferral_rate = deferred_count / len(proc_requests)
    else:
        deferral_rate = 0.0
    deferral_contrib = 15.0 * min(1.0, max(0.0, deferral_rate))

    total_score = round(util_contrib + share_contrib + exhaustion_contrib + deferral_contrib, 1)
    total_score = min(100.0, max(0.0, total_score))

    # Pressure bands matching PPT:
    # 0–30: Low
    # 31–60: Moderate
    # 61–100: High
    if total_score <= 30.0:
        level = "Low"
    elif total_score <= 60.0:
        level = "Moderate"
    else:
        level = "High"

    explanation = (
        f"Resource pressure: {total_score}/100 ({level} Pressure). "
        f"Components: Utilization [{util_contrib:.1f} pts (max util {util_max*100:.1f}%)], "
        f"Available Share [{share_contrib:.1f} pts (peak share {share_capped*100:.1f}%)], "
        f"Exhaustion Risk [{exhaustion_contrib:.1f} pts ({exhausted_count}/4 resources depleted)], "
        f"Deferral History [{deferral_contrib:.1f} pts ({deferral_rate*100:.1f}% past deferrals)]."
    )

    return HeuristicScoreBreakdown(
        score=total_score,
        level=level,
        utilization_max=round(util_max, 3),
        utilization_contrib=round(util_contrib, 1),
        available_share_max=round(share_capped, 3),
        share_contrib=round(share_contrib, 1),
        exhaustion_ratio=round(exhaustion_ratio, 3),
        exhaustion_contrib=round(exhaustion_contrib, 1),
        process_deferral_rate=round(deferral_rate, 3),
        deferral_contrib=round(deferral_contrib, 1),
        explanation=explanation
    )


def extract_pre_decision_features(
    total: List[int],
    available: List[int],
    current_allocated: List[int],
    request: List[int],
    need: List[int],
    deferral_rate: float
) -> List[float]:
    """Extracts strictly pre-decision 17 numeric features for ML training or inference."""
    u = [current_allocated[j] / total[j] if total[j] > 0 else 0.0 for j in range(4)]
    return [
        float(u[0]), float(u[1]), float(u[2]), float(u[3]),
        float(request[0]), float(request[1]), float(request[2]), float(request[3]),
        float(available[0]), float(available[1]), float(available[2]), float(available[3]),
        float(need[0]), float(need[1]), float(need[2]), float(need[3]),
        float(deferral_rate)
    ]


def train_simulator_decision_tree():
    """
    Trains an advisory Decision Tree on synthetic 4-resource Banker's simulator runs.
    Uses pre-decision features and splits by simulation run to avoid data leakage.
    Returns evaluation metrics.
    """
    global TRAINED_MODEL, MODEL_METRICS
    from sklearn.tree import DecisionTreeClassifier
    from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix

    random.seed(42)
    np.random.seed(42)

    X_train, y_train = [], []
    X_test, y_test = [], []

    total_runs = 50
    requests_per_run = 14

    for run_id in range(total_runs):
        total = [12, 16, 12, 9]
        processes = [
            {"id": "P0", "name": "ATM Withdrawal", "max": [5, 4, 3, 2], "alloc": [1, 2, 1, 1]},
            {"id": "P1", "name": "UPI Payment", "max": [3, 5, 3, 3], "alloc": [2, 1, 2, 1]},
            {"id": "P2", "name": "Fund Transfer", "max": [7, 6, 5, 4], "alloc": [3, 3, 2, 2]},
            {"id": "P3", "name": "Loan Processing", "max": [4, 7, 4, 3], "alloc": [2, 4, 3, 1]},
            {"id": "P4", "name": "Online Banking", "max": [3, 4, 3, 2], "alloc": [1, 2, 1, 1]},
        ]

        for p in processes:
            p["need"] = vector_sub(p["max"], p["alloc"])

        run_history: Dict[str, List[bool]] = {p["id"]: [] for p in processes}

        for _ in range(requests_per_run):
            alloc_sum = [0, 0, 0, 0]
            for p in processes:
                alloc_sum = [a + b for a, b in zip(alloc_sum, p["alloc"])]
            available = vector_sub(total, alloc_sum)

            p = random.choice(processes)
            p_need = p["need"]

            req = [
                random.randint(0, min(p_need[j], max(0, available[j] + random.randint(0, 1))))
                for j in range(4)
            ]
            if req == [0, 0, 0, 0]:
                req[random.randint(0, 3)] = 1

            history = run_history[p["id"]]
            def_rate = (sum(1 for passed in history if not passed) / len(history)) if history else 0.0

            feats = extract_pre_decision_features(total, available, alloc_sum, req, p_need, def_rate)

            is_valid_need = vector_le(req, p_need)
            is_avail = vector_le(req, available)
            passed_safety = False

            if is_valid_need and is_avail:
                tentative_avail = vector_sub(available, req)
                tentative_alloc_map = {proc["id"]: list(proc["alloc"]) for proc in processes}
                tentative_alloc_map[p["id"]] = [a + b for a, b in zip(tentative_alloc_map[p["id"]], req)]
                tentative_need_map = {proc["id"]: list(proc["need"]) for proc in processes}
                tentative_need_map[p["id"]] = vector_sub(tentative_need_map[p["id"]], req)
                proc_names = {proc["id"]: proc["name"] for proc in processes}

                safety_res = run_safety_algorithm(
                    tentative_avail,
                    tentative_alloc_map,
                    tentative_need_map,
                    proc_names
                )
                if safety_res.is_safe:
                    passed_safety = True
                    p["alloc"] = tentative_alloc_map[p["id"]]
                    p["need"] = tentative_need_map[p["id"]]

            label = 1 if passed_safety else 0
            run_history[p["id"]].append(passed_safety)

            if run_id < 40:
                X_train.append(feats)
                y_train.append(label)
            else:
                X_test.append(feats)
                y_test.append(label)

    clf = DecisionTreeClassifier(max_depth=4, min_samples_leaf=4, random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()

    importances = {name: round(float(imp), 4) for name, imp in zip(FEATURE_NAMES, clf.feature_importances_)}

    TRAINED_MODEL = clf
    MODEL_METRICS = {
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": cm,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "feature_importances": importances,
        "is_trained": True,
        "model_type": "DecisionTreeClassifier (Pre-decision features, train/test split by simulation run)"
    }
    return MODEL_METRICS


def predict_request(
    total: List[int],
    available: List[int],
    allocated: List[int],
    request: List[int],
    need: List[int],
    deferral_rate: float
) -> Optional[MLPrediction]:
    """Predicts feasibility using pre-decision ML model. Purely advisory; does NOT replace Banker's Algorithm."""
    global TRAINED_MODEL
    if TRAINED_MODEL is None:
        try:
            train_simulator_decision_tree()
        except Exception:
            return None

    if TRAINED_MODEL is None:
        return None

    feats = extract_pre_decision_features(total, available, allocated, request, need, deferral_rate)
    proba = TRAINED_MODEL.predict_proba([feats])[0]
    conf_granted = float(proba[1]) if len(proba) > 1 else float(proba[0])
    predicted_safe = bool(conf_granted >= 0.5)

    feat_dict = {name: round(val, 2) for name, val in zip(FEATURE_NAMES, feats)}

    return MLPrediction(
        predicted_safe=predicted_safe,
        confidence_granted=round(conf_granted, 3),
        feature_summary=feat_dict,
        model_trained=True,
        status_note="Advisory ML estimation for classroom analysis; Banker's safety check is the mandatory gate."
    )
