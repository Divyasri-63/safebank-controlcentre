import React from 'react';
import { Cpu, HardDrive, Database, Lock } from 'lucide-react';

export const RESOURCE_META = [
  { key: 'cpu', label: 'CPU Slots', unit: 'slots', icon: Cpu, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { key: 'mem', label: 'Memory', unit: 'blocks', icon: HardDrive, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'db', label: 'DB Connections', unit: 'conns', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'lock', label: 'Lock Slots', unit: 'permits', icon: Lock, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
];

export function ResourceVectorChips({ vector, blockSizeMb = 64, showMb = true, size = 'sm' }) {
  if (!vector || vector.length < 4) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* CPU */}
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${size === 'xs' ? 'text-xs' : 'text-xs'} bg-indigo-50 text-indigo-700 border border-indigo-200`}>
        <Cpu className="w-3 h-3 text-indigo-500" />
        <span>{vector[0]} <span className="text-[10px] text-indigo-500 font-normal">CPU</span></span>
      </span>

      {/* Memory */}
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${size === 'xs' ? 'text-xs' : 'text-xs'} bg-emerald-50 text-emerald-700 border border-emerald-200`}>
        <HardDrive className="w-3 h-3 text-emerald-500" />
        <span>
          {vector[1]} <span className="text-[10px] text-emerald-500 font-normal">blk</span>
          {showMb && <span className="text-[10px] text-emerald-600 font-semibold ml-0.5">({vector[1] * blockSizeMb}MB)</span>}
        </span>
      </span>

      {/* DB Connections */}
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${size === 'xs' ? 'text-xs' : 'text-xs'} bg-blue-50 text-blue-700 border border-blue-200`}>
        <Database className="w-3 h-3 text-blue-500" />
        <span>{vector[2]} <span className="text-[10px] text-blue-500 font-normal">DB</span></span>
      </span>

      {/* Locks */}
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${size === 'xs' ? 'text-xs' : 'text-xs'} bg-purple-50 text-purple-700 border border-purple-200`}>
        <Lock className="w-3 h-3 text-purple-500" />
        <span>{vector[3]} <span className="text-[10px] text-purple-500 font-normal">Lock</span></span>
      </span>
    </div>
  );
}
