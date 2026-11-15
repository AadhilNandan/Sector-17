/**
 * SECTOR 17 — Electrical Power & Thermal Systems Telemetry Panel
 * Physical power budget calculation and equilibrium thermal model output.
 * Distinguishes uncalculated states with explicit 'DATA UNAVAILABLE' badges.
 */

import React from 'react';
import { Zap, Thermometer, Sun } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { useSimulationSnapshot } from '../../../runtime';

export const PowerThermalPanel: React.FC = () => {
  const snap = useSimulationSnapshot();
  const pb = snap.powerBudget;
  const tm = snap.thermalModel;

  return (
    <div className="flex flex-col gap-4">
      {/* Electrical Power Budget Panel */}
      <GamePanel
        title="Electrical Power"
        subtitle="Generation & Load Budget"
        className="border-white/10"
      >
        {pb ? (
          <div className="space-y-3 font-mono text-xs">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider flex items-center gap-1">
                  <Sun size={11} className="text-[#F5A623]" />
                  <span>Generation</span>
                </div>
                <div className="text-sm font-bold text-[#F1F5FA] mt-0.5">
                  {pb.totalGenerationWatts.toFixed(0)} <span className="text-[10px] text-[#A5B1C2]">W</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider flex items-center gap-1">
                  <Zap size={11} className="text-[#35C6F4]" />
                  <span>Consumption</span>
                </div>
                <div className="text-sm font-bold text-[#F1F5FA] mt-0.5">
                  {pb.totalConsumptionWatts.toFixed(0)} <span className="text-[10px] text-[#A5B1C2]">W</span>
                </div>
              </div>
            </div>

            {/* Margin & Reserve */}
            <div className="space-y-1.5 pt-1 border-t border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A5B1C2]">Net Margin</span>
                <span
                  className={`font-bold ${
                    pb.netPowerWatts >= 0 ? 'text-[#31C48D]' : 'text-[#EF6464]'
                  }`}
                >
                  {pb.netPowerWatts >= 0 ? '+' : ''}
                  {pb.netPowerWatts.toFixed(0)} W
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A5B1C2]">Power Reserve</span>
                <span className="font-bold text-[#F1F5FA]">
                  {pb.powerReservePercent.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A5B1C2]">Budget Status</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    pb.status === 'NOMINAL'
                      ? 'bg-[#31C48D]/20 text-[#31C48D]'
                      : pb.status === 'WARNING'
                      ? 'bg-[#F5A623]/20 text-[#F5A623]'
                      : 'bg-[#EF6464]/20 text-[#EF6464]'
                  }`}
                >
                  {pb.status}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs font-mono text-[#A5B1C2] bg-white/5 rounded-lg border border-white/10">
            DATA UNAVAILABLE
          </div>
        )}
      </GamePanel>

      {/* Thermal Equilibrium Model Panel */}
      <GamePanel
        title="Thermal Balance"
        subtitle="Equilibrium Model (Stefan-Boltzmann)"
        className="border-white/10"
      >
        {tm ? (
          <div className="space-y-3 font-mono text-xs">
            {/* Equilibrium Temperature Display */}
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider flex items-center gap-1">
                  <Thermometer size={12} className="text-[#35C6F4]" />
                  <span>Equilibrium Temp</span>
                </div>
                <div className="text-base font-bold text-[#F1F5FA] mt-0.5">
                  {tm.equilibriumTemperatureKelvin.toFixed(1)}{' '}
                  <span className="text-xs text-[#A5B1C2]">K</span>{' '}
                  <span className="text-xs text-[#35C6F4]">
                    ({tm.equilibriumTemperatureCelsius.toFixed(1)} °C)
                  </span>
                </div>
              </div>

              <div
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  tm.status === 'NOMINAL'
                    ? 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30'
                    : 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30'
                }`}
              >
                {tm.status}
              </div>
            </div>

            {/* Limits & Heat Metrics */}
            <div className="space-y-1.5 pt-1 border-t border-white/5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-[#A5B1C2]">Operating Limits</span>
                <span className="text-[#F1F5FA] font-medium">[233.0 K, 333.0 K]</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#A5B1C2]">Solar Absorption</span>
                <span className="text-[#F1F5FA] font-medium">
                  {tm.solarAbsorbedPowerWatts.toFixed(0)} W
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#A5B1C2]">Internal Heat Dissipation</span>
                <span className="text-[#F1F5FA] font-medium">
                  {tm.internalHeatWatts.toFixed(0)} W
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs font-mono text-[#A5B1C2] bg-white/5 rounded-lg border border-white/10">
            DATA UNAVAILABLE
          </div>
        )}
      </GamePanel>
    </div>
  );
};
