import React from 'react';

export interface DebriefTrajectoryReplayProps {
  isDescentPerformed?: boolean;
}

export const DebriefTrajectoryReplay: React.FC<DebriefTrajectoryReplayProps> = ({
  isDescentPerformed = true,
}) => {
  return (
    <div className="flex flex-col gap-1 w-full font-mono select-none">
      <div className="flex items-center justify-between text-[11px] font-bold text-[#2E3440] uppercase tracking-wider">
        <span>2D TRAJECTORY REPLAY</span>
      </div>

      <div className="relative w-full h-36 bg-[#ECE5D8] rounded border border-[#2E3440]/30 p-2 overflow-hidden shadow-inner">
        <svg
          viewBox="0 0 320 120"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle celestial grid lines */}
          <line x1="10" y1="60" x2="310" y2="60" stroke="#2E3440" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
          <line x1="80" y1="10" x2="80" y2="110" stroke="#2E3440" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
          <line x1="220" y1="10" x2="220" y2="110" stroke="#2E3440" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />

          {/* 1. Jupiter (Left) */}
          <g transform="translate(60, 60)">
            <circle cx="0" cy="0" r="26" fill="#E4DCD0" stroke="#2E3440" strokeWidth="1.2" />
            {/* Atmospheric storm bands */}
            <path d="M -25 -10 Q 0 -12 25 -10" stroke="#2E3440" strokeWidth="0.8" opacity="0.7" />
            <path d="M -26 -3 Q 0 -5 26 -3" stroke="#2E3440" strokeWidth="1.0" opacity="0.8" />
            <path d="M -26 4 Q 0 2 26 4" stroke="#2E3440" strokeWidth="0.8" opacity="0.7" />
            <path d="M -25 12 Q 0 10 25 12" stroke="#2E3440" strokeWidth="0.7" opacity="0.6" />
            <circle cx="10" cy="6" r="3" stroke="#2E3440" strokeWidth="0.6" opacity="0.6" />
          </g>

          {/* 2. Europa (Middle-Right) */}
          <g transform="translate(135, 60)">
            <circle cx="0" cy="0" r="10" fill="#F4EEE0" stroke="#2E3440" strokeWidth="1.2" />
            {/* Surface lineae */}
            <path d="M -8 -3 L 8 4" stroke="#2E3440" strokeWidth="0.6" opacity="0.6" />
            <path d="M -6 5 L 6 -5" stroke="#2E3440" strokeWidth="0.5" opacity="0.5" />
            <circle cx="-2" cy="-2" r="1.5" stroke="#2E3440" strokeWidth="0.5" opacity="0.5" />
          </g>

          {/* 3. Trajectory Ellipse Line (Solid approach & transfer path) */}
          <path
            d="M 10 75 Q 60 85 140 70 T 300 35"
            stroke="#4A6572"
            strokeWidth="1.5"
            fill="none"
          />

          {/* Directional arrowhead */}
          <polygon
            points="70,82 62,79 66,85"
            fill="#4A6572"
          />

          {/* Elliptical capture arc */}
          <path
            d="M 130 55 C 180 20, 290 20, 295 42 C 300 65, 230 75, 145 68"
            stroke="#2E3440"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            fill="none"
          />

          {/* 4. Node Markers */}
          {/* JOI: Jupiter Orbit Insertion */}
          <g transform="translate(295, 42)">
            <circle cx="0" cy="0" r="2.5" fill="#2E3440" />
            <text x="6" y="-3" fill="#2E3440" fontSize="8" fontFamily="monospace" fontWeight="bold">
              JOI
            </text>
          </g>

          {/* EOI: Europa Orbit Insertion */}
          <g transform="translate(260, 68)">
            <circle cx="0" cy="0" r="2" fill="#2E3440" />
            <text x="-6" y="10" fill="#2E3440" fontSize="8" fontFamily="monospace" fontWeight="bold">
              EOI
            </text>
          </g>

          {/* Descent: Lander Release Track */}
          {isDescentPerformed && (
            <g transform="translate(285, 70)">
              <circle cx="0" cy="0" r="2" fill="#BA4D2A" />
              <path d="M -20 -3 Q 0 0 10 10" stroke="#BA4D2A" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
              <text x="5" y="10" fill="#BA4D2A" fontSize="8" fontFamily="monospace" fontWeight="bold">
                DESCENT
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
