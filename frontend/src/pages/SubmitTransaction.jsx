import React, { useState, useEffect } from 'react';
import {
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Info,
  DollarSign
} from 'lucide-react';
import { api } from '../api';
import { ResourceVectorChips, RESOURCE_META } from '../components/ResourceBadge';
import { BankerStatusBadge, PressureBadge, AgentDecisionBadge, StateChangedBadge } from '../components/SafetyBadge';

export function SubmitTransaction({ systemState, initialProcessId, onRefresh }) {
  const processes = systemState?.processes || [];
  const available = systemState?.available || [3, 4, 3, 3];
  const blockSizeMb = systemState?.block_size_mb || 64;

  const [selectedPid, setSelectedPid] = useState(initialProcessId || 'P1');
  const [requestVector, setRequestVector] = useState([0, 1, 0, 0]);
  const [amount, setAmount] = useState('2500');
  const [submitting, setSubmitting] = useState(false);
  const [decisionResult, setDecisionResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialProcessId) {
      setSelectedPid(initialProcessId);
    }
  }, [initialProcessId]);

  const selectedProc = processes.find((p) => p.id === selectedPid) || processes[0] || {
    id: 'P1',
    name: 'UPI Payment',
    max: [3, 5, 3, 3],
    alloc: [2, 1, 2, 1],
    need: [1, 4, 1, 2],
    status: 'ACTIVE'
  };

  const handleVectorChange = (index, val) => {
    const num = parseInt(val, 10);
    const safeVal = isNaN(num) ? 0 : Math.max(0, num);
    const updated = [...requestVector];
    updated[index] = safeVal;
    setRequestVector(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        process_id: selectedPid,
        request: requestVector,
        transaction_amount_illustrative: amount ? parseFloat(amount) : null
      };

      const res = await api.submitRequest(payload);
      setDecisionResult(res);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const generateSummaryText = () => {
    const r = requestVector;
    return `${selectedProc.name} (${selectedProc.id}) requests ${r[0]} CPU slot${r[0] !== 1 ? 's' : ''}, ${r[1]} memory block${r[1] !== 1 ? 's' : ''} (${r[1] * blockSizeMb} MB), ${r[2]} database connection${r[2] !== 1 ? 's' : ''}, and ${r[3]} lock slot${r[3] !== 1 ? 's' : ''}.`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Submit Transaction Resource Request
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Request shared server capacity for banking transactions. Evaluated synchronously by the Decision Agent.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <strong>Request Submission Error:</strong> {error}
        </div>
      )}

      {/* Guided Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Step 1: Select Service */}
        <div>
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
            Step 1: Select Banking Service
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {processes.map((p) => {
              const isSelected = p.id === selectedPid;
              const isCompleted = p.status === 'COMPLETED';
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={isCompleted}
                  onClick={() => {
                    setSelectedPid(p.id);
                    setDecisionResult(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    isCompleted
                      ? 'border-slate-200 bg-slate-50 opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{p.id}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      isCompleted ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-700 block truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Enter Resource Units */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Step 2: Enter Requested Resource Units
            </label>
            <span className="text-[11px] text-slate-500">
              Comparing against live Available capacity & Remaining Need
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {RESOURCE_META.map((meta, idx) => {
              const Icon = meta.icon;
              const pNeed = selectedProc.need?.[idx] ?? 0;
              const curAvail = available[idx] ?? 0;
              const reqVal = requestVector[idx];
              const exceedsNeed = reqVal > pNeed;
              const exceedsAvail = reqVal > curAvail;

              return (
                <div key={meta.key} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">[{meta.unit}]</span>
                  </div>

                  <input
                    type="number"
                    min="0"
                    value={reqVal}
                    onChange={(e) => handleVectorChange(idx, e.target.value)}
                    className={`w-full px-3 py-2 text-sm font-bold rounded-lg border bg-white focus:outline-none focus:ring-2 ${
                      exceedsNeed
                        ? 'border-rose-400 focus:ring-rose-200 text-rose-700'
                        : exceedsAvail
                        ? 'border-amber-400 focus:ring-amber-200 text-amber-700'
                        : 'border-slate-300 focus:ring-blue-200 text-slate-900'
                    }`}
                  />

                  {/* Context Metrics */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">Need: <strong className="text-slate-700">{pNeed}</strong></span>
                    <span className="text-slate-500">Avail: <strong className="text-emerald-700">{curAvail}</strong></span>
                  </div>

                  {idx === 1 && (
                    <span className="text-[10px] text-emerald-600 block">
                      = {reqVal * blockSizeMb} MB requested
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Illustrative Business Amount */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              Illustrative Transaction Amount (Business Context)
            </span>
            <p className="text-[11px] text-slate-500">
              * Educational label: This financial amount is illustrative context only; the Decision Agent evaluates OS computing resources.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500"
              className="w-32 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {/* Dynamic Plain-Language Summary */}
        <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/70 text-xs text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block mb-0.5">Summary of Request:</strong>
            <p className="text-blue-800 font-mono text-[11px]">{generateSummaryText()}</p>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition active:scale-95"
          >
            {submitting ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{submitting ? 'Evaluating with Agent...' : 'Submit to Decision Agent'}</span>
          </button>
        </div>
      </form>

      {/* EXPLAINABLE DECISION OUTPUT (4 Sections A, B, C, D) */}
      {decisionResult && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                Evaluation Snapshot #{decisionResult.request_id}
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Decision Agent Explainable Evaluation Output
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <AgentDecisionBadge decision={decisionResult.agent_decision} />
              <StateChangedBadge stateChanged={decisionResult.state_changed} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section A: Your Request */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Section A: Your Request
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900">{decisionResult.process_name} ({decisionResult.process_id})</span>
                {amount && <span className="text-xs text-slate-500">${amount} business volume</span>}
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Requested Capacity:</span>
                <ResourceVectorChips vector={decisionResult.request} blockSizeMb={blockSizeMb} />
              </div>
            </div>

            {/* Section B: Banker's Check */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Section B: Banker’s Safety Check
                </span>
                <BankerStatusBadge status={decisionResult.banker_status} />
              </div>
              <p className="text-xs text-slate-700">
                {decisionResult.banker_status === 'Safe'
                  ? `Safety verified: System found a valid execution order (${decisionResult.safe_sequence.join(' → ')}) ensuring zero deadlock.`
                  : decisionResult.banker_status === 'Unsafe'
                  ? 'Safety check failed: Tentative state leaves no process able to guarantee completion without deadlock.'
                  : 'Check skipped: Capacity deficit or input validation pre-condition failed.'}
              </p>
              {decisionResult.safe_sequence?.length > 0 && (
                <div className="text-[11px] font-mono text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                  Safe Sequence: {decisionResult.safe_sequence.join(' → ')}
                </div>
              )}
            </div>

            {/* Section C: Pressure Assessment */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Section C: Resource-Pressure Assessment
                </span>
                <PressureBadge score={decisionResult.pressure_score} level={decisionResult.pressure_level} />
              </div>
              <p className="text-xs text-slate-600">
                {decisionResult.heuristic_analysis?.explanation || 'Pressure evaluated from pre-decision features.'}
              </p>
              {/* Feature contributions table */}
              {decisionResult.heuristic_analysis && (
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Utilization Contrib (25%)</span>
                    <strong className="text-slate-800">{decisionResult.heuristic_analysis.utilization_contrib} pts</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Available Share (40%)</span>
                    <strong className="text-slate-800">{decisionResult.heuristic_analysis.share_contrib} pts</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Exhaustion Depletion (20%)</span>
                    <strong className="text-slate-800">{decisionResult.heuristic_analysis.exhaustion_contrib} pts</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Deferral History (15%)</span>
                    <strong className="text-slate-800">{decisionResult.heuristic_analysis.deferral_contrib} pts</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Section D: Decision Agent */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Section D: Decision Agent Policy Verdict
              </span>
              <p className="text-xs text-slate-800 font-medium">
                {decisionResult.decision_reason}
              </p>
              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                Next action:{' '}
                <strong className="text-slate-700">
                  {decisionResult.state_changed
                    ? 'Allocation committed. Service is executing with reserved capacity.'
                    : decisionResult.agent_decision.includes('Queued')
                    ? 'Request waiting in FIFO queue. Will retry after resource release.'
                    : decisionResult.agent_decision === 'Review Required'
                    ? 'Awaiting supervisor authorization in Waiting Queue.'
                    : 'Request retained in original state.'}
                </strong>
              </div>
            </div>
          </div>

          {/* Resource Count Comparison (Before vs Tentative) */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
            <span className="text-xs font-bold text-slate-800 block mb-2">
              Live vs Tentative Resource Capacity
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">PRE-DECISION AVAILABLE</span>
                <ResourceVectorChips vector={decisionResult.pre_state?.available} blockSizeMb={blockSizeMb} />
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {decisionResult.state_changed ? 'COMMITTED POST-STATE' : 'TENTATIVE ALLOCATION (NOT COMMITTED)'}
                </span>
                <ResourceVectorChips
                  vector={decisionResult.state_changed ? decisionResult.post_state?.available : decisionResult.tentative_state?.available}
                  blockSizeMb={blockSizeMb}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
