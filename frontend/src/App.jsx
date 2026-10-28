import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ClassroomDemoModal } from './components/ClassroomDemoModal';
import { BankOverview } from './pages/BankOverview';
import { SubmitTransaction } from './pages/SubmitTransaction';
import { DecisionAgentPage } from './pages/DecisionAgentPage';
import { WaitingQueue } from './pages/WaitingQueue';
import { AlgorithmExplorer } from './pages/AlgorithmExplorer';
import { RequestHistory } from './pages/RequestHistory';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemState, setSystemState] = useState(null);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [initialProcessId, setInitialProcessId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchState = useCallback(async () => {
    try {
      const data = await api.getState();
      setSystemState(data);
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleResetSystem = async () => {
    try {
      await api.resetDemoScenario();
      await fetchState();
      showToast('System state cleanly reset to verified 4-resource banking seed.', 'success');
    } catch (err) {
      showToast(`Reset failed: ${err.message}`, 'error');
    }
  };

  const handleNavigateSubmit = (pid = null) => {
    if (pid) setInitialProcessId(pid);
    setActiveTab('submit');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-bounce">
          <div className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
            toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' :
            'bg-slate-800 text-white border-slate-700'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemState={systemState}
        onReset={handleResetSystem}
        onOpenDemo={() => setDemoModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <BankOverview
            systemState={systemState}
            onRefresh={fetchState}
            onNavigateSubmit={handleNavigateSubmit}
            onNavigateHistory={() => setActiveTab('history')}
            onOpenDemo={() => setDemoModalOpen(true)}
          />
        )}

        {activeTab === 'submit' && (
          <SubmitTransaction
            systemState={systemState}
            initialProcessId={initialProcessId}
            onRefresh={fetchState}
          />
        )}

        {activeTab === 'decision-agent' && (
          <DecisionAgentPage />
        )}

        {activeTab === 'queue' && (
          <WaitingQueue onRefreshState={fetchState} />
        )}

        {activeTab === 'explorer' && (
          <AlgorithmExplorer systemState={systemState} />
        )}

        {activeTab === 'history' && (
          <RequestHistory />
        )}
      </main>

      {/* Classroom Demonstration Modal */}
      <ClassroomDemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onRefreshState={fetchState}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div>
            <p className="font-bold text-slate-700">
              SafeBank — Bank Operations Control Centre
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Resource Allocation and Deadlock Prevention using Banker’s Algorithm with Intelligent Risk Analysis
            </p>
          </div>
          <div className="text-[11px] text-slate-400 max-w-md">
            Educational OS simulation. Server resource approvals reserve computing capacity; they do not authorize monetary transfers.
          </div>
        </div>
      </footer>
    </div>
  );
}
