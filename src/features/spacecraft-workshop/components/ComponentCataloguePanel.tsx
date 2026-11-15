import React, { useState } from 'react';
import type { ComponentCategory, SpacecraftPart, SpacecraftConfig } from '../../../types/game';
import { COMPONENT_CATALOG } from '../../../data/missionsAndComponents';
import { sounds } from '../../../utils/soundEffects';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

export interface ComponentCataloguePanelProps {
  spacecraft: SpacecraftConfig;
  selectedCategory: ComponentCategory;
  onSelectCategory: (cat: ComponentCategory) => void;
  onSelectPart: (cat: ComponentCategory, part: SpacecraftPart) => void;
}

interface DisciplineConfig {
  id: ComponentCategory;
  label: string;
}

const DISCIPLINES: DisciplineConfig[] = [
  { id: 'power', label: 'POWER' },
  { id: 'propulsion', label: 'PROPULSION' },
  { id: 'thermal', label: 'THERMAL' },
  { id: 'structure', label: 'STRUCTURES' },
  { id: 'communication', label: 'COMMUNICATIONS' },
  { id: 'instruments', label: 'INSTRUMENTS' },
];

export const ComponentCataloguePanel: React.FC<ComponentCataloguePanelProps> = ({
  spacecraft,
  selectedCategory,
  onSelectCategory,
  onSelectPart,
}) => {
  // Track open/collapsed state of disciplines
  const [openDisciplines, setOpenDisciplines] = useState<Record<string, boolean>>({
    instruments: true,
    power: true,
    propulsion: false,
    thermal: false,
    structure: false,
    communication: false,
  });

  const toggleDiscipline = (catId: string) => {
    sounds.playClick(1100);
    setOpenDisciplines((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  return (
    <aside className="w-full lg:w-[26%] shrink-0 h-full flex flex-col p-3.5 space-y-3 overflow-y-auto border-r border-[#2B3642] bg-[#07090C] select-none">
      {/* Header */}
      <div className="pb-2 border-b border-[#2B3642]">
        <h2 className="font-mono text-xs font-bold tracking-[0.12em] text-[#E6E2D6] uppercase">
          COMPONENT CATALOGUE // DISCIPLINE FILTER
        </h2>
      </div>

      {/* Accordion List */}
      <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
        {DISCIPLINES.map((discipline) => {
          const isOpen = openDisciplines[discipline.id];
          const parts = COMPONENT_CATALOG[discipline.id] || [];
          const activePart = spacecraft.parts[discipline.id];
          const isCategorySelected = selectedCategory === discipline.id;

          return (
            <div
              key={discipline.id}
              className={`rounded-xs border transition-colors ${
                isCategorySelected
                  ? 'border-[#7FB7D4]/60 bg-[#0D1116]'
                  : 'border-[#2B3642]/60 bg-[#0D1116]/60'
              }`}
            >
              {/* Discipline Accordion Header */}
              <button
                type="button"
                data-tutorial-id={`tab-category-${discipline.id}`}
                onClick={() => {
                  toggleDiscipline(discipline.id);
                  onSelectCategory(discipline.id);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left font-mono text-xs tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2 text-[#E6E2D6] font-semibold">
                  {isOpen ? <ChevronDown size={14} className="text-[#7FB7D4]" /> : <ChevronRight size={14} className="text-[#6B757D]" />}
                  <span>{discipline.label}</span>
                </div>
                {activePart && (
                  <span className="font-mono text-[10px] text-[#A9B0B5] truncate max-w-[130px]">
                    {activePart.name}
                  </span>
                )}
              </button>

              {/* Expanded Component Entries */}
              {isOpen && (
                <div className="p-2 space-y-2 border-t border-[#2B3642]/50 bg-[#07090C]/80">
                  {parts.map((part) => {
                    const isSelected = activePart?.id === part.id;
                    const isInstrumentRadar = part.id === 'inst-subsurface-radar';

                    return (
                      <div
                        key={part.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectCategory(discipline.id);
                          onSelectPart(discipline.id, part);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onSelectCategory(discipline.id);
                            onSelectPart(discipline.id, part);
                          }
                        }}
                        className={`p-2.5 rounded-xs border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1C242D] border-[#7FB7D4] text-[#E6E2D6] shadow-[0_0_8px_rgba(127,183,212,0.15)]'
                            : 'bg-[#0D1116] border-[#2B3642] text-[#A9B0B5] hover:border-[#7FB7D4]/40 hover:bg-[#151B22]'
                        }`}
                      >
                        {/* Title & Checkbox */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-[#7FB7D4] border-[#7FB7D4] text-[#07090C]'
                                  : 'border-[#4A5568]'
                              }`}
                            >
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span className="font-mono text-xs font-semibold text-[#E6E2D6]">
                              {part.name}
                            </span>
                          </div>

                          {/* Budget Tag */}
                          <div className="font-mono text-[10px] text-right shrink-0">
                            <span className="text-[#E0A43A]">+{part.massKg} kg</span>
                            <span className="text-[#6B757D]"> | </span>
                            <span className="text-[#7FB7D4]">{part.powerKw > 0 ? `+${part.powerKw * 1000} W` : `-${Math.abs(part.powerKw * 1000)} W`}</span>
                          </div>
                        </div>

                        {/* If Selected: Detailed Engineering Notes */}
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-[#2B3642] space-y-1.5 font-mono text-[11px]">
                            {/* Scientific Objective for radar / instruments */}
                            {isInstrumentRadar && (
                              <div className="text-[#7FB7D4] font-semibold text-[10px]">
                                Objective: Is there liquid water under the ice?
                              </div>
                            )}

                            <p className="text-[#A9B0B5] text-[10px] leading-relaxed">
                              {part.description}
                            </p>

                            {isInstrumentRadar && (
                              <div className="text-[10px] text-[#E0A43A]/90 bg-[#E0A43A]/10 p-1.5 rounded-xs border border-[#E0A43A]/30">
                                Explain this: Piers through kilometers of ice. Like an X-ray for glaciers. What goes wrong: Without it, we blind-drill and risk landing on unsafe, fractured crust.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
