import React, { useState } from 'react';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Info,
  CheckCircle2,
  Cpu,
  HardDrive,
  Database,
  Lock
} from 'lucide-react';
import { ResourceVectorChips } from '../components/ResourceBadge';

export function AlgorithmExplorer({ systemState }) {
  const [viewMode, setViewMode] = useState('beginner'); // 'beginner' | 'technical'
  const [currentStep, setCurrentStep] = useState(0);

  if (!systemState) {
    return <div className="p-8 text-center text-slate-500">Loading algorithm data...</div>;
  }

  const {
    total = [12, 16, 12, 9],
    available = [3, 4, 3, 3],
    allocated = [9, 12, 9, 6],
    processes = [],
    is_safe = true,
    safe_sequence = [],
    safety_trace = [],
    block_size_mb = 64
  } = systemState;

  const traceSteps = safety_trace || [];
  const totalSteps = traceSteps.length;
  const activeStep = traceSteps[currentStep] || traceSteps[0] || null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Banker’s Algorithm Interactive Explorer
              </h1>
              <p className="text-xs text-slate-500">
                Inspect step-by-step Work vector progression, Need matrix validation, and deadlock safety proofs.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('beginner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'beginner'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Beginner View
          </button>
          <button
            onClick={() => setViewMode('technical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'technical'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Technical Matrices
          </button>
        </div>
      </div>

      {/* Mandatory Permanent Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 shadow-sm">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <strong className="font-bold text-amber-950 block">
            Safety simulation: these steps do not complete live jobs.
          </strong>
          <p className="text-amber-800 leading-relaxed font-medium">
            The safe sequence is a mathematical existence proof showing that even if all running transactions simultaneously demand their declared maximum need, there exists at least one order of execution where no deadlock can occur. It is a possible completion order, not an enforced runtime scheduler order.
          </p>
        </div>
      </div>

      {/* Safe Sequence Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
        is_safe ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
      }`}>
        <div className="flex items-center gap-2.5">
          {is_safe ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-rose-600" />}
          <div>
            <span className="text-xs font-bold text-slate-800">
              {is_safe ? 'Safe Sequence Discovered' : 'Unsafe State — No Sequence Exists'}
            </span>
            {is_safe && (
              <div className="text-xs font-mono font-bold text-emerald-800 mt-0.5">
                {safe_sequence.join('  →  ')}
              </div>
            )}
          </div>
        </div>

        {totalSteps > 0 && (
          <div className="flex items-center gap-2">
            <button
              disabled={currentStep <= 0}
              onClick={() => setCurrentStep((c) => Math.max(0, c - 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-600 px-2 font-mono">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <button
              disabled={currentStep >= totalSteps - 1}
              onClick={() => setCurrentStep((c) => Math.min(totalSteps - 1, c + 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Next Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentStep(0)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition ml-1"
              title="Replay from Step 1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* BEGINNER VIEW */}
      {viewMode === 'beginner' && (
        <div className="space-y-4">
          {activeStep ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Step {activeStep.step}: Simulating {activeStep.process_name} ({activeStep.process_id})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Candidate Satisfied
                </span>
              </div>

              {/* 5 Guided Beginner Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Q1 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Question 1</span>
                  <h3 className="font-bold text-slate-800 text-sm">Which process can finish next?</h3>
                  <p className="text-slate-600 font-medium">
                    <strong className="text-indigo-600">{activeStep.process_name}</strong> (PID: <span className="font-mono">{activeStep.process_id}</span>).
                  </p>
                </div>

                {/* Q2 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Question 2</span>
                  <h3 className="font-bold text-slate-800 text-sm">What resources does it still need?</h3>
                  <div className="pt-1">
                    <ResourceVectorChips vector={activeStep.need} blockSizeMb={block_size_mb} />
                  </div>
                </div>

                {/* Q3 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Question 3</span>
                  <h3 className="font-bold text-slate-800 text-sm">Are those resources currently available in Work?</h3>
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      YES: Need &le; Work holds for all 4 resource types!
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Current Work: [{activeStep.work_before.join(', ')}]
                    </div>
                  </div>
                </div>

                {/* Q4 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Question 4</span>
                  <h3 className="font-bold text-slate-800 text-sm">What allocation is returned after simulated completion?</h3>
                  <div className="pt-1">
                    <ResourceVectorChips vector={activeStep.allocation} blockSizeMb={block_size_mb} />
                  </div>
                </div>
              </div>

              {/* Work Vector Update Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/50 border border-indigo-200 space-y-2">
                <span className="text-xs font-bold text-slate-800">
                  Question 5: What is the new Work vector, and which process can now finish?
                </span>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {activeStep.explanation}
                </p>
                <div className="flex items-center gap-4 text-xs pt-1 font-mono">
                  <span>Work Before: [{activeStep.work_before.join(', ')}]</span>
                  <span>+ Released: [{activeStep.allocation.join(', ')}]</span>
                  <span className="font-bold text-indigo-700">= Work After: [{activeStep.work_after.join(', ')}]</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              No active safety simulation steps available.
            </div>
          )}
        </div>
      )}

      {/* TECHNICAL VIEW: MATRICES & TRACE */}
      {viewMode === 'technical' && (
        <div className="space-y-6">
          {/* Matrices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Max Matrix */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Maximum Matrix [Claim]
              </span>
              <table className="w-full text-xs font-mono text-left">
                <thead className="text-[10px] text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-1">PID</th>
                    <th>CPU</th>
                    <th>MEM</th>
                    <th>DB</th>
                    <th>LOCK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processes.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 font-bold text-slate-700">{p.id}</td>
                      <td>{p.max[0]}</td>
                      <td>{p.max[1]}</td>
                      <td>{p.max[2]}</td>
                      <td>{p.max[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Allocation Matrix */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Allocation Matrix [Live]
              </span>
              <table className="w-full text-xs font-mono text-left">
                <thead className="text-[10px] text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-1">PID</th>
                    <th>CPU</th>
                    <th>MEM</th>
                    <th>DB</th>
                    <th>LOCK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processes.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 font-bold text-blue-700">{p.id}</td>
                      <td>{p.alloc[0]}</td>
                      <td>{p.alloc[1]}</td>
                      <td>{p.alloc[2]}</td>
                      <td>{p.alloc[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Need Matrix */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Need Matrix [Max - Alloc]
              </span>
              <table className="w-full text-xs font-mono text-left">
                <thead className="text-[10px] text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-1">PID</th>
                    <th>CPU</th>
                    <th>MEM</th>
                    <th>DB</th>
                    <th>LOCK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processes.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 font-bold text-amber-700">{p.id}</td>
                      <td>{p.need[0]}</td>
                      <td>{p.need[1]}</td>
                      <td>{p.need[2]}</td>
                      <td>{p.need[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Available & Total Vectors */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total System Capacity</span>
              <span className="font-bold text-slate-800">[{total.join(', ')}]</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Live Allocated Total</span>
              <span className="font-bold text-blue-700">[{allocated.join(', ')}]</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Live Available Vector</span>
              <span className="font-bold text-emerald-700">[{available.join(', ')}]</span>
            </div>
          </div>

          {/* Work Vector Step-by-Step Trace Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-2 p-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Work Vector Step-by-Step Simulation Trace
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Step</th>
                    <th className="py-2.5 px-3">Satisfied Process</th>
                    <th className="py-2.5 px-3">Need Vector</th>
                    <th className="py-2.5 px-3">Work Before</th>
                    <th className="py-2.5 px-3">Returned Allocation</th>
                    <th className="py-2.5 px-3">Work After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {traceSteps.map((t) => (
                    <tr key={t.step} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-bold text-indigo-600">{t.step}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{t.process_name} ({t.process_id})</td>
                      <td className="py-2.5 px-3 text-amber-700">[{t.need.join(', ')}]</td>
                      <td className="py-2.5 px-3 text-slate-600">[{t.work_before.join(', ')}]</td>
                      <td className="py-2.5 px-3 text-blue-700">[{t.allocation.join(', ')}]</td>
                      <td className="py-2.5 px-3 text-emerald-700 font-bold">[{t.work_after.join(', ')}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
