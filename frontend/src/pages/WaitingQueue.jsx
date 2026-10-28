import React, { useState, useEffect } from 'react';
import {
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  ShieldCheck,
  ShieldAlert,
  Info,
  UserCheck
} from 'lucide-react';
import { api } from '../api';
import { ResourceVectorChips } from '../components/ResourceBadge';
import { BankerStatusBadge, PressureBadge } from '../components/SafetyBadge';

export function WaitingQueue({ onRefreshState }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await api.getWaitingQueue();
      setQueue(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleRetryItem = async (reqId) => {
    setActionMsg(null);
    setError(null);
    try {
      const res = await api.retryQueueItem(reqId);
      setActionMsg(res.message);
      await fetchQueue();
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRetryAll = async () => {
    setActionMsg(null);
    setError(null);
    try {
      const res = await api.retryAllQueue();
      setActionMsg(res.message);
      await fetchQueue();
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOperatorApprove = async (reqId, procName) => {
    setActionMsg(null);
    setError(null);
    try {
      const res = await api.operatorApproveQueue(reqId);
      setActionMsg(`Supervisor approved: ${res.message}`);
      await fetchQueue();
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (reqId) => {
    setActionMsg(null);
    setError(null);
    try {
      const res = await api.rejectQueueItem(reqId);
      setActionMsg(res.message);
      await fetchQueue();
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Persistent Waiting Queue (FIFO)
              </h1>
              <p className="text-xs text-slate-500">
                Deferred requests awaiting computing capacity release or supervisor policy review.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetryAll}
            disabled={queue.length === 0 || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition shadow-sm active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-evaluate Queue (FIFO)</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span className="font-semibold">{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span><strong>Action Blocked:</strong> {error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {/* Info Callout */}
      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-amber-900 text-xs space-y-1">
        <strong className="font-bold flex items-center gap-1.5 text-amber-800">
          <Info className="w-4 h-4 text-amber-600" />
          Queue Safety & Starvation Policy
        </strong>
        <p className="text-amber-800 leading-relaxed font-medium">
          Requests in the waiting queue are re-evaluated whenever active processes complete and return resources.
          On every retry, the backend re-validates remaining need, executes a fresh Banker’s safety check, and recalculates resource pressure.
          Operator approvals authorize review-required requests only if the fresh safety check passes.
        </p>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto stroke-1" />
            <h3 className="text-sm font-bold text-slate-800">Waiting Queue is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All submitted requests have been approved or completed. New deferred requests will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Requested Resources</th>
                  <th className="py-3 px-4">Queue Reason</th>
                  <th className="py-3 px-4">Wait Time</th>
                  <th className="py-3 px-4">Retries</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item) => {
                  const isReviewRequired = item.review_status === 'REVIEW_REQUIRED';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {item.request_id}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {item.process_name} <span className="font-mono text-slate-400 font-normal">({item.process_id})</span>
                      </td>
                      <td className="py-3 px-4">
                        <ResourceVectorChips vector={item.request} size="xs" />
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={item.queue_reason}>
                        {item.queue_reason}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                          item.is_long_wait ? 'text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded' : 'text-slate-600'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {item.wait_duration_sec}s
                          {item.is_long_wait && <span className="text-[10px] text-rose-500 font-sans ml-1">(Long wait)</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {item.retry_count}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isReviewRequired
                            ? 'bg-purple-100 text-purple-800 border border-purple-200 animate-pulse'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {item.review_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isReviewRequired && (
                          <button
                            onClick={() => handleOperatorApprove(item.request_id, item.process_name)}
                            title="Operator authorizes request after live safety check"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition active:scale-95"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Authorize</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleRetryItem(item.request_id)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => handleReject(item.request_id)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                        >
                          Reject
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
    </div>
  );
}
