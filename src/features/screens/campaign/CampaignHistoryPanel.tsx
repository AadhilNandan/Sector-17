/**
 * SECTOR 17 — Campaign History Panel
 * Immutable chronologically-ordered log of completed stages, MET timestamps, and failure audits.
 */

import React from 'react';
import type { StageHistoryRecord } from '../../../campaign/campaignTypes';
import { CAMPAIGN_STAGE_CONFIGS } from '../../../campaign/campaignStages';
import { History, Clock } from 'lucide-react';

interface CampaignHistoryPanelProps {
  history: readonly StageHistoryRecord[];
}

export const CampaignHistoryPanel: React.FC<CampaignHistoryPanelProps> = ({ history }) => {
  return (
    <div className="flex flex-col h-full bg-[#0B0F17]/80 rounded-xl border border-white/10 p-4 overflow-hidden">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
        <History size={16} className="text-[#F5A623]" />
        <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
          Expedition Flight Log
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {history.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-4 text-center">
            No stage history recorded.
          </div>
        ) : (
          history.map((record, idx) => {
            const config = CAMPAIGN_STAGE_CONFIGS[record.stageId];
            return (
              <div
                key={`${record.stageId}-${idx}`}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5"
                data-testid={`campaign-history-record-${record.stageId}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    {config?.title ?? record.stageId}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      record.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : record.status === 'FAILED'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {record.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={10} className="text-[#35C6F4]" />
                    MET: {record.enteredAtMET}s
                  </span>
                  {record.completedAtMET !== undefined && (
                    <span>· Done: {record.completedAtMET}s</span>
                  )}
                </div>

                {record.notes.length > 0 && (
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-white/5">
                    {record.notes[record.notes.length - 1]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
