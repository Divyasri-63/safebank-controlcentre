import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Info,
  RotateCcw
} from 'lucide-react';
import { api } from '../api';
import { AgentDecisionBadge, BankerStatusBadge, PressureBadge } from '../components/SafetyBadge';

export function DecisionAgentPage() {
  const [policyData, setPolicyData] = useState(null);
  const [recentDecisions, setRecentDecisions] = useState([]);
  const [lowThresh, setLowThresh] = useState(30);
  const [modThresh, setModThresh] = useState(60);
  const [updateMsg, setUpdateMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchPolicy = async () => {
    try {
      const data = await api.getAgentPolicy();
      setPolicyData(data);
      if (data.config) {
        setLowThresh(data.config.low_pressure_threshold);
        setModThresh(data.config.moderate_pressure_threshold);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchRecentHistory = async () => {
    try {
      const hist = await api.getHistory();
      setRecentDecisions(hist.slice(0, 5));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPolicy();
    fetchRecentHistory();
  }, []);

  const handleUpdateThresholds = async (e) => {
    e.preventDefault();
    setUpdateMsg(null);
    setError(null);
    try {
      const res = await api.updateAgentPolicy(lowThresh, modThresh);
      setUpdateMsg('Policy thresholds successfully updated.');
      setPolicyData((prev) => ({ ...prev, config: res.config }));
    } catch (err) {
      setError(err.message);
    }
  };

  const workflowSteps = [
    { step: '1', title: 'Request Received', desc: 'Captures service ID, 4-resource vector, and state snapshot.' },
    { step: '2', title: 'Input Checked', desc: 'Validates non-negative integers, process status, and Need bounds.' },
    { step: '3', title: 'Availability Checked', desc: 'Verifies if Request <= Available. If deficit, placed in FIFO queue.' },
    { step: '4', title: 'Safety Checked', desc: 'Simulates Banker’s Algorithm to prove a deadlock-free sequence exists.' },
    { step: '5', title: 'Pressure Evaluated', desc: 'Computes 0–100 contention score across utilization, share, and exhaustion.' },
    { step: '6', title: 'Policy Applied', desc: 'Applies deterministic rules: Approve (Low), Review (Moderate), Defer (High).' },
    { step: '7', title: 'Decision Recorded', desc: 'Atomic commit to DB or persistence to Waiting Queue & Audit History.' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Decision Agent & Allocation Policy Engine
            </h1>
            <p className="text-xs text-slate-500">
              The real backend decision coordinator enforcing safety gates, pressure limits, and supervisor reviews.
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Role Statement Callout */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200 shadow-sm flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="text-xs font-bold text-blue-900 block mb-0.5">
            System Architecture Role Statement
          </span>
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
            “The Decision Agent coordinates checks and applies allocation policy. Banker’s Algorithm provides the mandatory safety gate.”
          </p>
          <span className="text-[11px] text-blue-600 mt-1 block">
            The Decision Agent cannot override an unsafe Banker result, supervisor approval cannot bypass safety validation, and risk predictions cannot grant an unsafe request.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}

      {/* Observable 7-Step Workflow Diagram */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          Observable 7-Step Evaluation Workflow
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {workflowSteps.map((ws, idx) => (
            <div
              key={ws.step}
              className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between relative group hover:border-blue-300 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center">
                    {ws.step}
                  </span>
                  {idx < 6 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden lg:block absolute -right-2 top-4 z-10 bg-white rounded-full" />
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-800 leading-tight mb-1">{ws.title}</h3>
                <p className="text-[11px] text-slate-500 leading-snug">{ws.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Policy Rules & Precedence Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Deterministic Policy Precedence Table
            </h2>
            <p className="text-xs text-slate-500">
              Evaluated strictly in priority order from Precedence A through F.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Engine: {policyData?.config?.version || '1.0-deterministic'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Precedence</th>
                <th className="py-2.5 px-3">Condition & Input</th>
                <th className="py-2.5 px-3">Banker Gate</th>
                <th className="py-2.5 px-3">Pressure</th>
                <th className="py-2.5 px-3">Policy Action</th>
                <th className="py-2.5 px-3">Committed?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(policyData?.rules || []).map((rule) => (
                <tr key={rule.precedence} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{rule.precedence}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    <div>{rule.condition}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{rule.rationale}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {rule.banker_check}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{rule.pressure_check}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rule.action.includes('Approve') ? 'bg-emerald-100 text-emerald-800' :
                      rule.action.includes('Review') ? 'bg-purple-100 text-purple-800' :
                      rule.action.includes('Defer') ? 'bg-blue-100 text-blue-800' :
                      rule.action.includes('Queue') ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {rule.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {rule.allocation_committed ? (
                      <span className="text-emerald-700 font-bold">YES</span>
                    ) : (
                      <span className="text-slate-400">NO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configurable Educational Thresholds */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Educational Policy Threshold Calibration
            </h2>
          </div>
          {updateMsg && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {updateMsg}
            </span>
          )}
        </div>

        <form onSubmit={handleUpdateThresholds} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              Low Pressure Limit (Automatic Approval)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={modThresh - 1}
                value={lowThresh}
                onChange={(e) => setLowThresh(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs font-mono text-slate-500">pts</span>
            </div>
            <p className="text-[10px] text-slate-500">Requests with score &le; {lowThresh} are auto-approved if safe.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              Moderate Pressure Limit (Supervisor Review)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={lowThresh + 1}
                max="99"
                value={modThresh}
                onChange={(e) => setModThresh(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs font-mono text-slate-500">pts</span>
            </div>
            <p className="text-[10px] text-slate-500">Requests between {lowThresh} and {modThresh} require supervisor review.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition active:scale-95"
            >
              Update Policy Thresholds
            </button>
          </div>
        </form>
      </div>

      {/* Live Decision Audit Preview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Recent Decision Agent Policy Outcomes
        </h2>
        {recentDecisions.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No decisions logged yet. Submit a request or run a classroom demo to see live outputs.
          </p>
        ) : (
          <div className="space-y-2">
            {recentDecisions.map((rd) => (
              <div key={rd.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{rd.process_name} ({rd.process_id})</span>
                    <AgentDecisionBadge decision={rd.agent_decision} />
                    <span className="text-[10px] text-slate-400 font-mono">{rd.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{rd.decision_reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <BankerStatusBadge status={rd.banker_status} />
                  <PressureBadge score={rd.pressure_score} level={rd.pressure_level} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
