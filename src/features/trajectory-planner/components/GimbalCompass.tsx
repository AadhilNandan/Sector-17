import React from 'react';

export interface GimbalCompassProps {
  rotationDeg: number;
  pitchDeg?: number;
}

export const GimbalCompass: React.FC<GimbalCompassProps> = ({ rotationDeg, pitchDeg = 0 }) => {
  return (
    <div className="flex items-center gap-2.5 select-none pointer-events-none">
      <div className="relative w-12 h-12 rounded-full border border-[#7FB7D4]/40 bg-[#0B0F14]/80 flex items-center justify-center shadow-lg">
        {/* Cardinal Markers */}
        <span className="absolute top-0.5 text-[8px] font-mono font-bold text-[#E6E2D6]">N</span>
        <span className="absolute right-1 text-[8px] font-mono font-bold text-[#6B757D]">E</span>
        <span className="absolute bottom-0.5 text-[8px] font-mono font-bold text-[#6B757D]">S</span>
        <span className="absolute left-1 text-[8px] font-mono font-bold text-[#6B757D]">W</span>

        {/* Reticle Crosshairs */}
        <div className="absolute inset-x-2 top-1/2 h-px bg-[#2B3642]/60" />
        <div className="absolute inset-y-2 left-1/2 w-px bg-[#2B3642]/60" />

        {/* Rotating Compass Needle */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
          style={{ transform: `rotate(${-rotationDeg}deg)` }}
        >
          {/* North Pointer Arrow (Cyan) */}
          <div className="w-0.5 h-4 bg-[#7FB7D4] absolute top-1.5 shadow-[0_0_6px_#7FB7D4]" />
          {/* South Pointer (Muted) */}
          <div className="w-0.5 h-3 bg-[#4A5568] absolute bottom-2" />
          {/* Center Pivot */}
          <div className="w-1.5 h-1.5 rounded-full bg-[#E6E2D6] z-10" />
        </div>
      </div>

      <div className="flex flex-col">
        <span className="font-mono text-[10px] tracking-[0.18em] text-[#A9B0B5] uppercase font-bold">
          GIMBAL COMPASS
        </span>
        <span className="font-mono text-[8px] text-[#6B757D]">
          AZ {((rotationDeg % 360 + 360) % 360).toFixed(0)}° // EL {pitchDeg.toFixed(0)}°
        </span>
      </div>
    </div>
  );
};
