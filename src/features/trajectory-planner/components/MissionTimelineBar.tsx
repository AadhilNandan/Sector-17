import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export interface TimelineMilestone {
  id: string;
  label: string;
  day: number;
  isCompleted?: boolean;
  isCurrent?: boolean;
}

export interface MissionTimelineBarProps {
  currentDay: number;
  distanceToEuropaKm?: number;
  speedKmS?: number;
  onSelectMilestone?: (milestoneId: string) => void;
  isRunning?: boolean;
  onTogglePlay?: () => void;
  onResetView?: () => void;
}

const DEFAULT_MILESTONES: TimelineMilestone[] = [
  { id: 'arrival', label: 'AETHON ARRIVAL', day: 180, isCompleted: true },
  { id: 'joi', label: 'JOI BURN', day: 182.5, isCompleted: true },
  { id: 'current', label: 'YOU ARE HERE', day: 184, isCurrent: true },
  { id: 'influence', label: 'EUROPA INFLUENCE', day: 186.2 },
  { id: 'deployment', label: 'ROVER DEPLOYMENT', day: 190.5 },
];

export const MissionTimelineBar: React.FC<MissionTimelineBarProps> = ({
  currentDay = 184,
  distanceToEuropaKm = 24500,
  speedKmS = 1.8,
  onSelectMilestone,
  isRunning = false,
  onTogglePlay,
  onResetView,
}) => {
  const minDay = 180;
  const maxDay = 195;
  const dayRange = maxDay - minDay;

  // Determine whether mission is pre-arrival (e.g. prelaunch or cruise prior to Jovian encounter)
  const isPreArrival = currentDay < minDay;
  const effectiveDay = isPreArrival ? 184 : Math.min(maxDay, currentDay);

  const getPositionPercent = (day: number) => {
    return Math.max(0, Math.min(100, ((day - minDay) / dayRange) * 100));
  };

  const progressPercent = getPositionPercent(effectiveDay);

  const dayTicks = [180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 195];

  return (
    <footer className="w-full bg-[#080B0F]/95 border-t border-[#1F2733] px-4 md:px-8 py-3 flex flex-col gap-2 select-none z-30 shrink-0" data-tutorial-id="bar-mission-timeline">
      {/* 1. Timeline Track & Milestones */}
      <div className="relative w-full pt-6 pb-2">
        {/* Milestone Labels Above Track */}
        <div className="relative w-full h-7">
          {DEFAULT_MILESTONES.map((m) => {
            const left = getPositionPercent(m.day);
            const isHere = m.isCurrent;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMilestone?.(m.id)}
                className={`absolute -translate-x-1/2 flex flex-col items-center cursor-pointer transition-transform hover:scale-105 ${
                  isHere ? 'text-[#7FB7D4]' : m.isCompleted ? 'text-[#E6E2D6]' : 'text-[#8D96A0]'
                }`}
                style={{ left: `${left}%` }}
              >
                <span className="font-mono text-[9px] md:text-[10px] tracking-[0.14em] font-bold uppercase whitespace-nowrap">
                  {m.label}
                </span>
                <span className="text-[10px] leading-none">▾</span>
              </div>
            );
          })}
        </div>

        {/* Horizontal Timeline Bar Line */}
        <div className="relative w-full h-1 bg-[#1F2733] rounded-full overflow-hidden">
          {/* Active Completed Segment */}
          <div
            className="h-full bg-gradient-to-r from-[#31C48D] via-[#7FB7D4] to-[#7FB7D4]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* "YOU ARE HERE" Vertical Indicator Bar */}
        <div
          className="absolute top-5 -translate-x-1/2 w-0.5 h-6 bg-[#7FB7D4] shadow-[0_0_8px_#7FB7D4] pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        />

        {/* Day Tick Numbers Below Track */}
        <div className="relative w-full flex items-center justify-between mt-2 font-mono text-[9px] md:text-[10px] text-[#6B757D]">
          <span className="font-bold text-[#8D96A0] uppercase tracking-wider">
            {isPreArrival ? 'PLANNED MET DAY 180 to 195 // JOVIAN TOUR' : 'MET DAY 180 to 195'}
          </span>
          <div className="flex-1 relative mx-6 h-4 hidden sm:block">
            {dayTicks.map((day) => {
              const left = getPositionPercent(day);
              return (
                <span
                  key={day}
                  className={`absolute -translate-x-1/2 ${
                    day === Math.floor(effectiveDay) ? 'text-[#7FB7D4] font-bold' : ''
                  }`}
                  style={{ left: `${left}%` }}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Subline Telemetry & NASA Disclaimer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-[#141A22] font-mono text-[10px] text-[#8D96A0]">
        {/* Telemetry info */}
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              title={isRunning ? 'Pause Simulation' : 'Resume Simulation'}
              className="p-1 rounded bg-[#11161D] hover:bg-[#1C2530] border border-[#2B3642] text-[#7FB7D4] transition-colors cursor-pointer"
            >
              {isRunning ? <Pause size={12} /> : <Play size={12} />}
            </button>
          )}

          {onResetView && (
            <button
              type="button"
              onClick={onResetView}
              title="Reset View"
              className="p-1 rounded bg-[#11161D] hover:bg-[#1C2530] border border-[#2B3642] text-[#A9B0B5] hover:text-[#FFFFFF] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
            </button>
          )}

          <div>
            <span className="text-[#E6E2D6] font-bold">AETHON</span>
            <span className="mx-1 text-[#4A5568]">//</span>
            <span>DISTANCE TO EUROPA: <strong className="text-[#E6E2D6]">{distanceToEuropaKm.toLocaleString()} km</strong></span>
            <span className="mx-1 text-[#4A5568]">//</span>
            <span>SPEED: <strong className="text-[#31C48D]">{speedKmS.toFixed(1)} km/s</strong></span>
          </div>
        </div>

        {/* Attribution & Legal Compliance */}
        <div className="text-[9px] text-[#6B757D]">
          SECTOR 17 is an independent project. NASA does not endorse SECTOR 17.
        </div>
      </div>
    </footer>
  );
};
