import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface WorkshopFooterProps {
  onShowComparison: () => void;
  onValidateAndLock: () => void;
  isValidToProceed: boolean;
  statusText: string;
}

export const WorkshopFooter: React.FC<WorkshopFooterProps> = ({
  onShowComparison,
  onValidateAndLock,
  isValidToProceed,
  statusText,
}) => {
  return (
    <footer className="w-full flex flex-col gap-1.5 px-6 py-2.5 bg-[#0D1116] border-t border-[#2B3642] select-none shrink-0 z-20">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Previous vs. Current Comparison Button */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onShowComparison();
          }}
          className="font-mono text-xs md:text-sm tracking-wider text-[#A9B0B5] hover:text-[#FFFFFF] cursor-pointer py-1.5 px-3 rounded-xs border border-[#2B3642] hover:border-[#7FB7D4] transition-colors outline-none"
        >
          [ SHOW PREVIOUS vs. CURRENT ]
        </button>

        {/* Centre: Configuration Status & Active Warnings */}
        <div className="font-mono text-xs md:text-sm tracking-wider text-center">
          <span className="text-[#E6E2D6] font-semibold">{statusText}</span>
        </div>

        {/* Right: Validate and Lock Configuration Button */}
        <button
          type="button"
          data-tutorial-id="btn-proceed-trajectory"
          disabled={!isValidToProceed}
          onClick={() => {
            if (isValidToProceed) {
              sounds.playClick(1400);
              onValidateAndLock();
            }
          }}
          className={`relative inline-flex items-center px-5 py-2 font-display text-sm md:text-base font-bold tracking-[0.1em] uppercase transition-all rounded-xs outline-none ${
            isValidToProceed
              ? 'text-[#7FB7D4] bg-[#7FB7D4]/15 border border-[#7FB7D4] hover:bg-[#7FB7D4]/25 hover:text-[#FFFFFF] cursor-pointer shadow-[0_0_12px_rgba(127,183,212,0.25)]'
              : 'text-[#6B757D] bg-white/5 border border-[#2B3642] cursor-not-allowed opacity-60'
          }`}
        >
          {isValidToProceed && (
            <>
              <span className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-[#7FB7D4]" />
              <span className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-[#7FB7D4]" />
              <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-[#7FB7D4]" />
              <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-[#7FB7D4]" />
            </>
          )}
          [ VALIDATE AND LOCK CONFIGURATION ]
        </button>
      </div>

      {/* Far bottom-right disclaimer */}
      <div className="text-right text-[10px] text-[#6B757D] font-sans">
        SECTOR 17 is an independent project. NASA does not endorse SECTOR 17.
      </div>
    </footer>
  );
};
