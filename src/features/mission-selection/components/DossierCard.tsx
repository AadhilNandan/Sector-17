import React from 'react';
import type { ExpeditionDossier } from '../dossierData';
import { ExpeditionSeal } from './ExpeditionSeal';
import { Rocket, Orbit, Mountain, User, Check, X } from 'lucide-react';

export interface DossierCardProps {
  dossier: ExpeditionDossier;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const DossierCard: React.FC<DossierCardProps> = ({
  dossier,
  isSelected,
  onSelect,
}) => {
  // Paper styles based on variant
  const getPaperClasses = () => {
    switch (dossier.paperVariant) {
      case 'blue-grey':
        return 'bg-[#A8B6C1] text-[#141D26] border-l-4 border-l-[#7E8F9D] border-t border-r border-b border-[#8C9CA9] shadow-[0_12px_36px_rgba(0,0,0,0.55)]';
      case 'aged-parchment':
        return 'bg-[#E3D7BD] text-[#241A12] border border-[#C5B798] shadow-[0_12px_36px_rgba(0,0,0,0.55)] rotate-[0.3deg]';
      case 'clean-ivory':
      default:
        return 'bg-[#F4F1E8] text-[#111820] border border-[#D5CEC0] shadow-[0_14px_40px_rgba(0,0,0,0.6)]';
    }
  };

  // Stamp styling
  const getStampStyles = () => {
    const { variant, rotationDeg } = dossier.outcomeStamp;
    const baseStyle = {
      transform: `rotate(${rotationDeg}deg)`,
    };

    switch (variant) {
      case 'completed':
        return {
          className:
            'border-2 border-[#1E4D3B]/80 text-[#1E4D3B] bg-[#1E4D3B]/5 shadow-[inset_0_0_8px_rgba(30,77,59,0.1)]',
          style: baseStyle,
        };
      case 'partial-failure':
        return {
          className:
            'border-2 border-[#8A2E1E] text-[#8A2E1E] bg-[#8A2E1E]/5 shadow-[inset_0_0_8px_rgba(138,46,30,0.1)]',
          style: baseStyle,
        };
      case 'active':
      default:
        return {
          className:
            'border-2 border-[#1F6E7D] text-[#1F6E7D] bg-[#1F6E7D]/5 shadow-[inset_0_0_8px_rgba(31,110,125,0.12)]',
          style: baseStyle,
        };
    }
  };

  const stamp = getStampStyles();

  return (
    <div
      role="button"
      tabIndex={0}
      data-tutorial-id={`dossier-card-${dossier.id}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(dossier.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(dossier.id);
        }
      }}
      className={`relative flex flex-col justify-between w-full max-w-[380px] min-h-[580px] p-6 rounded-xs cursor-pointer select-none transition-all duration-200 outline-none ${getPaperClasses()} ${
        isSelected
          ? 'ring-2 ring-[#7FB7D4] -translate-y-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.7)]'
          : 'hover:-translate-y-1 opacity-95 hover:opacity-100'
      }`}
    >
      {/* Cyan Corner L-Brackets when Active / Selected */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Top-Left */}
          <span className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#7FB7D4]" />
          {/* Top-Right */}
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#7FB7D4]" />
          {/* Bottom-Left */}
          <span className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#7FB7D4]" />
          {/* Bottom-Right */}
          <span className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#7FB7D4]" />
        </div>
      )}

      {/* Top Header Section: Title & Seal */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          {/* Titles */}
          <div className="space-y-0.5">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[0.03em] uppercase leading-tight">
              {dossier.title}
            </h2>
            <h3 className="font-display text-sm sm:text-base font-semibold tracking-[0.14em] uppercase opacity-90">
              {dossier.destination}
            </h3>
          </div>

          {/* Circular Seal Emblem */}
          <div className="shrink-0 -mt-1">
            <ExpeditionSeal type={dossier.sealType} size={70} />
          </div>
        </div>

        {/* Physical Outcome Stamp */}
        <div className="pt-1 pb-1">
          <div
            style={stamp.style}
            className={`inline-block px-3.5 py-1 rounded-xs font-display text-xl sm:text-2xl font-bold tracking-[0.16em] uppercase ${stamp.className}`}
          >
            {dossier.outcomeStamp.label}
          </div>

          {/* Handwritten Annotation for Expedition-IV */}
          {dossier.handwrittenNote && (
            <div className="relative mt-2 -mb-3 ml-12 pointer-events-none select-none">
              <span className="font-serif italic text-xs text-[#5C2B1F] tracking-wide inline-flex items-center gap-1 font-semibold">
                <span>{dossier.handwrittenNote.text}</span>
                <span className="text-sm">⤹</span>
              </span>
            </div>
          )}
        </div>

        {/* Metadata Date Range */}
        <div className="font-mono text-xs tracking-wider opacity-80 pt-1 border-t border-current/15">
          {dossier.dateRange}
        </div>

        {/* Fictional Target (for historical cards) */}
        {dossier.fictionalTarget && (
          <div className="space-y-0.5">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase font-bold opacity-75">
              FICTIONAL TARGET
            </div>
            <div className="font-display text-xs font-semibold tracking-wider uppercase leading-tight">
              {dossier.fictionalTarget}
            </div>
          </div>
        )}

        {/* Objective Paragraph */}
        <div className="space-y-1">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase font-bold opacity-75">
            OBJECTIVE
          </div>
          <p className="font-serif text-xs leading-relaxed opacity-90 line-clamp-4">
            {dossier.objectiveSummary}
          </p>
        </div>

        {/* Debrief Field (for Expedition-V) */}
        {dossier.debriefField && (
          <div className="space-y-1 pt-1">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase font-bold opacity-75">
              DEBRIEF FIELD
            </div>
            <div className="w-full h-14 bg-black/5 border border-current/20 rounded-xs p-2 font-mono text-[10px] opacity-70">
              {dossier.debriefField}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: 4 Mission Segments */}
      <div className="pt-4 border-t border-current/20 mt-4">
        <div className="grid grid-cols-4 gap-1 text-center">
          {dossier.segments.map((seg) => {
            // Pick Segment Icon
            let IconComp = Rocket;
            if (seg.id === 'space') IconComp = Orbit;
            else if (seg.id === 'ground') IconComp = Mountain;
            else if (seg.id === 'user') IconComp = User;

            // Pick Segment Status Color
            let statusColor = 'text-current opacity-85';
            if (seg.status === 'FAILED') statusColor = 'text-[#8A2E1E] font-bold';
            else if (seg.status === 'COMPLETED') statusColor = 'text-[#1E4D3B] font-bold';
            else if (seg.status === 'ACTIVE') statusColor = 'text-[#1F6E7D] font-bold';

            return (
              <div key={seg.id} className="flex flex-col items-center gap-1">
                <span className="font-mono text-[9px] font-bold tracking-wider opacity-75">
                  {seg.label}
                </span>
                <div className="w-7 h-7 flex items-center justify-center opacity-85">
                  <IconComp size={16} />
                </div>
                <span className={`font-mono text-[10px] tracking-tight ${statusColor}`}>
                  {seg.statusText === '✔' ? (
                    <Check size={13} className="inline text-[#1E4D3B]" />
                  ) : seg.statusText === '✕' ? (
                    <X size={13} className="inline text-[#8A2E1E]" />
                  ) : (
                    seg.statusText
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
