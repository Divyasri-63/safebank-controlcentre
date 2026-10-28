import React, { useState, useEffect } from 'react';
import {
  History as HistoryIcon,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  X,
  ArrowRight,
  ArrowUpRight,
  Layers,
  Sparkles,
  AlertTriangle,
  FileCheck2,
  Server
} from 'lucide-react';
import { api } from '../api';
import { ResourceVectorChips } from '../components/ResourceBadge';
import { BankerStatusBadge, PressureBadge, AgentDecisionBadge, StateChangedBadge } from '../components/SafetyBadge';

export function RequestHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [procFilter, setProcFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [bankerFilter, setBankerFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getHistory({
        process_id: procFilter || undefined,
        decision_filter: decisionFilter || undefined,
        banker_filter: bankerFilter || undefined
      });
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [procFilter, decisionFilter, bankerFilter]);

  // Aggregate stats from current view or history
  const totalCount = history.length;
  const completedCount = history.filter(
    (r) => r.agent_decision?.includes('Completed') || r.agent_decision?.includes('Released')
  ).length;
  const approvedCount = history.filter((r) => r.agent_decision === 'Approved').length;
  const queuedCount = history.filter(
    (r) => r.agent_decision?.includes('Queued') || r.agent_decision?.includes('Deferred')
  ).length;

  const handleQuickFilter = (type) => {
    if (type === 'COMPLETED') {
      setDecisionFilter(decisionFilter === 'Completed' ? '' : 'Completed');
    } else if (type === 'APPROVED') {
      setDecisionFilter(decisionFilter === 'Approved' ? '' : 'Approved');
    } else if (type === 'QUEUED') {
      setDecisionFilter(decisionFilter === 'Queued' ? '' : 'Queued');
    } else {
      setDecisionFilter('');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <HistoryIcon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Audit History & System Snapshots
              </h1>
              <p className="text-xs text-slate-500">
                Immutable audit trail of transaction evaluations, Banker's Algorithm safety checks, and Complete & Release deallocations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}

      {/* Interactive Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Records */}
        <button
          onClick={() => handleQuickFilter('ALL')}
          className={`p-3 rounded-xl border text-left transition shadow-sm ${
            decisionFilter === ''
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className={`text-[10px] uppercase font-bold block ${decisionFilter === '' ? 'text-slate-400' : 'text-slate-400'}`}>
            Total Events
          </span>
          <span className="text-xl font-black">{totalCount}</span>
          <span className={`text-[10px] block mt-0.5 ${decisionFilter === '' ? 'text-slate-300' : 'text-slate-500'}`}>
            All recorded transactions
          </span>
        </button>

        {/* Completed & Released Card (Feature Highlight) */}
        <button
          onClick={() => handleQuickFilter('COMPLETED')}
          className={`p-3 rounded-xl border text-left transition shadow-sm ${
            decisionFilter === 'Completed'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
              : 'bg-indigo-50/60 text-indigo-950 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold block ${decisionFilter === 'Completed' ? 'text-indigo-200' : 'text-indigo-600'}`}>
              Completed & Released
            </span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${decisionFilter === 'Completed' ? 'text-indigo-200' : 'text-indigo-600'}`} />
          </div>
          <span className="text-xl font-black">{completedCount}</span>
          <span className={`text-[10px] block mt-0.5 font-medium ${decisionFilter === 'Completed' ? 'text-indigo-100' : 'text-indigo-700'}`}>
            Freed & restored resources
          </span>
        </button>

        {/* Approved Requests */}
        <button
          onClick={() => handleQuickFilter('APPROVED')}
          className={`p-3 rounded-xl border text-left transition shadow-sm ${
            decisionFilter === 'Approved'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
              : 'bg-emerald-50/50 text-emerald-950 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold block ${decisionFilter === 'Approved' ? 'text-emerald-200' : 'text-emerald-600'}`}>
              Approved Requests
            </span>
            <FileCheck2 className={`w-3.5 h-3.5 ${decisionFilter === 'Approved' ? 'text-emerald-200' : 'text-emerald-600'}`} />
          </div>
          <span className="text-xl font-black">{approvedCount}</span>
          <span className={`text-[10px] block mt-0.5 font-medium ${decisionFilter === 'Approved' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            Safe allocations committed
          </span>
        </button>

        {/* Queued / Deferred Requests */}
        <button
          onClick={() => handleQuickFilter('QUEUED')}
          className={`p-3 rounded-xl border text-left transition shadow-sm ${
            decisionFilter === 'Queued'
              ? 'bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
              : 'bg-amber-50/50 text-amber-950 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold block ${decisionFilter === 'Queued' ? 'text-amber-200' : 'text-amber-600'}`}>
              Queued / Deferred
            </span>
            <Clock className={`w-3.5 h-3.5 ${decisionFilter === 'Queued' ? 'text-amber-200' : 'text-amber-600'}`} />
          </div>
          <span className="text-xl font-black">{queuedCount}</span>
          <span className={`text-[10px] block mt-0.5 font-medium ${decisionFilter === 'Queued' ? 'text-amber-100' : 'text-amber-700'}`}>
            Awaiting future releases
          </span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-slate-700 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" /> Filters:
        </span>

        {/* Process Filter */}
        <select
          value={procFilter}
          onChange={(e) => setProcFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Services (P0 — P4)</option>
          <option value="P0">P0 — ATM Withdrawal</option>
          <option value="P1">P1 — UPI Payment</option>
          <option value="P2">P2 — Fund Transfer</option>
          <option value="P3">P3 — Loan Processing</option>
          <option value="P4">P4 — Online Banking</option>
        </select>

        {/* Decision Filter */}
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Agent Decisions</option>
          <option value="Completed">Completed & Released</option>
          <option value="Approved">Approved</option>
          <option value="Queued">Queued</option>
          <option value="Review Required">Review Required</option>
          <option value="Deferred">Deferred by Pressure Policy</option>
          <option value="Invalid">Invalid Request</option>
        </select>

        {/* Banker Filter */}
        <select
          value={bankerFilter}
          onChange={(e) => setBankerFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Banker Statuses</option>
          <option value="Safe">Safe</option>
          <option value="Unsafe">Unsafe</option>
          <option value="Skipped">Skipped</option>
          <option value="Not evaluated">Not evaluated</option>
        </select>

        {(procFilter || decisionFilter || bankerFilter) && (
          <button
            onClick={() => {
              setProcFilter('');
              setDecisionFilter('');
              setBankerFilter('');
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No audit records match the current filters. Click "Complete & Release" on an active process in Bank Overview or submit requests to populate history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Service & Event Type</th>
                  <th className="py-3 px-4">Resources (Req / Released)</th>
                  <th className="py-3 px-4">Banker Gate</th>
                  <th className="py-3 px-4">Pressure</th>
                  <th className="py-3 px-4">Decision / Action</th>
                  <th className="py-3 px-4">Live State</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((r) => {
                  const isRelease = r.agent_decision?.includes('Completed') || r.agent_decision?.includes('Released');

                  return (
                    <tr
                      key={r.id}
                      className={`transition ${
                        isRelease ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {r.timestamp}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isRelease ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" /> Release Event
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                              Request Event
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 block">
                          {r.process_name} <span className="font-mono text-slate-400 font-normal">({r.process_id})</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isRelease ? (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" /> Released to Pool:
                            </span>
                            <ResourceVectorChips vector={r.request} size="xs" />
                          </div>
                        ) : (
                          <ResourceVectorChips vector={r.request} size="xs" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <BankerStatusBadge status={r.banker_status} />
                      </td>
                      <td className="py-3 px-4">
                        <PressureBadge score={r.pressure_score} level={r.pressure_level} />
                      </td>
                      <td className="py-3 px-4">
                        <AgentDecisionBadge decision={r.agent_decision} />
                      </td>
                      <td className="py-3 px-4">
                        <StateChangedBadge stateChanged={r.state_changed} isRelease={isRelease} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                            isRelease
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Snapshot Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block uppercase">
                  Audit Record #{selectedRecord.id} • {selectedRecord.request_id || 'REQ-SYS'}
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedRecord.agent_decision?.includes('Completed') || selectedRecord.agent_decision?.includes('Released')
                    ? `Job Completed & Resources Released — ${selectedRecord.process_name} (${selectedRecord.process_id})`
                    : `Transaction Audit Inspection — ${selectedRecord.process_name} (${selectedRecord.process_id})`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-3">
                <AgentDecisionBadge decision={selectedRecord.agent_decision} />
                <BankerStatusBadge status={selectedRecord.banker_status} />
                <PressureBadge score={selectedRecord.pressure_score} level={selectedRecord.pressure_level} />
                <StateChangedBadge
                  stateChanged={selectedRecord.state_changed}
                  isRelease={selectedRecord.agent_decision?.includes('Completed') || selectedRecord.agent_decision?.includes('Released')}
                />
              </div>

              {/* Complete & Release Dedicated Audit Box */}
              {(selectedRecord.agent_decision?.includes('Completed') || selectedRecord.agent_decision?.includes('Released')) && (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                      Job Execution Completion & Resource Deallocation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-indigo-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        PROCESS STATUS TRANSITION
                      </span>
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px]">ACTIVE</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px]">COMPLETED</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-indigo-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        FREED RESOURCES RETURNED
                      </span>
                      <ResourceVectorChips vector={selectedRecord.request} size="xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Reason */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  DETAILED AUDIT LOG & REASON
                </span>
                <p className="text-slate-800 font-medium leading-relaxed">{selectedRecord.decision_reason}</p>
              </div>

              {/* Safe Execution Sequence */}
              {selectedRecord.safe_sequence?.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono">
                  Safe Execution Sequence: <strong>{selectedRecord.safe_sequence.join(' → ')}</strong>
                </div>
              )}

              {/* State Snapshots: Available Vector Comparison */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Available Capacity Vector Comparison
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold mb-1">
                      {selectedRecord.agent_decision?.includes('Completed') || selectedRecord.agent_decision?.includes('Released')
                        ? 'PRE-RELEASE AVAILABLE'
                        : 'PRE-DECISION AVAILABLE'}
                    </span>
                    <ResourceVectorChips vector={selectedRecord.pre_state?.available} />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold mb-1">
                      {selectedRecord.agent_decision?.includes('Completed') || selectedRecord.agent_decision?.includes('Released')
                        ? 'POST-RELEASE AVAILABLE (EXPANDED)'
                        : selectedRecord.state_changed
                        ? 'POST-DECISION AVAILABLE (COMMITTED)'
                        : 'TENTATIVE ALLOCATION (NOT COMMITTED)'}
                    </span>
                    <ResourceVectorChips
                      vector={
                        selectedRecord.state_changed
                          ? selectedRecord.post_state?.available
                          : selectedRecord.tentative_state?.available
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Theory & Operating Systems Invariant */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <strong className="block text-blue-950 font-bold mb-0.5">
                  OS Banker's Algorithm Invariant:
                </strong>
                {selectedRecord.agent_decision?.includes('Completed') || selectedRecord.agent_decision?.includes('Released') ? (
                  <span>
                    When a process completes execution, all its allocated resources are returned to the system Available pool
                    (<strong>Work = Work + Allocation_i</strong>). This expands system capacity and automatically triggers queue
                    re-evaluation so waiting requests can be satisfied safely without deadlock.
                  </span>
                ) : (
                  <span>
                    Banker's Algorithm guarantees that a request is only approved if there exists at least one order of
                    completion that satisfies all active claims without entering deadlock.
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
