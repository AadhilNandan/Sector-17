import React, { useState, useEffect } from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface ExpeditionArchiveHeaderProps {
  onReturn: () => void;
  onOpenSettings: () => void;
  missionClockMET?: string;
}

export const ExpeditionArchiveHeader: React.FC<ExpeditionArchiveHeaderProps> = ({
  onReturn,
  onOpenSettings,
}) => {
  const [systemTime, setSystemTime] = useState<string>('04.12.2031 - 08:30');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      // In-universe mission year baseline (2031+)
      const year = 2031 + (now.getFullYear() - 2026);
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setSystemTime(`${month}.${day}.${year} - ${hours}:${mins}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative z-20 flex items-center justify-between px-6 md:px-10 py-3.5 border-b border-[#2B3642]/60 bg-[#07090C]/90 backdrop-blur-xs select-none">
      {/* Left: Return Button & Title */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onReturn();
          }}
          className="font-mono text-xs md:text-sm tracking-wider text-[#A9B0B5] hover:text-[#FFFFFF] transition-colors cursor-pointer py-1 px-2 rounded-xs hover:bg-white/5 outline-none"
        >
          [ &lt; RETURN ]
        </button>

        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-[0.06em] text-[#E6E2D6] uppercase">
          EXPEDITION ARCHIVE
        </h1>
      </div>

      {/* Right: Settings & System Time */}
      <div className="flex items-center gap-6 md:gap-8">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onOpenSettings();
          }}
          className="font-mono text-xs md:text-sm tracking-wider text-[#A9B0B5] hover:text-[#FFFFFF] transition-colors cursor-pointer py-1 px-2 rounded-xs hover:bg-white/5 outline-none"
        >
          [ SETTINGS ]
        </button>

        <div className="text-right font-mono">
          <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B757D]">
            SYSTEM TIME
          </div>
          <div className="text-xs md:text-sm tracking-wider text-[#E6E2D6]">
            {systemTime}
          </div>
        </div>
      </div>
    </header>
  );
};
