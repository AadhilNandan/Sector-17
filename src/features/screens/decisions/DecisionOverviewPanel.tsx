/**
 * SECTOR 17 — Decision Overview Panel
 * Displays high-level decision posture, pending authorizations,
 * active faults, and current objective milestones.
 */

import React from 'react';
import { ShieldAlert, CheckCircle2, Clock, Layers, FileText } from 'lucide-react';
import { useSimulationSnapshot } from '../../../runtime';

interface DecisionOverviewPanelProps {
  onFilterChange?: (filter: 'all' | 'pending' | 'approved' | 'history') => void;
  activeFilter?: 'all' | 'pending' | 'approved' | 'history';
}

export const DecisionOverviewPanel: React.FC<DecisionOverviewPanelProps> = ({
  onFilterChange,
  activeFilter = 'all',
}) => {
  const snap = useSimulationSnapshot();

  const proposedCount = snap.decisionHistory.filter((d) => d.status === 'PROPOSED').length;
  const approvedCount = snap.decisionHistory.filter((d) => d.status === 'APPROVED').length;
  const executedCount = snap.decisionHistory.filter((d) => d.status === 'EXECUTED').length;
  const availableCount = snap.availableDecisions.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        {/* Candidate Options */}
        <button
          type="button"
          onClick={() => onFilterChange?.('all')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-[#35C6F4]/15 border-[#35C6F4]/40 text-[#35C6F4]'
              : 'bg-[#080D16]/80 hover:bg-white/5 border-white/10 text-[#A5B1C2]'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
            <span>Candidates</span>
            <Layers size={13} />
          </div>
          <div className="text-xl font-bold text-[#F1F5FA]">{availableCount}</div>
          <div className="text-[10px] text-[#A5B1C2] mt-0.5">Active options generated</div>
        </button>

        {/* Proposed / Pending Decisions */}
        <button
          type="button"
          onClick={() => onFilterChange?.('pending')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'pending'
              ? 'bg-[#F5A623]/20 border-[#F5A623]/50 text-[#F5A623]'
              : 'bg-[#080D16]/80 hover:bg-white/5 border-white/10 text-[#A5B1C2]'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
            <span>Pending</span>
            <Clock size={13} className={proposedCount > 0 ? 'text-[#F5A623] animate-pulse' : ''} />
          </div>
          <div className="text-xl font-bold text-[#F5A623]">{proposedCount}</div>
          <div className="text-[10px] text-[#A5B1C2] mt-0.5">Awaiting authorization</div>
        </button>

        {/* Approved / Ready to Execute */}
        <button
          type="button"
          onClick={() => onFilterChange?.('approved')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'approved'
              ? 'bg-[#31C48D]/20 border-[#31C48D]/50 text-[#31C48D]'
              : 'bg-[#080D16]/80 hover:bg-white/5 border-white/10 text-[#A5B1C2]'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
            <span>Authorized</span>
            <CheckCircle2 size={13} className={approvedCount > 0 ? 'text-[#31C48D]' : ''} />
          </div>
          <div className="text-xl font-bold text-[#31C48D]">{approvedCount}</div>
          <div className="text-[10px] text-[#A5B1C2] mt-0.5">Ready for execution</div>
        </button>

        {/* Executed History */}
        <button
          type="button"
          onClick={() => onFilterChange?.('history')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'history'
              ? 'bg-white/15 border-white/30 text-white'
              : 'bg-[#080D16]/80 hover:bg-white/5 border-white/10 text-[#A5B1C2]'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
            <span>Executed</span>
            <FileText size={13} />
          </div>
          <div className="text-xl font-bold text-[#F1F5FA]">{executedCount}</div>
          <div className="text-[10px] text-[#A5B1C2] mt-0.5">Archived audit records</div>
        </button>
      </div>

      {/* Critical Alerts Banner (If active faults exist) */}
      {snap.faults.criticalCount > 0 && (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#EF6464]/15 border border-[#EF6464]/30 text-[#EF6464] font-mono text-xs animate-pulse">
          <ShieldAlert size={16} className="shrink-0" />
          <div className="flex-1">
            <span className="font-bold">CRITICAL AVIONICS ALERT:</span> {snap.faults.criticalCount} active critical fault(s). Decision execution gating enforced.
          </div>
        </div>
      )}
    </div>
  );
};
