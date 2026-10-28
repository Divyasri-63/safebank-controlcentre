import React, { useState } from 'react';
import {
  Cpu, HardDrive, Database, Lock,
  Smartphone, CreditCard, ArrowLeftRight, FileText, Globe,
  ShieldCheck, ShieldAlert, CheckCircle2, Clock, Play, PlusCircle,
  ArrowRight, X
} from 'lucide-react';
import { ResourceVectorChips } from '../components/ResourceBadge';
import { BankerStatusBadge } from '../components/SafetyBadge';
import { api } from '../api';

const SERVICE_ICONS = {
  P0: CreditCard,       // ATM Withdrawal
  P1: Smartphone,       // UPI Payment
  P2: ArrowLeftRight,   // Fund Transfer
  P3: FileText,         // Loan Processing
  P4: Globe,            // Online Banking
};

export function BankOverview({ systemState, onRefresh, onNavigateSubmit, onOpenDemo, onNavigateHistory }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [releaseFeedback, setReleaseFeedback] = useState(null);
  const [error, setError] = useState(null);

  if (!systemState) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        Loading bank computing resource state...
      </div>
    );
  }

  const {
    total = [12, 16, 12, 9],
    allocated = [9, 12, 9, 6],
    available = [3, 4, 3, 3],
    processes = [],
    is_safe = true,
    safe_sequence = [],
    active_count = 5,
    completed_count = 0,
    waiting_count = 0,
    block_size_mb = 64
  } = systemState;

  const handleCompleteJob = async (processId, processName) => {
    setActionLoading(processId);
    setError(null);
    setReleaseFeedback(null);
    try {
      const res = await api.completeProcess(processId);
      setReleaseFeedback({
        message: res.message,
        released: res.released_formatted,
        queueNote: res.queue_reevaluation?.length > 0
          ? `Queue re-evaluated: ${res.queue_reevaluation.length} item(s) processed.`
          : 'Waiting queue re-evaluated (no pending items).'
      });
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const resourceCards = [
    {
      name: 'CPU Processing Slots',
      unit: 'slots',
      icon: Cpu,
      avail: available[0],
      alloc: allocated[0],
      tot: total[0],
      pct: Math.round((allocated[0] / total[0]) * 100),
      explanation: 'Reserved concurrent computing execution slots for active transactions.',
      color: 'indigo'
    },
    {
      name: 'Memory Blocks',
      unit: 'blocks',
      icon: HardDrive,
      avail: available[1],
      alloc: allocated[1],
      tot: total[1],
      pct: Math.round((allocated[1] / total[1]) * 100),
      extra: `${available[1] * block_size_mb} MB free of ${total[1] * block_size_mb} MB total`,
      explanation: `Allocated in fixed ${block_size_mb} MB blocks to prevent memory fragmentation.`,
      color: 'emerald'
    },
    {
      name: 'Database Connections',
      unit: 'connections',
      icon: Database,
      avail: available[2],
      alloc: allocated[2],
      tot: total[2],
      pct: Math.round((allocated[2] / total[2]) * 100),
      explanation: 'Dedicated transactional connections to PostgreSQL database pool.',
      color: 'blue'
    },
    {
      name: 'Transaction-Lock Slots',
      unit: 'permits',
      icon: Lock,
      avail: available[3],
      alloc: allocated[3],
      tot: total[3],
      pct: Math.round((allocated[3] / total[3]) * 100),
      explanation: 'Interchangeable simulated lock permits for ledger row protection.',
      color: 'purple'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Managing the bank’s shared computing resources
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time operating system allocation monitor for ATM, UPI, Fund Transfers, Loans, and Online Banking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Guided Demo</span>
          </button>
          <button
            onClick={() => onNavigateSubmit && onNavigateSubmit()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Resource Request</span>
          </button>
        </div>
      </div>

      {/* Release or Error Alert */}
      {releaseFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start justify-between shadow-sm">
          <div>
            <strong className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {releaseFeedback.message}
            </strong>
            <p className="mt-1 text-emerald-700">
              Released Resources: <span className="font-mono font-semibold">{releaseFeedback.released}</span>
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">{releaseFeedback.queueNote}</p>
          </div>
          <button onClick={() => setReleaseFeedback(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between shadow-sm">
          <div>
            <strong className="font-bold">Action Failed:</strong> {error}
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {/* Safety Summary Banner */}
      <div className={`p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        is_safe
          ? 'bg-gradient-to-r from-emerald-50/60 via-white to-blue-50/40 border-emerald-200'
          : 'bg-gradient-to-r from-rose-50/60 via-white to-amber-50/40 border-rose-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${
            is_safe ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'
          }`}>
            {is_safe ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Current Banker's Safety Status: {is_safe ? 'SAFE STATE' : 'UNSAFE STATE'}
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                is_safe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {is_safe ? 'Deadlock Free' : 'Potential Deadlock'}
              </span>
            </div>
            {is_safe && safe_sequence?.length > 0 ? (
              <p className="text-xs text-slate-600 mt-0.5 font-mono">
                Verified Execution Order: <strong className="text-emerald-700">{safe_sequence.join(' → ')}</strong>
              </p>
            ) : (
              <p className="text-xs text-rose-600 mt-0.5">
                No safe process execution order found under declared claims.
              </p>
            )}
          </div>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Running Jobs</span>
            <span className="text-base font-extrabold text-blue-600">{active_count}</span>
          </div>
          <div className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Waiting Queue</span>
            <span className={`text-base font-extrabold ${waiting_count > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`}>
              {waiting_count}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Completed</span>
            <span className="text-base font-extrabold text-slate-600">{completed_count}</span>
          </div>
        </div>
      </div>

      {/* Release Feedback Notification */}
      {releaseFeedback && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-teal-50 border border-emerald-300 shadow-sm flex items-start justify-between gap-3 animate-fade-in text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{releaseFeedback.message}</span>
            </div>
            <p className="text-emerald-800">
              Released capacity returned to Available pool: <strong>{releaseFeedback.released}</strong>
            </p>
            <p className="text-emerald-700 font-medium">{releaseFeedback.queueNote}</p>
            {onNavigateHistory && (
              <button
                onClick={onNavigateHistory}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm active:scale-95"
              >
                <span>View Complete & Release Event in Audit History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setReleaseFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Resource Availability Cards */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Four Banking Server Resource Categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resourceCards.map((rc, idx) => {
            const Icon = rc.icon;
            return (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{rc.name}</span>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {rc.avail}
                      <span className="text-xs font-normal text-slate-500 ml-1">/ {rc.tot} {rc.unit}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      {rc.pct}% util
                    </span>
                  </div>

                  {rc.extra && (
                    <p className="text-[11px] font-semibold text-emerald-600 mb-2">
                      {rc.extra}
                    </p>
                  )}

                  {/* Utilization Progress Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rc.pct > 80 ? 'bg-rose-500' : rc.pct > 60 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${rc.pct}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-tight pt-2 border-t border-slate-100">
                  {rc.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Five Banking Services Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Active Banking Workflows (P0 — P4)
          </h2>
          <span className="text-[11px] text-slate-400">
            * Simulated computing jobs. Approval reserves server resources, not financial balance.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processes.map((p) => {
            const Icon = SERVICE_ICONS[p.id] || CreditCard;
            const isCompleted = p.status === 'COMPLETED';
            const isLoading = actionLoading === p.id;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border p-4 shadow-sm transition flex flex-col justify-between ${
                  isCompleted ? 'border-slate-200 bg-slate-50/50 opacity-75' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                        {p.id}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{p.name}</h3>
                        <span className="text-[10px] text-slate-500">Service Workflow</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isCompleted ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {p.status}
                    </span>
                  </div>

                  {/* Resource Badges */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Allocated Resources:</span>
                      <ResourceVectorChips vector={p.alloc} blockSizeMb={block_size_mb} />
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Remaining Need:</span>
                      <ResourceVectorChips vector={p.need} blockSizeMb={block_size_mb} />
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      Declared Max: <span className="font-mono">[{p.max.join(', ')}]</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    disabled={isCompleted}
                    onClick={() => onNavigateSubmit && onNavigateSubmit(p.id)}
                    className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition text-center"
                  >
                    Request
                  </button>
                  <button
                    disabled={isCompleted || isLoading}
                    onClick={() => handleCompleteJob(p.id, p.name)}
                    className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition text-center"
                  >
                    {isLoading ? 'Releasing...' : 'Complete & Release'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resource Allocation Comparison Chart (Explicit Units) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Resource Capacity vs Live Allocation</h2>
            <p className="text-xs text-slate-500">
              Measured in explicit system units (CPU slots, 64 MB memory blocks, DB pool connections, Lock permits).
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-3 h-3 rounded-sm bg-blue-600" />
              Allocated
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              Available
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {resourceCards.map((rc, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-800 mb-1">{rc.name}</div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span>Total: <strong>{rc.tot}</strong> {rc.unit}</span>
                <span>{rc.extra ? rc.extra : ''}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Allocated:</span>
                  <span className="font-bold text-blue-700">{rc.alloc}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Available:</span>
                  <span className="font-bold text-emerald-700">{rc.avail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
