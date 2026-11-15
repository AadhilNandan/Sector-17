/**
 * SECTOR 17 — Decision History & Audit Trail Panel
 * Immutable chronological audit log of all decision proposals, authorizations, and executions.
 */

import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Search,
  ArrowRight,
} from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { formatMET } from '../../../simulation/operations/missionClock';
import type {
  DecisionRecord,
  DecisionAuthorizationStatus,
} from '../../../simulation/missionDecision/types';

interface DecisionHistoryPanelProps {
  records: readonly DecisionRecord[];
  onSelectRecord?: (record: DecisionRecord) => void;
  selectedDecisionId?: string;
}

export const DecisionHistoryPanel: React.FC<DecisionHistoryPanelProps> = ({
  records,
  onSelectRecord,
  selectedDecisionId,
}) => {
  const [filterStatus, setFilterStatus] = useState<DecisionAuthorizationStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Reverse chronological (newest first)
  const sorted = [...records].reverse();

  const filtered = sorted.filter((rec) => {
    if (filterStatus !== 'ALL' && rec.status !== filterStatus) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        rec.decisionId.toLowerCase().includes(q) ||
        rec.option.title.toLowerCase().includes(q) ||
        rec.option.category.toLowerCase().includes(q) ||
        (rec.authorizationReason && rec.authorizationReason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (stat: DecisionAuthorizationStatus) => {
    switch (stat) {
      case 'APPROVED':
        return {
          pill: 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30',
          icon: <CheckCircle2 size={11} />,
        };
      case 'PROPOSED':
        return {
          pill: 'bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/30',
          icon: <Clock size={11} />,
        };
      case 'EXECUTED':
        return {
          pill: 'bg-white/10 text-white border-white/20',
          icon: <CheckCircle2 size={11} />,
        };
      case 'REJECTED':
      case 'FAILED':
        return {
          pill: 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30',
          icon: <XCircle size={11} />,
        };
      case 'EXPIRED':
      default:
        return {
          pill: 'bg-white/5 text-[#A5B1C2] border-white/10',
          icon: <AlertOctagon size={11} />,
        };
    }
  };

  return (
    <GamePanel
      title="Immutable Decision Audit History"
      subtitle="Chronological Mission Authority Log & Consequence Registry"
      className="border-white/10"
      headerAction={
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="text-[#A5B1C2]">Status:</span>
          {(['ALL', 'PROPOSED', 'APPROVED', 'EXECUTED', 'REJECTED'] as const).map((stat) => (
            <button
              key={stat}
              type="button"
              onClick={() => setFilterStatus(stat)}
              className={`px-1.5 py-0.5 rounded uppercase font-semibold transition-all cursor-pointer ${
                filterStatus === stat
                  ? 'bg-white/20 text-white'
                  : 'text-[#A5B1C2] hover:text-white'
              }`}
            >
              {stat}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Search Bar */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-[#A5B1C2]" />
          <input
            type="text"
            placeholder="Search history by title, ID, or directive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-[#F1F5FA] placeholder-[#6D7A8D] focus:outline-none focus:border-[#35C6F4]/50"
          />
        </div>

        {/* History Records List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filtered.length > 0 ? (
            filtered.map((rec) => {
              const badge = getStatusBadge(rec.status);
              const isSelected = selectedDecisionId === rec.decisionId;

              return (
                <div
                  key={rec.decisionId}
                  onClick={() => onSelectRecord?.(rec)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[#0E1726] border-[#35C6F4] shadow-md'
                      : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] text-[#A5B1C2] font-semibold">{rec.decisionId}</span>
                        <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-[9px] text-[#35C6F4] uppercase">
                          {rec.option.category}
                        </span>
                      </div>
                      <h5 className="font-sans font-bold text-xs text-[#F1F5FA]">
                        {rec.option.title}
                      </h5>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${badge.pill}`}>
                        {badge.icon}
                        <span>{rec.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Authorization Reason or Directive */}
                  {rec.authorizationReason && (
                    <div className="text-[11px] text-[#CBD5E1] font-sans">
                      <span className="text-[#A5B1C2]">Directive: </span>
                      <em>"{rec.authorizationReason}"</em>
                    </div>
                  )}

                  {/* Timestamps & Consequence Metrics */}
                  <div className="flex items-center justify-between text-[10px] text-[#A5B1C2] pt-1.5 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <span>Proposed: {formatMET(rec.proposedAtMET)}</span>
                      {rec.authorizedAtMET !== undefined && (
                        <span>Authorized: {formatMET(rec.authorizedAtMET)}</span>
                      )}
                      {rec.executedAtMET !== undefined && (
                        <span className="text-[#31C48D]">Executed: {formatMET(rec.executedAtMET)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[#35C6F4]">
                      <span>{(rec.consequences?.length ?? rec.executionResult?.consequences?.length ?? 0)} consequence(s)</span>
                      <ArrowRight size={10} />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs font-mono text-[#6D7A8D] bg-white/[0.02] rounded-xl border border-white/5">
              <FileText size={20} className="mx-auto mb-2 opacity-50" />
              <div>NO DECISION AUDIT RECORDS FOUND</div>
              <div className="text-[10px] mt-1">
                Generate response options and authorize mission decisions to populate the audit registry.
              </div>
            </div>
          )}
        </div>
      </div>
    </GamePanel>
  );
};
