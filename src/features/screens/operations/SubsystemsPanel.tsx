/**
 * SECTOR 17 — Spacecraft Subsystems Telemetry Panel
 * Authoritative operational states across EPS, Propulsion, TCS, Comms, Storage, and Science.
 * Strictly avoids invented health percentages.
 */

import React from 'react';
import { Zap, Flame, Thermometer, Radio, Database, Microscope } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { useSimulationSnapshot } from '../../../runtime';
import type { SubsystemType, SubsystemStatus } from '../../../simulation/flightSoftware/types';

interface SubsystemDisplayItem {
  type: SubsystemType | 'STORAGE';
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  status: SubsystemStatus;
}

export const SubsystemsPanel: React.FC = () => {
  const snap = useSimulationSnapshot();

  // Storage derived status based on solid-state recorder utilization
  const storageStatus: SubsystemStatus =
    snap.storage.utilizationPercent >= 95
      ? 'FAULT'
      : snap.storage.utilizationPercent >= 80
      ? 'DEGRADED'
      : 'NOMINAL';

  const items: SubsystemDisplayItem[] = [
    {
      type: 'EPS',
      label: 'Electrical Power',
      sublabel: 'Bus & Solar/RTG Distribution',
      icon: <Zap size={14} className="text-[#35C6F4]" />,
      status: snap.subsystems.EPS ?? 'UNKNOWN',
    },
    {
      type: 'PROPULSION',
      label: 'Main Propulsion',
      sublabel: 'Bipropellant Thrusters & Valves',
      icon: <Flame size={14} className="text-[#F5A623]" />,
      status: snap.subsystems.PROPULSION ?? 'UNKNOWN',
    },
    {
      type: 'TCS',
      label: 'Thermal Control',
      sublabel: 'Survival Heaters & Louvers',
      icon: <Thermometer size={14} className="text-[#35C6F4]" />,
      status: snap.subsystems.TCS ?? 'UNKNOWN',
    },
    {
      type: 'COMMUNICATIONS',
      label: 'RF Communications',
      sublabel: 'X/Ka-band High Gain Array',
      icon: <Radio size={14} className="text-[#35C6F4]" />,
      status: snap.subsystems.COMMUNICATIONS ?? 'UNKNOWN',
    },
    {
      type: 'STORAGE',
      label: 'Solid-State Recorder',
      sublabel: 'Onboard Non-Volatile Storage',
      icon: <Database size={14} className="text-[#31C48D]" />,
      status: storageStatus,
    },
    {
      type: 'SCIENCE',
      label: 'Science Payload',
      sublabel: 'REASON Radar & MASPEX',
      icon: <Microscope size={14} className="text-[#35C6F4]" />,
      status: snap.subsystems.SCIENCE ?? 'OFF',
    },
  ];

  const getStatusBadge = (status: SubsystemStatus) => {
    switch (status) {
      case 'NOMINAL':
        return {
          pillClass: 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30',
          dotClass: 'bg-[#31C48D] shadow-[0_0_6px_rgba(49,196,141,0.8)]',
          label: 'NOMINAL',
        };
      case 'DEGRADED':
        return {
          pillClass: 'bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/30',
          dotClass: 'bg-[#F5A623] shadow-[0_0_6px_rgba(245,166,35,0.8)]',
          label: 'DEGRADED',
        };
      case 'FAULT':
        return {
          pillClass: 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30',
          dotClass: 'bg-[#EF6464] shadow-[0_0_6px_rgba(239,100,100,0.8)]',
          label: 'FAULT',
        };
      case 'SAFE':
        return {
          pillClass: 'bg-[#35C6F4]/15 text-[#35C6F4] border-[#35C6F4]/30',
          dotClass: 'bg-[#35C6F4] shadow-[0_0_6px_rgba(53,198,244,0.8)]',
          label: 'SAFE MODE',
        };
      case 'OFF':
      default:
        return {
          pillClass: 'bg-white/5 text-[#A5B1C2] border-white/10',
          dotClass: 'bg-[#6D7A8D]',
          label: status,
        };
    }
  };

  return (
    <GamePanel
      title="Subsystems Status"
      subtitle="Avionics & Payload Health"
      className="border-white/10"
    >
      <div className="space-y-2.5">
        {items.map((item) => {
          const badge = getStatusBadge(item.status);
          return (
            <div
              key={item.type}
              className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-white/5 border border-white/10">
                  {item.icon}
                </div>
                <div>
                  <div className="font-mono text-xs font-semibold text-[#F1F5FA] tracking-wide">
                    {item.label}
                  </div>
                  <div className="font-mono text-[10px] text-[#A5B1C2]">
                    {item.sublabel}
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${badge.pillClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                <span>{badge.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </GamePanel>
  );
};

