import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, ShieldAlert, Sparkles, PauseCircle } from 'lucide-react';

export function BankerStatusBadge({ status, size = 'sm' }) {
  const s = status || 'Not evaluated';

  if (s === 'Released' || s === 'Completed & Released') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
        Resources Released (Safe)
      </span>
    );
  }

  if (s === 'Safe') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Safe Sequence Verified
      </span>
    );
  }

  if (s === 'Unsafe') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
        Unsafe (Deadlock Risk)
      </span>
    );
  }

  if (s === 'Skipped') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        Skipped (Capacity Deficit)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Not Evaluated
    </span>
  );
}

export function PressureBadge({ score, level, size = 'sm' }) {
  if (score === undefined || score === null) return null;

  let colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let barColor = 'bg-emerald-500';

  if (level === 'Moderate' || (score > 30 && score <= 60)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    barColor = 'bg-amber-500';
  } else if (level === 'High' || score > 60) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    barColor = 'bg-rose-500';
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}>
        <Sparkles className="w-3 h-3" />
        <span>Pressure: <strong>{score}</strong>/100</span>
        <span className="font-normal opacity-75">({level || (score <= 30 ? 'Low' : score <= 60 ? 'Moderate' : 'High')})</span>
      </span>
    </div>
  );
}

export function AgentDecisionBadge({ decision }) {
  const d = decision || '';

  if (d.includes('Completed') || d.includes('Released')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-sm">
        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
        COMPLETED & RELEASED
      </span>
    );
  }

  if (d === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        APPROVED & COMMITTED
      </span>
    );
  }

  if (d.includes('Unsafe Result')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        QUEUED — UNSAFE RESULT
      </span>
    );
  }

  if (d.includes('Insufficient Resources')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
        <Clock className="w-4 h-4 text-amber-600" />
        QUEUED — INSUFFICIENT CAPACITY
      </span>
    );
  }

  if (d === 'Review Required') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-sm">
        <AlertTriangle className="w-4 h-4 text-purple-600" />
        REVIEW REQUIRED (SUPERVISOR)
      </span>
    );
  }

  if (d.includes('Deferred by Pressure')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-sm">
        <PauseCircle className="w-4 h-4 text-blue-600" />
        DEFERRED BY PRESSURE POLICY
      </span>
    );
  }

  if (d.includes('Invalid')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-sm">
        <XCircle className="w-4 h-4 text-rose-600" />
        INVALID REQUEST
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      {d}
    </span>
  );
}

export function StateChangedBadge({ stateChanged, isRelease }) {
  if (isRelease) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
        Live State: Released & Restored
      </span>
    );
  }
  if (stateChanged) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Live State: Committed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Live State: Unchanged
    </span>
  );
}
