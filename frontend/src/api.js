const API_BASE = '/api';

export async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errMessage = `Error ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.detail) {
        errMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }

  return res.json();
}

export const api = {
  // System State & Process Management
  getState: () => fetchJson('/state'),
  getProcesses: () => fetchJson('/processes'),
  createProcess: (data) => fetchJson('/processes', { method: 'POST', body: JSON.stringify(data) }),
  completeProcess: (pid) => fetchJson(`/processes/${pid}/complete`, { method: 'POST' }),

  // Transaction Requests
  submitRequest: (data) => fetchJson('/requests', { method: 'POST', body: JSON.stringify(data) }),

  // Waiting Queue
  getWaitingQueue: () => fetchJson('/queue'),
  retryQueueItem: (requestId) => fetchJson(`/queue/${requestId}/retry`, { method: 'POST' }),
  retryAllQueue: () => fetchJson('/queue/retry-all', { method: 'POST' }),
  operatorApproveQueue: (requestId) => fetchJson(`/queue/${requestId}/review-approve`, { method: 'POST' }),
  rejectQueueItem: (requestId) => fetchJson(`/queue/${requestId}/reject`, { method: 'POST' }),

  // Audit History
  getHistory: (params = {}) => {
    const q = new URLSearchParams();
    if (params.process_id) q.set('process_id', params.process_id);
    if (params.decision_filter) q.set('decision_filter', params.decision_filter);
    if (params.banker_filter) q.set('banker_filter', params.banker_filter);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson(`/history${qs}`);
  },
  getHistoryDetail: (id) => fetchJson(`/history/${id}`),

  // Decision Agent & Policy
  getAgentPolicy: () => fetchJson('/agent/policy'),
  updateAgentPolicy: (low, mod) => fetchJson(`/agent/policy?low_threshold=${low}&moderate_threshold=${mod}`, { method: 'POST' }),

  // Classroom Demos
  getDemoScenarios: () => fetchJson('/demo/scenarios'),
  resetDemoScenario: () => fetchJson('/demo/reset', { method: 'POST' }),
  runDemoScenario: (id) => fetchJson(`/demo/run/${id}`, { method: 'POST' }),

  // Advisory ML Predictor
  getMLMetrics: () => fetchJson('/ml/metrics'),
  triggerMLTrain: () => fetchJson('/ml/train', { method: 'POST' }),
};
