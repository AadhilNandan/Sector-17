/**
 * SECTOR 17 — Propulsion Reserves & Solid-State Storage Telemetry Panel
 * Directly sources propellant remaining from PropulsionSubsystem and capacity from OnboardStorage.
 */

import React from 'react';
import { Fuel, Database, AlertTriangle } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { useSimulationSnapshot } from '../../../runtime';

export const PropulsionStoragePanel: React.FC = () => {
  const snap = useSimulationSnapshot();

  const propellantRemaining = snap.propellantRemainingKg;
  const propellantCapacity = snap.propellantCapacityKg;
  const propellantConsumed = Math.max(0, propellantCapacity - propellantRemaining);
  const propellantPercent = propellantCapacity > 0 ? (propellantRemaining / propellantCapacity) * 100 : 0;

  const storageUsedMb = snap.storage.usedBytes / (1024 * 1024);
  const storageCapMb = snap.storage.capacityBytes / (1024 * 1024);
  const storageUtil = snap.storage.utilizationPercent;

  return (
    <div className="flex flex-col gap-4">
      {/* Propulsion & Propellant Budget Panel */}
      <GamePanel
        title="Propulsion Reserves"
        subtitle="Hydrazine / Nitrogen Tetroxide (NTO)"
        className="border-white/10"
      >
        <div className="space-y-3 font-mono text-xs">
          {/* Remaining Fuel Hero */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[#F5A623]/20 border border-[#F5A623]/30">
                <Fuel size={14} className="text-[#F5A623]" />
              </div>
              <div>
                <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">Remaining Mass</div>
                <div className="text-base font-bold text-[#F1F5FA]">
                  {propellantRemaining.toFixed(1)} <span className="text-xs text-[#A5B1C2]">kg</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">Reserve Level</div>
              <div className="text-sm font-bold text-[#F5A623]">{propellantPercent.toFixed(1)}%</div>
            </div>
          </div>

          {/* Propellant Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  propellantPercent > 40
                    ? 'bg-[#31C48D]'
                    : propellantPercent > 20
                    ? 'bg-[#F5A623]'
                    : 'bg-[#EF6464]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, propellantPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#A5B1C2]">
              <span>Consumed: {propellantConsumed.toFixed(1)} kg</span>
              <span>Capacity: {propellantCapacity.toFixed(1)} kg</span>
            </div>
          </div>
        </div>
      </GamePanel>

      {/* Solid-State Data Recorder Panel */}
      <GamePanel
        title="Onboard Storage"
        subtitle="Solid-State Data Recorder (SSDR)"
        className="border-white/10"
      >
        <div className="space-y-3 font-mono text-xs">
          {/* Storage Capacity Hero */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[#35C6F4]/20 border border-[#35C6F4]/30">
                <Database size={14} className="text-[#35C6F4]" />
              </div>
              <div>
                <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">Storage Utilized</div>
                <div className="text-base font-bold text-[#F1F5FA]">
                  {storageUsedMb.toFixed(2)} <span className="text-xs text-[#A5B1C2]">MB</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">Utilization</div>
              <div className="text-sm font-bold text-[#35C6F4]">{storageUtil.toFixed(1)}%</div>
            </div>
          </div>

          {/* Storage Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  storageUtil >= 95
                    ? 'bg-[#EF6464]'
                    : storageUtil >= 80
                    ? 'bg-[#F5A623]'
                    : 'bg-[#35C6F4]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, storageUtil))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#A5B1C2]">
              <span>Available: {Math.max(0, storageCapMb - storageUsedMb).toFixed(2)} MB</span>
              <span>Capacity: {storageCapMb.toFixed(0)} MB</span>
            </div>
          </div>

          {/* Capacity Constraint Warning */}
          {storageUtil >= 80 && (
            <div
              className={`flex items-center gap-1.5 p-2 rounded text-[10px] ${
                storageUtil >= 95
                  ? 'bg-[#EF6464]/15 border border-[#EF6464]/30 text-[#EF6464]'
                  : 'bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F5A623]'
              }`}
            >
              <AlertTriangle size={12} className="shrink-0" />
              <span>
                {storageUtil >= 95
                  ? 'CRITICAL: SSDR capacity nearly exhausted. Queue telemetry downlinks.'
                  : 'WARNING: Recorder utilization exceeds 80%. Downlink recommended.'}
              </span>
            </div>
          )}
        </div>
      </GamePanel>
    </div>
  );
};

