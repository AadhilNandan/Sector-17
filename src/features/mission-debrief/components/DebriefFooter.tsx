import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface DebriefFooterProps {
  onArchive: () => void;
  onReturnToMenu: () => void;
  isArchived?: boolean;
}

export const DebriefFooter: React.FC<DebriefFooterProps> = ({
  onArchive,
  onReturnToMenu,
  isArchived = false,
}) => {
  return (
    <footer className="w-full px-6 py-3 flex items-center justify-between select-none font-mono text-xs border-t border-white/10 bg-[#060A10]/95 z-30">
      {/* 1. Left: Non-endorsement Disclaimer */}
      <div className="text-[11px] text-[#A5B1C2]/60 tracking-tight">
        SECTOR 17 is an independent project. NASA does not endorse SECTOR 17.
      </div>

      {/* 2. Right: Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-tutorial-id="btn-archive-expedition"
          disabled={isArchived}
          onClick={() => {
            if (!isArchived) {
              sounds.playClick(1000);
              onArchive();
            }
          }}
          className={`px-4 py-2 rounded font-bold uppercase tracking-wider text-xs transition-all cursor-pointer ${
            isArchived
              ? 'bg-[#35C6F4]/20 border border-[#35C6F4]/40 text-[#35C6F4]/60 cursor-default'
              : 'bg-[#35C6F4] hover:bg-[#48D1FF] active:scale-95 text-[#060A10] shadow-[0_0_15px_rgba(53,198,244,0.35)]'
          }`}
          title={isArchived ? 'Mission telemetry permanently committed' : 'Archive expedition telemetry to mission records'}
        >
          {isArchived ? '[ EXPEDITION ARCHIVED ]' : '[ ARCHIVE THIS EXPEDITION ]'}
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick(800);
            onReturnToMenu();
          }}
          className="px-4 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-[#A5B1C2] hover:text-white transition-all cursor-pointer font-bold uppercase tracking-wider text-xs active:scale-95"
          title="Return to Main Menu"
        >
          [ RETURN TO MAIN MENU ]
        </button>
      </div>
    </footer>
  );
};
