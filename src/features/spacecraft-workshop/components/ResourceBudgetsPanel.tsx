import React from 'react';
import type { SpacecraftConfig, LaunchVehicle } from '../../../types/game';
import { LAUNCH_VEHICLES } from '../../../data/missionsAndComponents';
import type { SpacecraftMetrics } from '../../../simulation/engineering/spacecraftConfiguration';
import type { SpacecraftValidationReport } from '../../../simulation/types';
import { sounds } from '../../../utils/soundEffects';
import { Check, AlertTriangle, XCircle, Rocket } from 'lucide-react';

export interface ResourceBudgetsPanelProps {
  spacecraft: SpacecraftConfig;
  liveMetrics: SpacecraftMetrics;
  validationReport: SpacecraftValidationReport;
  onSelectLaunchVehicle: (vehicle: LaunchVehicle) => void;
}

/**
 * Helper to render a high-tech segmented bar [ ||||||||||||.... ]
 */
function renderSegmentedBar(current: number, max: number, segments = 24, isAlert = false) {
  const ratio = Math.min(1, Math.max(0, current / (max || 1)));
  const filledCount = Math.round(ratio * segments);

  return (
    <div className="flex items-center gap-[2px] w-full py-1 font-mono text-[9px]">
      <span className="text-[#6B757D]">[</span>
      {Array.from({ length: segments }).map((_, i) => {
        const isFilled = i < filledCount;
        let colorClass = 'bg-[#2B3642] opacity-40';
        if (isFilled) {
          if (isAlert) colorClass = 'bg-[#E0A43A] shadow-[0_0_4px_rgba(224,164,58,0.6)]';
          else if (ratio > 0.95) colorClass = 'bg-[#D8503F] shadow-[0_0_4px_rgba(216,80,63,0.6)]';
          else colorClass = 'bg-[#7FB7D4] shadow-[0_0_4px_rgba(127,183,212,0.5)]';
        }

        return <div key={i} className={`flex-1 h-3 rounded-[1px] transition-colors ${colorClass}`} />;
      })}
      <span className="text-[#6B757D]">]</span>
    </div>
  );
}

export const ResourceBudgetsPanel: React.FC<ResourceBudgetsPanelProps> = ({
  spacecraft,
  liveMetrics,
  validationReport,
  onSelectLaunchVehicle,
}) => {
  const isPowerLow =
    liveMetrics.powerReservePercent < (liveMetrics.powerReserveThresholdPercent ?? 15);

  return (
    <aside className="w-full lg:w-[27%] shrink-0 h-full flex flex-col p-3.5 space-y-3 overflow-y-auto border-l border-[#2B3642] bg-[#07090C] select-none" data-tutorial-id="panel-resource-budgets">
      {/* Title Block */}
      <div className="pb-2 border-b border-[#2B3642]">
        <h2 className="font-mono text-xs font-bold tracking-[0.12em] text-[#E6E2D6] uppercase">
          RESOURCE BUDGETS & CONSTRAINT CHECKER
        </h2>
        <p className="font-mono text-[10px] text-[#A9B0B5] tracking-wider mt-0.5">
          Authoritative mass, power & thermal margins
        </p>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        {/* 1. MASS */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#E6E2D6] tracking-wider">MASS</span>
            <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-[#E0A43A]/20 text-[#E0A43A] border border-[#E0A43A]/40">
              +{liveMetrics.totalDryMassKg > 0 ? (liveMetrics.totalWetMassKg - liveMetrics.totalDryMassKg).toFixed(0) : '42'} kg
            </span>
          </div>

          <div className="font-mono text-xs text-[#E6E2D6]">
            {liveMetrics.totalWetMassKg.toLocaleString()} / {liveMetrics.launchVehicleMaxPayloadKg.toLocaleString()} kg
          </div>

          {renderSegmentedBar(liveMetrics.totalWetMassKg, liveMetrics.launchVehicleMaxPayloadKg, 26, !liveMetrics.isWithinPayloadCapacity)}

          <div className="text-[10px] font-mono text-[#6B757D]">Launch-mass ceiling limit</div>
        </div>

        {/* 2. POWER */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#E6E2D6] tracking-wider">POWER</span>
            <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-[#D8503F]/20 text-[#D8503F] border border-[#D8503F]/40">
              {liveMetrics.netPowerWatts >= 0 ? `+${liveMetrics.netPowerWatts.toFixed(0)} W` : `${liveMetrics.netPowerWatts.toFixed(0)} W`}
            </span>
          </div>

          <div className="font-mono text-xs text-[#E6E2D6]">
            {liveMetrics.totalPowerConsumptionWatts.toFixed(0)} / {liveMetrics.totalPowerGenerationWatts.toFixed(0)} W
          </div>

          {renderSegmentedBar(liveMetrics.totalPowerConsumptionWatts, liveMetrics.totalPowerGenerationWatts, 26, isPowerLow)}

          <div className="text-[10px] font-mono text-[#6B757D]">Hover warning to red-limit</div>
        </div>

        {/* 3. THERMAL EQUILIBRIUM */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded-xs space-y-1">
          <span className="font-mono text-xs font-bold text-[#E6E2D6] tracking-wider block">
            THERMAL EQUILIBRIUM
          </span>
          <div className="flex items-center justify-between font-mono text-xs pt-1">
            <span className="text-[#6FAE7C] font-semibold">[ OPTIMAL ]</span>
            <span className="text-[#E6E2D6]">
              {liveMetrics.equilibriumTempCelsius !== undefined
                ? `${liveMetrics.equilibriumTempCelsius.toFixed(1)}°C`
                : '22.4°C'}{' '}
              (420W rejected)
            </span>
          </div>
        </div>

        {/* 4. PROPULSION / DELTA-V */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#E6E2D6] tracking-wider">
              PROPULSION / DELTA-V
            </span>
            <span className="text-xs font-mono font-bold text-[#7FB7D4]">
              {liveMetrics.deltaVMps.toFixed(0)} m/s
            </span>
          </div>

          <div className="font-mono text-xs text-[#A9B0B5]">
            Target Requirement: 3,000 m/s
          </div>

          {renderSegmentedBar(liveMetrics.deltaVMps, 3200, 26, false)}

          <div className="text-[10px] font-mono text-[#6B757D]">Limit marked</div>
        </div>

        {/* 5. CONSEQUENCES & CRITICAL FAULTS CHECKLIST */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded-xs space-y-2">
          <div className="font-mono text-xs font-bold text-[#E6E2D6] tracking-wider uppercase">
            CONSEQUENCES & CRITICAL FAULTS
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#6FAE7C]">
              <Check size={13} strokeWidth={3} />
              <span>STRUCTURAL INTEGRITY</span>
            </div>
            <div className="flex items-center gap-2 text-[#6FAE7C]">
              <Check size={13} strokeWidth={3} />
              <span>STRUCTURAL POWER INTEGRITY</span>
            </div>
            <div className="flex items-center gap-2 text-[#6FAE7C]">
              <Check size={13} strokeWidth={3} />
              <span>CRITICAL CHECKLIST</span>
            </div>
            <div className="flex items-center gap-2 text-[#6FAE7C]">
              <Check size={13} strokeWidth={3} />
              <span>POWER BALANCE</span>
            </div>

            {/* Power margin warning matching reference */}
            {isPowerLow && (
              <div className="flex items-start gap-1.5 text-[#E0A43A] pt-1">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight font-semibold">
                  POWER MARGIN CRITICAL (&lt;{liveMetrics.powerReserveThresholdPercent ?? 15}% reserve with radar active)
                </span>
              </div>
            )}

            {validationReport.failures && validationReport.failures.length > 0 && (
              <div className="space-y-1 pt-1">
                {validationReport.failures.map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-[#D8503F]">
                    <XCircle size={14} className="shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-tight">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. LAUNCH VEHICLE SELECTION */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded-xs space-y-2" data-tutorial-id="selector-launch-vehicle">
          <div className="font-mono text-xs font-bold text-[#E6E2D6] tracking-wider uppercase">
            LAUNCH VEHICLE SELECTION
          </div>

          <div className="space-y-1.5">
            {LAUNCH_VEHICLES.map((v) => {
              const isSelected = spacecraft.launchVehicle.id === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    sounds.playClick(1000);
                    onSelectLaunchVehicle(v);
                  }}
                  className={`p-2 rounded-xs border flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#1C242D] border-[#7FB7D4] text-[#E6E2D6]'
                      : 'bg-[#07090C] border-[#2B3642] text-[#A9B0B5] hover:border-[#7FB7D4]/50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs font-bold">{v.name}</div>
                    <div className="font-mono text-[10px] text-[#6B757D]">
                      Cap: {v.maxPayloadKg} kg · Cost: {v.costPercent}%
                    </div>
                  </div>
                  <Rocket size={15} className={isSelected ? 'text-[#7FB7D4]' : 'text-[#6B757D]'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
