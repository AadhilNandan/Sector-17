import React, { useState, useEffect } from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface WorkshopHeaderProps {
  onReturn: () => void;
  countdownMET?: string;
}

export const WorkshopHeader: React.FC<WorkshopHeaderProps> = ({
  onReturn,
  countdownMET = '12:44:02:18',
}) => {
  const [countdown, setCountdown] = useState<string>(countdownMET);

  useEffect(() => {
    // T-Minus ticker countdown simulation
    const timer = setInterval(() => {
      setCountdown((prev) => {
        const parts = prev.split(':').map(Number);
        if (parts.length === 4) {
          let [d, h, m, s] = parts;
          if (s > 0) s--;
          else {
            s = 59;
            if (m > 0) m--;
            else {
              m = 59;
              if (h > 0) h--;
              else {
                h = 23;
                if (d > 0) d--;
              }
            }
          }
          return `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full flex items-center justify-between px-6 py-2.5 bg-[#E6E2D6] text-[#0D1116] border-b border-[#C8C2B3] select-none shrink-0">
      {/* Left: Return to Archive Button */}
      <button
        type="button"
        onClick={() => {
          sounds.playClick();
          onReturn();
        }}
        className="font-mono text-xs md:text-sm tracking-wider font-semibold hover:text-[#2B3642] cursor-pointer py-1 px-2 rounded-xs hover:bg-black/5 transition-colors outline-none"
      >
        [ &lt; RETURN TO ARCHIVE ]
      </button>

      {/* Centre: Title Block */}
      <div className="font-display text-lg md:text-2xl font-bold tracking-[0.06em] uppercase text-center">
        EXPEDITION-V: EUROPA SURVEY // SPACECRAFT AETHON CONFIGURATION
      </div>

      {/* Right: Mission Countdown */}
      <div className="font-mono text-xs md:text-sm tracking-wider font-bold tabular-nums">
        <span className="text-[#5A6372] mr-2">T-MINUS</span>
        <span>{countdown}</span>
      </div>
    </header>
  );
};
