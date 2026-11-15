import React from 'react';
import { BookOpen } from 'lucide-react';

export type TrajectoryScaleMode = 'schematic' | 'true';

export interface TrajectoryHeaderProps {
  onReturn: () => void;
  formattedMET: string;
  scaleMode: TrajectoryScaleMode;
  onScaleModeChange: (mode: TrajectoryScaleMode) => void;
  onOpenReferences?: () => void;
}

export const TrajectoryHeader: React.FC<TrajectoryHeaderProps> = ({
  onReturn,
  formattedMET,
  scaleMode,
  onScaleModeChange,
  onOpenReferences,
}) => {
  return (
    <header className="w-full h-14 bg-[#0A0D12] border-b border-[#1F2733] px-4 md:px-6 flex items-center justify-between text-[#E6E2D6] select-none z-30 shrink-0">
      {/* Left: Return & Title */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onReturn}
          className="font-mono text-xs text-[#A9B0B5] hover:text-[#FFFFFF] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>[</span>
          <span className="text-[#7FB7D4]">&lt; RETURN TO WORKSHOP</span>
          <span>]</span>
        </button>

        <div className="h-4 w-px bg-[#2B3642] hidden sm:block" />

        <div className="flex items-center gap-2">
          <h1 className="font-display text-sm md:text-base font-bold tracking-[0.16em] uppercase text-[#E6E2D6]">
            TRAJECTORY PLANNER // EXPEDITION-V
          </h1>
        </div>
      </div>

      {/* Center: Mission Elapsed Time */}
      <div className="hidden lg:flex items-center gap-2 font-mono text-base tracking-[0.2em] text-[#E6E2D6]">
        <span className="text-[#6B757D] text-xs">MET:</span>
        <span className="font-bold text-[#E6E2D6]">{formattedMET}</span>
      </div>

      {/* Right: Scale Mode & Scientific References */}
      <div className="flex items-center gap-4">
        {onOpenReferences && (
          <button
            type="button"
            onClick={onOpenReferences}
            title="Inspect NASA/JPL Scientific Ephemeris References"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#11161D] border border-[#2B3642] hover:border-[#7FB7D4] text-[#A9B0B5] hover:text-[#E6E2D6] font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            <BookOpen size={12} className="text-[#7FB7D4]" />
            <span>NASA References</span>
          </button>
        )}

        {/* Scale Toggle: [ SCHEMATIC ] / TRUE */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#6B757D] text-[11px] uppercase tracking-wider">SCALE:</span>
            <div className="flex items-center p-0.5 rounded-xs bg-[#11161D] border border-[#2B3642]" data-tutorial-id="btn-scale-toggle">
              <button
                type="button"
                onClick={() => onScaleModeChange('schematic')}
                className={`px-2 py-0.5 rounded-xs font-mono text-[11px] uppercase transition-colors cursor-pointer ${
                  scaleMode === 'schematic'
                    ? 'bg-[#1C2530] text-[#7FB7D4] font-bold border border-[#7FB7D4]/60'
                    : 'text-[#6B757D] hover:text-[#A9B0B5] border border-transparent'
                }`}
              >
                [ SCHEMATIC ]
              </button>
              <button
                type="button"
                onClick={() => onScaleModeChange('true')}
                className={`px-2 py-0.5 rounded-xs font-mono text-[11px] uppercase transition-colors cursor-pointer ${
                  scaleMode === 'true'
                    ? 'bg-[#1C2530] text-[#7FB7D4] font-bold border border-[#7FB7D4]/60'
                    : 'text-[#6B757D] hover:text-[#A9B0B5] border border-transparent'
                }`}
              >
                TRUE
              </button>
            </div>
          </div>
          <div className="text-[9px] font-mono text-[#6B757D] text-right mt-0.5 leading-tight hidden sm:block">
            {scaleMode === 'schematic'
              ? 'Schematic scale enabled for visualization. Orbit distances and sizes are not 1:1.'
              : 'Physical proportional scale active (1:1 IAU geometric standard).'}
          </div>
        </div>
      </div>
    </header>
  );
};
