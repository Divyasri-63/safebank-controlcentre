import React from 'react';
import {
  Building2,
  Send,
  Cpu,
  Clock,
  Layers,
  History,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export function Navbar({ activeTab, setActiveTab, systemState, onReset, onOpenDemo }) {
  const isSafe = systemState?.is_safe ?? true;
  const waitingCount = systemState?.waiting_count ?? 0;

  const navItems = [
    { id: 'overview', label: 'Bank Overview', icon: Building2 },
    { id: 'submit', label: 'Submit Transaction', icon: Send },
    { id: 'decision-agent', label: 'Decision Agent', icon: Cpu },
    { id: 'queue', label: 'Waiting Queue', icon: Clock, badge: waitingCount },
    { id: 'explorer', label: 'Algorithm Explorer', icon: Layers },
    { id: 'history', label: 'History & Audit', icon: History },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">SafeBank</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Control Centre
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Banker's Safety Gate & Intelligent Risk Analysis
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Tools & Live Status */}
          <div className="flex items-center gap-2.5">
            {/* Live Banker Safety Indicator */}
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isSafe ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isSafe ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              {isSafe ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Banker: SAFE</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Banker: UNSAFE</span>
                </>
              )}
            </div>

            {/* Guided Demo Button */}
            <button
              onClick={onOpenDemo}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span>Guided Demo</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={onReset}
              title="Cleanly reset state to verified 4-resource banking seed"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reset Seed</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 border-t border-slate-100 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap font-medium ${
                  isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-1 rounded-full text-[10px] bg-amber-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
