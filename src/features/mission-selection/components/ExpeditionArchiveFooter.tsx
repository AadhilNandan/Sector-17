import React from 'react';
import type { ExpeditionDossier } from '../dossierData';
import { sounds } from '../../../utils/soundEffects';

export interface ExpeditionArchiveFooterProps {
  selectedDossier: ExpeditionDossier;
  statusLabel: string;
  onBeginExpedition: () => void;
}

export const ExpeditionArchiveFooter: React.FC<ExpeditionArchiveFooterProps> = ({
  selectedDossier,
  statusLabel,
  onBeginExpedition,
}) => {
  return (
    <footer className="relative z-20 flex flex-col gap-2 px-6 md:px-10 py-3 border-t border-[#2B3642]/60 bg-[#07090C]/90 select-none">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Authoritative Selected Mission String */}
        <div className="font-mono text-xs sm:text-sm tracking-wider text-[#A9B0B5] truncate max-w-2xl">
          <span>SELECTED: </span>
          <span className="text-[#E6E2D6] font-semibold">{selectedDossier.title}</span>
          <span className="text-[#6B757D]"> // DESTINATION: </span>
          <span className="text-[#E6E2D6] font-semibold">{selectedDossier.destination}</span>
          <span className="text-[#6B757D]"> // VESSEL: </span>
          <span className="text-[#E6E2D6] font-semibold">{selectedDossier.vesselName}</span>
          <span className="text-[#6B757D]"> // STATUS: </span>
          <span
            className={
              selectedDossier.isPlayable ? 'text-[#7FB7D4] font-bold' : 'text-[#A9B0B5]'
            }
          >
            {statusLabel}
          </span>
        </div>

        {/* Right: Primary Action Button */}
        <div>
          {selectedDossier.isPlayable ? (
            <button
              type="button"
              data-tutorial-id="btn-configure-spacecraft"
              onClick={() => {
                sounds.playClick();
                onBeginExpedition();
              }}
              className="relative inline-flex items-center px-6 py-2.5 font-display text-lg sm:text-xl font-bold tracking-[0.1em] text-[#07090C] bg-[#7FB7D4] hover:bg-[#96C7DF] active:bg-[#68A2BE] transition-colors rounded-xs shadow-[0_4px_16px_rgba(127,183,212,0.3)] cursor-pointer outline-none uppercase"
            >
              {/* Corner brackets */}
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#E6E2D6]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#E6E2D6]" />
              <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#E6E2D6]" />
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#E6E2D6]" />
              BEGIN EXPEDITION
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-5 py-2 font-display text-base sm:text-lg tracking-[0.08em] text-[#6B757D] bg-white/5 border border-[#2B3642] rounded-xs cursor-not-allowed opacity-60 uppercase"
            >
              [ HISTORICAL ARCHIVE — READ ONLY ]
            </button>
          )}
        </div>
      </div>

      {/* Legal Subtitle */}
      <div className="text-right text-[10px] text-[#6B757D] font-sans">
        SECTOR 17 is an independent project. NASA does not endorse SECTOR 17.
      </div>
    </footer>
  );
};
