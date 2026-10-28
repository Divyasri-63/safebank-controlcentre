import React, { useState, useEffect } from 'react';
import { X, Sparkles, Play, RotateCcw, CheckCircle2, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { ResourceVectorChips } from './ResourceBadge';
import { BankerStatusBadge, PressureBadge, AgentDecisionBadge } from './SafetyBadge';

export function ClassroomDemoModal({ isOpen, onClose, onRefreshState }) {
  const [demos, setDemos] = useState([]);
  const [runningId, setRunningId] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      api.getDemoScenarios()
        .then(setDemos)
        .catch((e) => setError(e.message));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunDemo = async (scenarioId) => {
    setRunningId(scenarioId);
    setError(null);
    setLastResult(null);

    try {
      // 1. Reset state to clean seed so the scenario always executes from its documented starting state
      await api.resetDemoScenario();

      // 2. If Scenario 6 (Complete & Retry), first submit an insufficient capacity request so the queue has an item to retry!
      if (scenarioId === 6) {
        // Enqueue P0 requesting [4, 0, 0, 0] (needs 4 CPU, but only 3 available)
        await api.submitRequest({
          process_id: 'P0',
          request: [4, 0, 0, 0],
          transaction_amount_illustrative: 50000
        });
      }

      // 3. Run the target scenario
      const res = await api.runDemoScenario(scenarioId);
      setLastResult(res);

      // 4. Trigger global state refresh
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Classroom Demonstration Suite</h2>
              <p className="text-xs text-slate-500">
                Verified scenarios showcasing Banker's Safety Gate, Resource Pressure Scoring, and Decision Agent Policy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {lastResult && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Live Execution Result — Scenario {lastResult.scenario?.id || ''}
                </span>
                {lastResult.result?.agent_decision && (
                  <AgentDecisionBadge decision={lastResult.result.agent_decision} />
                )}
              </div>
              <p className="text-xs text-slate-700 font-medium">
                {lastResult.result?.decision_reason || lastResult.message || 'Action executed successfully.'}
              </p>
              {lastResult.result && (
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs border-t border-slate-200/60">
                  <BankerStatusBadge status={lastResult.result.banker_status} />
                  <PressureBadge score={lastResult.result.pressure_score} level={lastResult.result.pressure_level} />
                  {lastResult.result.safe_sequence?.length > 0 && (
                    <span className="text-slate-600 font-mono text-[11px]">
                      Safe Seq: {lastResult.result.safe_sequence.join(' → ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Grid of Scenarios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demos.map((d) => {
              const isRunning = runningId === d.id;
              return (
                <div
                  key={d.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{d.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        d.badge_color === 'green' ? 'bg-emerald-100 text-emerald-800' :
                        d.badge_color === 'amber' ? 'bg-amber-100 text-amber-800' :
                        d.badge_color === 'red' ? 'bg-rose-100 text-rose-800' :
                        d.badge_color === 'purple' ? 'bg-purple-100 text-purple-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {d.badge}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{d.service_name} ({d.service_id})</span>
                      {d.request?.length > 0 && (
                        <>
                          <span>requests:</span>
                          <ResourceVectorChips vector={d.request} size="xs" />
                        </>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {d.learning_objective}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400">
                      Banker: <strong className="text-slate-600">{d.expected_banker}</strong> | Dec: <strong className="text-slate-600">{d.expected_decision}</strong>
                    </div>

                    <button
                      onClick={() => handleRunDemo(d.id)}
                      disabled={isRunning}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm active:scale-95"
                    >
                      {isRunning ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>{isRunning ? 'Running...' : 'Reset & Run'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>* Each scenario automatically resets state to the verified 4-resource seed before running.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
