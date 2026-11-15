/**
 * SECTOR 17 — Campaign Stage Card
 * Renders an expedition stage with authoritative lifecycle badge and route indicator.
 */

import React from 'react';
import type { CampaignStageConfig, CampaignStageStatus } from '../../../campaign/campaignTypes';
import { CheckCircle2, AlertTriangle, XCircle, Lock, Compass } from 'lucide-react';

interface CampaignStageCardProps {
  stage: CampaignStageConfig;
  status: CampaignStageStatus;
  isSelected: boolean;
  onSelect: (stageId: CampaignStageConfig['stageId']) => void;
}

export const CampaignStageCard: React.FC<CampaignStageCardProps> = ({
  stage,
  status,
  isSelected,
  onSelect,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={11} />
            COMPLETED
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#35C6F4]/20 text-[#35C6F4] border border-[#35C6F4]/50 animate-pulse">
            <Compass size={11} />
            ACTIVE
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle size={11} />
            BLOCKED
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/30">
            <XCircle size={11} />
            FAILED
          </span>
        );
      case 'LOCKED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-white/5 border border-white/5">
            <Lock size={11} />
            LOCKED
          </span>
        );
    }
  };

  const getCardBorder = () => {
    if (isSelected) return 'border-[#35C6F4] bg-[#35C6F4]/10 shadow-[0_0_15px_rgba(53,198,244,0.15)]';
    if (status === 'ACTIVE') return 'border-[#35C6F4]/40 bg-white/[0.03]';
    if (status === 'COMPLETED') return 'border-emerald-500/30 bg-emerald-500/[0.02]';
    if (status === 'BLOCKED') return 'border-amber-500/30 bg-amber-500/[0.02]';
    if (status === 'FAILED') return 'border-red-500/40 bg-red-500/[0.03]';
    return 'border-white/5 bg-white/[0.01] opacity-70';
  };

  return (
    <div
      onClick={() => onSelect(stage.stageId)}
      className={`relative p-3 rounded-lg border transition-all cursor-pointer select-none ${getCardBorder()}`}
      data-testid={`campaign-stage-card-${stage.stageId}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-slate-400">
            {String(stage.order + 1).padStart(2, '0')}
          </span>
          <h4 className="text-xs font-semibold text-slate-200 tracking-wide truncate max-w-[150px] sm:max-w-[200px]">
            {stage.title}
          </h4>
        </div>
        {getStatusBadge()}
      </div>

      <p className="text-[11px] text-slate-400 line-clamp-1 mb-2">
        {stage.subtitle}
      </p>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-white/5">
        <span className="text-slate-400">Route: <span className="text-slate-300 font-semibold">{stage.associatedRoute}</span></span>
        <span className="text-[9px] text-slate-400">
          {stage.completionRequirements.length} Gate{stage.completionRequirements.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
};
