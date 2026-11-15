/**
 * SECTOR 17 — Campaign Continue Action Button
 * Contextually dispatches stage advancement and directs player to active flight screens.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CampaignStageConfig, CampaignStageStatus } from '../../../campaign/campaignTypes';
import { ArrowRight, Compass, ShieldAlert, XCircle, CheckCircle2 } from 'lucide-react';

interface CampaignContinueButtonProps {
  currentStage: CampaignStageConfig;
  status: CampaignStageStatus;
  canAdvance: boolean;
  blockers: readonly string[];
  isCompleted: boolean;
  isFailed: boolean;
  onAdvanceStage: () => void;
}

export const CampaignContinueButton: React.FC<CampaignContinueButtonProps> = ({
  currentStage,
  status,
  canAdvance,
  blockers,
  isCompleted,
  isFailed,
  onAdvanceStage,
}) => {
  const navigate = useNavigate();

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 px-5 py-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 font-mono text-xs">
        <XCircle size={16} />
        <span>EXPEDITION TERMINATED — MISSION FAILED</span>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <button
        onClick={() => navigate('/debrief')}
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
      >
        <CheckCircle2 size={16} />
        <span>VIEW FINAL DEBRIEF ARCHIVE</span>
      </button>
    );
  }

  // If stage can advance to next stage
  if (canAdvance) {
    return (
      <button
        onClick={onAdvanceStage}
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#35C6F4] hover:bg-[#35C6F4]/90 text-[#05070B] font-mono text-xs font-bold tracking-wider uppercase transition-all cursor-pointer shadow-[0_0_20px_rgba(53,198,244,0.3)] hover:scale-[1.02] active:scale-[0.98]"
        data-testid="campaign-advance-button"
      >
        <span>Advance to Next Stage</span>
        <ArrowRight size={15} />
      </button>
    );
  }

  // If stage is blocked
  if (status === 'BLOCKED') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs select-none">
        <ShieldAlert size={15} />
        <span>STAGE BLOCKED ({blockers.length} Unresolved Condition{blockers.length === 1 ? '' : 's'})</span>
      </div>
    );
  }

  // Default: Open active stage screen
  return (
    <button
      onClick={() => navigate(currentStage.associatedRoute)}
      className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 hover:border-[#35C6F4]/50 text-slate-100 font-mono text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer"
      data-testid="campaign-continue-button"
    >
      <Compass size={15} className="text-[#35C6F4]" />
      <span>Open Stage Workspace ({currentStage.associatedRoute})</span>
      <ArrowRight size={14} className="text-slate-400" />
    </button>
  );
};
