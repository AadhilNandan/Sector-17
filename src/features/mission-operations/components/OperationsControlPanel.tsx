import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface OperationsControlPanelProps {
  onOpenComms: () => void;
  onOpenScience: () => void;
  onOpenCompletion: () => void;
  isReadyForDebrief: boolean;
  completionScorePercent: number;
}

export const OperationsControlPanel: React.FC<OperationsControlPanelProps> = ({
  onOpenComms,
  onOpenScience,
  onOpenCompletion,
  isReadyForDebrief,
  completionScorePercent,
}) => {
  return (
    <div
      className="flex flex-col justify-center gap-2 h-full bg-[#060A10]/95 p-3 select-none font-mono text-xs"
      aria-label="Mission Operations Control Actions"
    >
      {/* 1. COMMUNICATIONS */}
      <button
        type="button"
        data-tutorial-id="btn-open-communications"
        onClick={() => {
          sounds.playClick(1100);
          onOpenComms();
        }}
        className="w-full h-8 px-3 rounded bg-[#080D16] hover:bg-white/10 border border-white/20 hover:border-[#35C6F4]/50 text-white hover:text-[#35C6F4] font-bold text-[11px] tracking-widest uppercase transition-all cursor-pointer shadow-sm flex items-center justify-center"
      >
        COMMUNICATIONS
      </button>

      {/* 2. SCIENCE PROCESSING */}
      <button
        type="button"
        data-tutorial-id="btn-open-science"
        onClick={() => {
          sounds.playClick(1200);
          onOpenScience();
        }}
        className="w-full h-8 px-3 rounded bg-[#080D16] hover:bg-white/10 border border-white/20 hover:border-[#31C48D]/50 text-white hover:text-[#31C48D] font-bold text-[11px] tracking-widest uppercase transition-all cursor-pointer shadow-sm flex items-center justify-center"
      >
        SCIENCE PROCESSING
      </button>

      {/* 3. COMPLETE MISSION / MISSION DEBRIEF (Replaces Anomaly Investigation per Phase 7.5 directive) */}
      <button
        type="button"
        data-tutorial-id="btn-finalize-expedition"
        onClick={() => {
          sounds.playClick(1300);
          onOpenCompletion();
        }}
        className={`w-full h-8 px-3 rounded border font-bold text-[11px] tracking-widest uppercase transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
          isReadyForDebrief
            ? 'bg-[#F5A623]/20 hover:bg-[#F5A623]/30 border-[#F5A623] text-[#F5A623] shadow-[0_0_15px_rgba(245,166,35,0.3)] animate-pulse'
            : 'bg-[#080D16] hover:bg-white/10 border-white/20 text-[#A5B1C2] hover:text-white'
        }`}
        title="Evaluate mission directives and proceed directly to Mission Debrief"
      >
        <span>{isReadyForDebrief ? 'COMPLETE MISSION' : `COMPLETE MISSION (${completionScorePercent}%)`}</span>
      </button>
    </div>
  );
};
