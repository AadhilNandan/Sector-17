import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface MissionElapsedTimeProps {
  metSeconds: number;
  formattedMET: string;
  isPaused: boolean;
  warpRate: number;
  onStepTime: (deltaSeconds: number) => void;
  onTogglePause: () => void;
  onSetWarp: (warp: number) => void;
}

export const MissionElapsedTime: React.FC<MissionElapsedTimeProps> = ({
  metSeconds,
  formattedMET,
  isPaused,
  warpRate,
  onStepTime,
  onTogglePause,
  onSetWarp,
}) => {
  // Format as DDD:HH:MM:SS
  const days = Math.floor(metSeconds / 86400);
  const hours = Math.floor((metSeconds % 86400) / 3600);
  const minutes = Math.floor((metSeconds % 3600) / 60);
  const seconds = Math.floor(metSeconds % 60);

  const digitalDisplay = `${String(days).padStart(3, '0')}:${String(hours).padStart(2, '0')}:${String(
    minutes
  ).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className="flex flex-col justify-between h-full bg-[#060A10]/95 border-r border-white/10 p-3 select-none font-mono text-xs"
      aria-label="Mission Elapsed Time Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="text-[#A5B1C2] text-[10px] font-bold tracking-widest uppercase">
          MISSION ELAPSED TIME (MET)
        </span>
        <span className="text-[10px] text-[#35C6F4] font-semibold">{formattedMET}</span>
      </div>

      {/* Main Digital Clock Display (Large) */}
      <div className="my-auto py-1">
        <div
          className="text-white font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-widest font-mono text-left drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
          title="Authoritative Simulation Mission Elapsed Time"
        >
          {digitalDisplay}
        </div>
      </div>

      {/* Simulation Stepping & Warp Rate Controls */}
      <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick(1000);
            onTogglePause();
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
            isPaused
              ? 'bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40'
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
          }`}
          title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
        >
          {isPaused ? 'RESUME' : 'PAUSE'}
        </button>

        {/* Time Advance Buttons: +1s, +10s, +60s */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick(1100);
            onStepTime(1);
          }}
          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-[#A5B1C2] hover:text-white transition-all cursor-pointer"
          title="Step +1 second"
        >
          +1s
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick(1150);
            onStepTime(10);
          }}
          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-[#A5B1C2] hover:text-white transition-all cursor-pointer"
          title="Step +10 seconds"
        >
          +10s
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick(1200);
            onStepTime(60);
          }}
          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-[#35C6F4] hover:text-white transition-all cursor-pointer font-bold"
          title="Step +60 seconds"
        >
          +60s
        </button>

        {/* Warp Multipliers */}
        <div className="ml-auto flex items-center gap-1 text-[9px] text-[#A5B1C2]">
          {[1, 5, 10].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                sounds.playClick(1300);
                onSetWarp(w);
              }}
              className={`px-1 rounded cursor-pointer ${
                warpRate === w ? 'bg-[#35C6F4]/30 text-[#35C6F4] font-bold' : 'hover:text-white'
              }`}
            >
              {w}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
