import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface MissionOperationsHeaderProps {
  currentStageId?: string;
  isLanderDeployed: boolean;
  onDeployLander: () => void;
  onReturnToTrajectory: () => void;
  onOpenDecisions?: () => void;
  decisionsCount?: number;
  networkStatus?: 'NOMINAL' | 'DEGRADED' | 'SEARCHING';
  flightState?: string;
}

export const MissionOperationsHeader: React.FC<MissionOperationsHeaderProps> = ({
  isLanderDeployed,
  onDeployLander,
  onReturnToTrajectory,
  onOpenDecisions,
  decisionsCount = 0,
  networkStatus = 'NOMINAL',
  flightState = 'ACTIVE',
}) => {
  return (
    <header className="relative w-full h-12 bg-[#060A10]/95 border-b border-white/10 px-4 flex items-center justify-between select-none z-30 font-mono text-xs">
      {/* 1. Left: Return & Title */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            sounds.playClick(1000);
            onReturnToTrajectory();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[#A5B1C2] hover:text-white transition-all cursor-pointer text-[11px] font-bold tracking-wider uppercase"
          title="Return to Trajectory Planner"
        >
          <span>&lt; [ RETURN ]</span>
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold tracking-widest text-[13px] uppercase">
              MISSION OPERATIONS - EXPEDITION-V
            </h1>
          </div>
          <span className="text-[9px] text-[#A5B1C2] tracking-wider uppercase hidden sm:inline">
            AETHON FLIGHT CONTROL // JOVIAN TOUR &amp; EUROPA SURVEY
          </span>
        </div>
      </div>

      {/* 2. Center: Mission Stage Indicators matching reference: LAUNCH [✓] | SPACE [▶ ACTIVE] | GROUND [!] DROP | USER [ ] */}
      <div className="flex items-center gap-2 sm:gap-4 font-mono text-[11px] font-bold tracking-widest">
        {/* LAUNCH */}
        <div
          className="flex items-center gap-1 text-[#31C48D]"
          title="Launch Stage Completed"
        >
          <span className="text-[#A5B1C2]">LAUNCH</span>
          <span>[✓]</span>
        </div>

        <span className="text-white/20">|</span>

        {/* SPACE */}
        <div
          className="flex items-center gap-1 text-[#35C6F4] bg-[#35C6F4]/10 px-2 py-0.5 rounded border border-[#35C6F4]/30 shadow-[0_0_10px_rgba(53,198,244,0.2)]"
          title={`Space Flight Operations: ${flightState}`}
        >
          <span className="text-[#A5B1C2]">SPACE</span>
          <span>[▶ ACTIVE]</span>
        </div>

        <span className="text-white/20">|</span>

        {/* GROUND */}
        <button
          type="button"
          data-tutorial-id="btn-header-drop-lander"
          onClick={() => {
            sounds.playClick(1300);
            onDeployLander();
          }}
          disabled={isLanderDeployed}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
            isLanderDeployed
              ? 'text-[#31C48D] border-[#31C48D]/30 bg-[#31C48D]/10 cursor-default'
              : 'text-[#F5A623] border-[#F5A623]/40 bg-[#F5A623]/15 hover:bg-[#F5A623]/25 animate-pulse'
          }`}
          title={
            isLanderDeployed
              ? 'PROMETHEUS-IV Surface Probe deployed successfully'
              : 'Click to execute operational PROMETHEUS-IV probe deployment'
          }
        >
          <span className="text-[#A5B1C2]">GROUND</span>
          <span>{isLanderDeployed ? '[✓] DEPLOYED' : '[!] DROP'}</span>
        </button>

        <span className="text-white/20">|</span>

        {/* USER */}
        <div
          className="flex items-center gap-1 text-[#A5B1C2]"
          title="Manual Commander Flight Control"
        >
          <span>USER</span>
          <span>[ ]</span>
        </div>
      </div>

      {/* 3. Right: Network Status & Decisions */}
      <div className="flex items-center gap-3">
        {onOpenDecisions && (
          <button
            type="button"
            onClick={() => {
              sounds.playClick(1200);
              onOpenDecisions();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#35C6F4]/15 hover:bg-[#35C6F4]/25 border border-[#35C6F4]/30 text-[#35C6F4] font-mono text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer shadow-sm"
            title="Open Mission Decision Console"
          >
            <span>DECISIONS ({decisionsCount})</span>
          </button>
        )}

        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-black/40 border border-white/10 text-[11px]"
          title="Deep Space Network Link State"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              networkStatus === 'NOMINAL'
                ? 'bg-[#31C48D] shadow-[0_0_8px_#31C48D]'
                : networkStatus === 'DEGRADED'
                ? 'bg-[#F5A623] shadow-[0_0_8px_#F5A623]'
                : 'bg-[#EF6464] animate-ping'
            }`}
          />
          <span className="text-[#A5B1C2] font-semibold tracking-wider uppercase">
            NETWORK STATUS
          </span>
        </div>
      </div>
    </header>
  );
};
