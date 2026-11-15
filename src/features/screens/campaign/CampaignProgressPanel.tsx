/**
 * SECTOR 17 — Campaign Progress Panel
 * Overview timeline of all 18 expedition stages with status mapping.
 */

import React from 'react';
import type { CampaignStageId, CampaignStageStatus } from '../../../campaign/campaignTypes';
import { CAMPAIGN_STAGES_SEQUENCE, CAMPAIGN_STAGE_CONFIGS } from '../../../campaign/campaignStages';
import { CampaignStageCard } from './CampaignStageCard';
import { Layers } from 'lucide-react';

interface CampaignProgressPanelProps {
  currentStageId: CampaignStageId;
  currentStageStatus: CampaignStageStatus;
  completedStages: readonly CampaignStageId[];
  selectedStageId: CampaignStageId;
  onSelectStage: (stageId: CampaignStageId) => void;
}

export const CampaignProgressPanel: React.FC<CampaignProgressPanelProps> = ({
  currentStageId,
  currentStageStatus,
  completedStages,
  selectedStageId,
  onSelectStage,
}) => {
  const getStageStatus = (stageId: CampaignStageId): CampaignStageStatus => {
    if (stageId === currentStageId) {
      return currentStageStatus;
    }
    if (completedStages.includes(stageId)) {
      return 'COMPLETED';
    }
    return 'LOCKED';
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F17]/80 rounded-xl border border-white/10 p-4 overflow-hidden">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#35C6F4]" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            Expedition Flight Sequence
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          {completedStages.length} / {CAMPAIGN_STAGES_SEQUENCE.length} Completed
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {CAMPAIGN_STAGES_SEQUENCE.map((stageId) => {
          const config = CAMPAIGN_STAGE_CONFIGS[stageId];
          const status = getStageStatus(stageId);
          const isSelected = stageId === selectedStageId;

          return (
            <CampaignStageCard
              key={stageId}
              stage={config}
              status={status}
              isSelected={isSelected}
              onSelect={onSelectStage}
            />
          );
        })}
      </div>
    </div>
  );
};
