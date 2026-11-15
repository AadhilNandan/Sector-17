import React from 'react';
import { Lock } from 'lucide-react';
import type { Mission } from '../../types/game';
import { sounds } from '../../utils/soundEffects';

export interface JupiterSystemSceneProps {
  currentMission?: Mission;
  onSelectMission: (id: string) => void;
}

export const JupiterSystemScene: React.FC<JupiterSystemSceneProps> = ({
  onSelectMission,
}) => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B]">
      {/* Background Deep Space Starfield & Subtle Cosmic Dust */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30 mix-blend-screen scale-105"
        style={{ backgroundImage: `url('/assets/images/deep_space.jpg')` }}
      />
      <div className="absolute inset-0 w-full h-full bg-radial from-transparent via-[#05070B]/75 to-[#05070B] pointer-events-none" />

      {/* SVG Canvas for Orbital Tracks, Planetary Globes & Starchart Grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Day/Night Spherical Terminator Shadow for Jupiter */}
          <radialGradient id="jupiterTerminator" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="55%" stopColor="#05070B" stopOpacity="0.3" />
            <stop offset="85%" stopColor="#05070B" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="1" />
          </radialGradient>

          {/* Europa Day/Night Terminator */}
          <radialGradient id="europaTerminator" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <stop offset="55%" stopColor="#05070B" stopOpacity="0.25" />
            <stop offset="85%" stopColor="#05070B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0.95" />
          </radialGradient>

          <pattern id="starchartGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="60" y2="0" stroke="rgba(53, 198, 244, 0.05)" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="60" stroke="rgba(53, 198, 244, 0.05)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Tactical Starchart Grid */}
        <rect width="100%" height="100%" fill="url(#starchartGrid)" />

        {/* Distant stars */}
        {Array.from({ length: 90 }).map((_, i) => (
          <circle
            key={i}
            cx={`${(i * 73) % 100}%`}
            cy={`${(i * 39) % 100}%`}
            r={((i % 3) + 1) * 0.6}
            fill="#FFFFFF"
            opacity={((i % 4) + 2) / 10}
          />
        ))}

        {/* Jovian System Orbital Track Ellipses (Centered on Jupiter in Upper-Right) */}
        <g transform="translate(1120, 200)">
          {/* Io orbit */}
          <ellipse cx="0" cy="0" rx="380" ry="270" fill="none" stroke="#35C6F4" strokeWidth="1" strokeDasharray="3 5" opacity="0.3" />
          {/* Europa orbit (Highlight) */}
          <ellipse cx="0" cy="0" rx="540" ry="380" fill="none" stroke="#35C6F4" strokeWidth="1.5" opacity="0.6" />
          {/* Ganymede orbit */}
          <ellipse cx="0" cy="0" rx="740" ry="510" fill="none" stroke="#35C6F4" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />
          {/* Callisto orbit */}
          <ellipse cx="0" cy="0" rx="940" ry="640" fill="none" stroke="#35C6F4" strokeWidth="1" strokeDasharray="5 7" opacity="0.2" />
        </g>
      </svg>

      {/* ======================================================== */}
      {/* REAL PHOTOGRAPHIC JUPITER (Upper-Right)                  */}
      {/* ======================================================== */}
      <div
        className="absolute z-10 pointer-events-none"
        style={{ right: '-40px', top: '10px', width: '480px', height: '480px' }}
      >
        {/* Atmospheric outer glow */}
        <div className="absolute inset-0 rounded-full bg-[#F5A623]/10 blur-2xl transform scale-105" />

        {/* Photographic Globe with Day/Night Terminator */}
        <div className="relative w-full h-full rounded-full overflow-hidden shadow-[0_0_60px_rgba(216,138,24,0.3)]">
          <img
            src="/assets/images/jupiter.jpg"
            alt="Jupiter Cassini Mosaic"
            className="w-full h-full object-cover object-center transform scale-110"
          />
          {/* Spherical Day/Night Terminator Overlay */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,transparent_35%,rgba(5,7,11,0.5)_65%,rgba(5,7,11,0.98)_95%)]" />
          <div className="absolute inset-0 rounded-full border border-[#FED7AA]/30" />
        </div>
      </div>

      {/* ======================================================== */}
      {/* INTERACTIVE DESTINATION MOONS (NASA Eyes style)          */}
      {/* ======================================================== */}

      {/* 1. Europa (Active Target, Center-Right, exactly like reference) */}
      <div
        className="absolute z-20 cursor-pointer group flex flex-col items-center"
        style={{ right: '35%', top: '38%' }}
        onClick={() => {
          sounds.playClick(1300);
          onSelectMission('europa-survey');
        }}
      >
        <div className="relative flex items-center justify-center">
          {/* Target Reticle Pulsing Rings */}
          <div className="absolute w-32 h-32 rounded-full border border-[#35C6F4]/30 animate-ping opacity-40 pointer-events-none" />
          <div className="absolute w-28 h-28 rounded-full border border-[#35C6F4]/70 shadow-[0_0_24px_rgba(53,198,244,0.45)] pointer-events-none" />

          {/* Photographic Europa Globe (Galileo Global Mosaic) */}
          <div className="w-22 h-22 rounded-full relative overflow-hidden shadow-2xl border border-white/20">
            <img
              src="/assets/images/europa.jpg"
              alt="Europa Galileo Global View"
              className="w-full h-full object-cover object-center"
            />
            {/* Spherical terminator shadow */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_38%_35%,transparent_35%,rgba(5,7,11,0.35)_65%,rgba(5,7,11,0.95)_95%)]" />
          </div>
        </div>

        {/* Active Name Pill */}
        <div className="mt-3.5 px-3.5 py-1 bg-[#0B1422]/90 border border-[#35C6F4] rounded-full text-xs font-mono font-bold tracking-widest text-[#F1F5FA] shadow-[0_0_16px_rgba(53,198,244,0.5)] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35C6F4] animate-pulse" />
          <span>Europa</span>
        </div>
      </div>

      {/* 2. Io (Volcanic, Upper-Left of Europa) */}
      <div
        className="absolute z-20 flex flex-col items-center opacity-70 hover:opacity-90 transition-opacity cursor-not-allowed"
        style={{ right: '50%', top: '22%' }}
        onClick={() => sounds.playHover()}
      >
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-[radial-gradient(circle_at_35%_35%,#FEF08A_0%,#EAB308_40%,#C2410C_80%,#451A03_100%)] shadow-lg border border-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-1 rounded-full bg-black/70 border border-white/20">
              <Lock size={12} className="text-slate-300" />
            </div>
          </div>
        </div>
        <span className="mt-1.5 text-[10px] font-mono text-[#A5B1C2] tracking-wider">Io (Locked)</span>
      </div>

      {/* 3. Ganymede (Lower-Left of Europa) */}
      <div
        className="absolute z-20 flex flex-col items-center opacity-70 hover:opacity-90 transition-opacity cursor-not-allowed"
        style={{ right: '60%', top: '56%' }}
        onClick={() => sounds.playHover()}
      >
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-[radial-gradient(circle_at_35%_35%,#CBD5E1_0%,#64748B_50%,#0F172A_100%)] shadow-lg border border-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-1 rounded-full bg-black/70 border border-white/20">
              <Lock size={12} className="text-slate-300" />
            </div>
          </div>
        </div>
        <span className="mt-1.5 text-[10px] font-mono text-[#A5B1C2] tracking-wider">Ganymede (Locked)</span>
      </div>

      {/* 4. Callisto (Outer Jovian Orbit) */}
      <div
        className="absolute z-20 flex flex-col items-center opacity-70 hover:opacity-90 transition-opacity cursor-not-allowed"
        style={{ right: '16%', top: '50%' }}
        onClick={() => sounds.playHover()}
      >
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-[radial-gradient(circle_at_35%_35%,#94A3B8_0%,#475569_60%,#05070B_100%)] shadow-lg border border-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-1 rounded-full bg-black/70 border border-white/20">
              <Lock size={12} className="text-slate-300" />
            </div>
          </div>
        </div>
        <span className="mt-1.5 text-[10px] font-mono text-[#A5B1C2] tracking-wider">Callisto (Locked)</span>
      </div>
    </div>
  );
};
