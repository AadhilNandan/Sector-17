import React from 'react';
import { ModalDialog } from '../../../components/ui/ModalDialog';
import { GameButton } from '../../../components/ui/GameButton';
import type { SpacecraftConfig } from '../../../types/game';
import { getDefaultSpacecraftConfig, calculateSpacecraftMetrics } from '../../../simulation/engineering/spacecraftConfiguration';
import { sounds } from '../../../utils/soundEffects';

export interface ConfigurationComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpacecraft: SpacecraftConfig;
}

export const ConfigurationComparisonModal: React.FC<ConfigurationComparisonModalProps> = ({
  isOpen,
  onClose,
  currentSpacecraft,
}) => {
  const baseline = getDefaultSpacecraftConfig();
  const baselineMetrics = calculateSpacecraftMetrics(baseline);
  const currentMetrics = calculateSpacecraftMetrics(currentSpacecraft);

  const categories = [
    { id: 'power', label: 'Power Subsystem' },
    { id: 'propulsion', label: 'Propulsion Stage' },
    { id: 'instruments', label: 'Scientific Instruments' },
    { id: 'communication', label: 'Communications Array' },
    { id: 'thermal', label: 'Thermal Control' },
    { id: 'structure', label: 'Primary Structure' },
  ] as const;

  const massDelta = currentMetrics.totalWetMassKg - baselineMetrics.totalWetMassKg;
  const powerDelta = currentMetrics.netPowerWatts - baselineMetrics.netPowerWatts;
  const deltaVDiff = currentMetrics.deltaVMps - baselineMetrics.deltaVMps;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="AETHON // BASELINE vs. CURRENT CONFIGURATION DIFF"
      subtitle="Engineering comparison against standard EXPEDITION-V point design"
      maxWidth="lg"
      footer={
        <div className="flex justify-end w-full">
          <GameButton
            variant="glass"
            size="sm"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
          >
            Close Diff
          </GameButton>
        </div>
      }
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Metric Delta Summary Ribbon */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 bg-[#0D1116] border border-[#2B3642] rounded-xs">
            <span className="text-[#6B757D] text-[10px] uppercase block">Mass Delta</span>
            <span className={`text-sm font-bold ${massDelta > 0 ? 'text-[#E0A43A]' : 'text-[#6FAE7C]'}`}>
              {massDelta >= 0 ? `+${massDelta.toFixed(0)}` : massDelta.toFixed(0)} kg
            </span>
          </div>

          <div className="p-2.5 bg-[#0D1116] border border-[#2B3642] rounded-xs">
            <span className="text-[#6B757D] text-[10px] uppercase block">Net Power Delta</span>
            <span className={`text-sm font-bold ${powerDelta < 0 ? 'text-[#D8503F]' : 'text-[#6FAE7C]'}`}>
              {powerDelta >= 0 ? `+${powerDelta.toFixed(0)}` : powerDelta.toFixed(0)} W
            </span>
          </div>

          <div className="p-2.5 bg-[#0D1116] border border-[#2B3642] rounded-xs">
            <span className="text-[#6B757D] text-[10px] uppercase block">Delta-V Delta</span>
            <span className={`text-sm font-bold ${deltaVDiff >= 0 ? 'text-[#6FAE7C]' : 'text-[#D8503F]'}`}>
              {deltaVDiff >= 0 ? `+${deltaVDiff.toFixed(0)}` : deltaVDiff.toFixed(0)} m/s
            </span>
          </div>
        </div>

        {/* Component By Component Diff Table */}
        <div className="border border-[#2B3642] rounded-xs overflow-hidden">
          <div className="grid grid-cols-3 bg-[#151B22] p-2 font-bold text-[#A9B0B5] text-[11px] border-b border-[#2B3642]">
            <span>SUBSYSTEM</span>
            <span>BASELINE SPEC</span>
            <span>CURRENT SPEC</span>
          </div>

          <div className="divide-y divide-[#2B3642]/60 bg-[#07090C]">
            {categories.map((cat) => {
              const basePart = baseline.parts[cat.id];
              const curPart = currentSpacecraft.parts[cat.id];
              const isChanged = basePart?.id !== curPart?.id;

              return (
                <div
                  key={cat.id}
                  className={`grid grid-cols-3 p-2 text-[11px] items-center ${
                    isChanged ? 'bg-[#7FB7D4]/10 text-[#E6E2D6]' : 'text-[#A9B0B5]'
                  }`}
                >
                  <span className="font-semibold">{cat.label}</span>
                  <span className="text-[#6B757D]">{basePart?.name || 'Standard'}</span>
                  <span className={isChanged ? 'text-[#7FB7D4] font-bold' : ''}>
                    {curPart?.name || 'Standard'} {isChanged && '★'}
                  </span>
                </div>
              );
            })}

            {/* Launch Vehicle Diff */}
            <div className="grid grid-cols-3 p-2 text-[11px] items-center bg-[#07090C] text-[#A9B0B5]">
              <span className="font-semibold">Launch Booster</span>
              <span className="text-[#6B757D]">{baseline.launchVehicle.name}</span>
              <span
                className={
                  baseline.launchVehicle.id !== currentSpacecraft.launchVehicle.id
                    ? 'text-[#7FB7D4] font-bold'
                    : ''
                }
              >
                {currentSpacecraft.launchVehicle.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
};
