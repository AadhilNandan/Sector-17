import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface DebriefHeaderProps {
  onBack: () => void;
  onSettings?: () => void;
  missionName?: string;
  systemDate?: string;
}

export const DebriefHeader: React.FC<DebriefHeaderProps> = ({
  onBack,
  onSettings,
  missionName = 'EXPEDITION-V (EUROPA SURVEY)',
  systemDate = '04.12.2036',
}) => {
  return (
    <header className="w-full px-6 py-2.5 flex items-center justify-between select-none font-mono text-xs border-b border-white/10 bg-[#060A10]/95 z-30">
      {/* 1. Left: MISSION DEBRIEF & Subtitle */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-white font-extrabold tracking-widest text-xl sm:text-2xl uppercase font-sans">
          MISSION DEBRIEF
        </h1>
        <div className="flex flex-col text-[10px] text-[#A5B1C2] leading-tight font-mono">
          <span className="text-[#35C6F4] font-semibold tracking-wider uppercase">
            BARLOW CONDENSED
          </span>
          <span className="text-white/80 tracking-wide uppercase">
            {missionName}
          </span>
        </div>
      </div>

      {/* 2. Right: System Date & Navigation */}
      <div className="flex items-center gap-4 text-[#A5B1C2] text-xs">
        <div className="flex flex-col text-right text-[10px] hidden sm:flex">
          <span className="text-[#A5B1C2]/60 uppercase">SYSTEM DATE</span>
          <span className="text-white font-semibold tracking-wider">
            {systemDate} // DEBRIEF OVERVIEW
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            sounds.playClick(900);
            onBack();
          }}
          className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[#A5B1C2] hover:text-white transition-all cursor-pointer font-bold tracking-wider text-[11px] uppercase"
          title="Return to Flight Operations Console"
        >
          [ BACK ]
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick(1000);
            onSettings?.();
          }}
          className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[#A5B1C2] hover:text-white transition-all cursor-pointer font-bold tracking-wider text-[11px] uppercase"
          title="System Settings"
        >
          [ SETTINGS ]
        </button>
      </div>
    </header>
  );
};
