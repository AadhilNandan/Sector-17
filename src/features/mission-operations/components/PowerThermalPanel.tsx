import React from 'react';
import type { SimulationSnapshot } from '../../../runtime/types';

export interface PowerThermalPanelProps {
  snap: SimulationSnapshot;
}

/**
 * Segmented level meter bar for aerospace instrumentation.
 */
const SegmentedBar: React.FC<{
  value: number;
  max: number;
  min?: number;
  segments?: number;
  variant?: 'cyan' | 'amber' | 'green' | 'white';
}> = ({ value, max, min = 0, segments = 12, variant = 'cyan' }) => {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const activeCount = Math.round(norm * segments);

  const activeColor =
    variant === 'amber'
      ? 'bg-[#F5A623]'
      : variant === 'green'
      ? 'bg-[#31C48D]'
      : variant === 'white'
      ? 'bg-white'
      : 'bg-[#35C6F4]';

  return (
    <div className="flex gap-1 items-center h-2 w-full max-w-[140px] bg-black/60 p-0.5 rounded border border-white/10">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-full rounded-[1px] transition-all duration-300 ${
            i < activeCount ? activeColor : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
};

export const PowerThermalPanel: React.FC<PowerThermalPanelProps> = ({ snap }) => {
  // Authoritative values from simulation
  const powerBudget = snap.powerBudget;
  const thermalModel = snap.thermalModel;

  const reservePct = powerBudget?.powerReservePercent ?? 92;
  const busVoltage = 24.0 + (reservePct / 100) * 4.4;
  const batterySoc = reservePct;
  const solarGen = powerBudget?.totalGenerationWatts ?? 720;
  const expectedSolar = 800;
  const powerDraw = powerBudget?.totalConsumptionWatts ?? 680;
  const netMargin = powerBudget?.netPowerWatts ?? 40;

  // Temperatures
  const eqTemp = thermalModel?.equilibriumTemperatureKelvin ?? 281;
  const battTemp = Math.round(eqTemp);
  const avionicsTemp = Math.round(eqTemp + 2);
  const propulsionTemp = Math.round(eqTemp);
  const instrumentsTemp = Math.round(eqTemp + 4);

  return (
    <aside
      className="w-full h-full bg-[#060A10]/90 backdrop-blur-md border-r border-white/10 p-3.5 flex flex-col gap-4 font-mono select-none overflow-y-auto text-xs"
      aria-label="Power and Thermal Telemetry Panel"
    >
      {/* Panel Header */}
      <div className="border-b border-white/10 pb-2">
        <h2 className="text-[#A5B1C2] text-[11px] font-bold tracking-widest uppercase">
          POWER &amp; THERMAL
        </h2>
        <span className="text-[9px] text-[#A5B1C2]/60 uppercase">
          EPS // TCS Subsystem Telemetry
        </span>
      </div>

      {/* 1. BUS VOLTAGE */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[#A5B1C2] text-[11px] font-semibold">BUS VOLTAGE:</span>
          <span className="text-white font-bold text-[12px]">{busVoltage.toFixed(1)} V</span>
        </div>
        <SegmentedBar value={busVoltage} min={24} max={32} variant="cyan" />
      </div>

      {/* 2. PRIMARY BATTERY TEMP */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[#A5B1C2] text-[11px] font-semibold">BATTERY TEMP:</span>
          <span className="text-white font-bold text-[12px]">{battTemp.toFixed(0)} K</span>
        </div>
        <SegmentedBar value={battTemp} min={260} max={310} variant="cyan" />
      </div>

      {/* 3. SOLAR GENERATION (WARNING BOX AS IN REFERENCE) */}
      <div className="p-2.5 rounded bg-[#F5A623]/10 border border-[#F5A623]/40 space-y-1 shadow-[0_0_12px_rgba(245,166,35,0.15)]">
        <div className="flex items-center justify-between">
          <span className="text-[#F5A623] text-[11px] font-bold tracking-wider">
            SOLAR GENERATION:
          </span>
          <span className="text-white font-bold text-[12px]">{solarGen.toFixed(0)} W</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#F5A623] font-semibold">[!] EXPECTED:</span>
          <span className="text-[#A5B1C2]">{expectedSolar} W</span>
        </div>
        <SegmentedBar value={solarGen} min={0} max={expectedSolar} variant="amber" />
      </div>

      {/* 4. SECONDARY BATTERY / AVIONICS TEMP */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[#A5B1C2] text-[11px] font-semibold">BATTERY TEMP:</span>
          <span className="text-white font-bold text-[12px]">{avionicsTemp.toFixed(0)} K</span>
        </div>
        <SegmentedBar value={avionicsTemp} min={260} max={310} variant="cyan" />
      </div>

      {/* 5. PROPULSION TEMP */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[#A5B1C2] text-[11px] font-semibold">BATTERY TEMP:</span>
          <span className="text-white font-bold text-[12px]">{propulsionTemp.toFixed(0)} K</span>
        </div>
        <SegmentedBar value={propulsionTemp} min={260} max={310} variant="cyan" />
      </div>

      {/* 6. INSTRUMENT TEMP */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[#A5B1C2] text-[11px] font-semibold">BATTERY TEMP:</span>
          <span className="text-white font-bold text-[12px]">{instrumentsTemp.toFixed(0)} K</span>
        </div>
        <SegmentedBar value={instrumentsTemp} min={260} max={310} variant="cyan" />
      </div>

      {/* Extra Telemetry Footer */}
      <div className="mt-auto pt-3 border-t border-white/10 space-y-1.5 text-[10px]">
        <div className="flex justify-between text-[#A5B1C2]">
          <span>BATTERY SOC:</span>
          <span className="text-[#31C48D] font-bold">{batterySoc.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-[#A5B1C2]">
          <span>TOTAL LOAD:</span>
          <span className="text-white font-semibold">{powerDraw.toFixed(0)} W</span>
        </div>
        <div className="flex justify-between text-[#A5B1C2]">
          <span>NET MARGIN:</span>
          <span className={netMargin >= 0 ? 'text-[#31C48D] font-semibold' : 'text-[#EF6464] font-semibold'}>
            {netMargin >= 0 ? `+${netMargin.toFixed(0)}` : netMargin.toFixed(0)} W
          </span>
        </div>
      </div>
    </aside>
  );
};
