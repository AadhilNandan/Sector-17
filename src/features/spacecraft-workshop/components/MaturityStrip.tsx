import React from 'react';

export interface MaturityStripProps {
  currentStage?: 'concept' | 'feasibility' | 'trade-study' | 'point-design' | 'readiness';
}

export const MaturityStrip: React.FC<MaturityStripProps> = ({
  currentStage = 'point-design',
}) => {
  const stages = [
    { id: 'concept', label: 'Concept' },
    { id: 'feasibility', label: 'Feasibility' },
    { id: 'trade-study', label: 'Trade Study' },
    { id: 'point-design', label: 'Point Design' },
    { id: 'readiness', label: 'Readiness' },
  ];

  return (
    <div className="w-full bg-[#151D26] border-b border-[#2B3642] px-6 py-1.5 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 select-none">
      {/* Disclaimer subtext */}
      <div className="font-mono text-[9px] md:text-[10px] text-[#A9B0B5]/75 uppercase tracking-wider">
        <strong className="text-[#E6E2D6]">SECTOR 17 READINESS</strong> (Inspired by NASA concept maturity levels, NOT an official NASA CML score)
      </div>

      {/* Progression Flow */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 font-mono text-xs tracking-wider">
        {stages.map((stage, idx) => {
          const isCurrent = stage.id === currentStage;
          return (
            <React.Fragment key={stage.id}>
              {isCurrent ? (
                <span className="px-2 py-0.5 rounded-xs font-bold text-[#7FB7D4] bg-[#7FB7D4]/15 border border-[#7FB7D4] shadow-[0_0_8px_rgba(127,183,212,0.2)]">
                  [ {stage.label} ]
                </span>
              ) : (
                <span className="text-[#6B757D] font-medium">{stage.label}</span>
              )}
              {idx < stages.length - 1 && (
                <span className="text-[#4A5568] text-[11px]">➔</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
