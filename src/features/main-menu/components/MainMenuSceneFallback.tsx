import React from 'react';

/**
 * High-fidelity fallback scene when WebGL is unavailable or disabled.
 * Faithfully reproduces the reference image composition:
 * - Deep space starfield
 * - Massive Jupiter sphere in the upper right with dark terminator and limb glow
 * - AETHON spacecraft silhouette positioned beneath Jupiter
 */
export const MainMenuSceneFallback: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B] select-none" data-testid="main-menu-fallback">
      {/* 1. Subtle deep-space starfield */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="jupiterTerminator" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#DFC3A5" stopOpacity="1" />
            <stop offset="35%" stopColor="#BA8E69" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#7A5237" stopOpacity="0.8" />
            <stop offset="85%" stopColor="#1E140C" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="1" />
          </radialGradient>

          <radialGradient id="jupiterAtmosphereGlow" cx="35%" cy="30%" r="68%">
            <stop offset="75%" stopColor="#D9BF9F" stopOpacity="0" />
            <stop offset="92%" stopColor="#EAD8C2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D9BF9F" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient pin-sharp stars */}
        {Array.from({ length: 140 }).map((_, i) => (
          <circle
            key={i}
            cx={`${(i * 79) % 100}%`}
            cy={`${(i * 43) % 100}%`}
            r={((i % 4) + 1) * 0.45}
            fill="#FFFFFF"
            opacity={((i % 5) + 3) / 10}
          />
        ))}
      </svg>

      {/* 2. Massive Jupiter in upper-right quadrant */}
      <div
        className="absolute -top-[15%] -right-[15%] w-[85vw] h-[85vw] max-w-[1100px] max-h-[1100px] rounded-full overflow-hidden pointer-events-none"
        style={{
          boxShadow: '0 0 80px rgba(186, 142, 105, 0.15)',
        }}
      >
        {/* Real Jupiter Texture / Gradient */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center rounded-full"
          style={{
            backgroundImage: "url('/assets/images/jupiter.jpg')",
            backgroundBlendMode: 'multiply',
          }}
        />

        {/* Shadow Terminator Overlay (curved dark shadow on lower-right) */}
        <div
          className="absolute inset-0 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle at 32% 28%, transparent 40%, rgba(5, 7, 11, 0.6) 65%, rgba(5, 7, 11, 0.98) 85%, #05070B 100%)',
          }}
        />

        {/* Atmospheric Limb Rim Glow */}
        <div
          className="absolute inset-0 w-full h-full rounded-full border border-[#D9BF9F]/20"
          style={{
            boxShadow: 'inset 0 0 35px rgba(223, 195, 165, 0.3)',
          }}
        />
      </div>

      {/* 3. AETHON Spacecraft silhouette positioned beneath Jupiter */}
      <div className="absolute top-[68%] left-[62%] -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
        <svg width="220" height="90" viewBox="0 0 220 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Subtle thruster glow */}
          <circle cx="28" cy="45" r="16" fill="url(#thrusterGlow)" opacity="0.6" />

          <defs>
            <radialGradient id="thrusterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#35C6F4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#35C6F4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Engine bell */}
          <path d="M 38 41 L 28 36 L 28 54 L 38 49 Z" fill="#1A202C" stroke="#2D3748" strokeWidth="1" />
          <circle cx="30" cy="45" r="3" fill="#35C6F4" />

          {/* Main cylindrical bus */}
          <rect x="38" y="38" width="60" height="14" rx="2" fill="#242B35" stroke="#3A4454" strokeWidth="1" />

          {/* Gold MLI mid-section */}
          <rect x="58" y="37" width="22" height="16" rx="1" fill="#D4AF37" opacity="0.9" />

          {/* High-Gain Antenna (HGA) dish */}
          <path d="M 64 26 Q 74 22 84 26 L 82 37 L 66 37 Z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1" />
          <line x1="74" y1="23" x2="74" y2="17" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="74" cy="16" r="1.5" fill="#35C6F4" />

          {/* Port and Starboard solar panels */}
          {/* Starboard panel (left) */}
          <rect x="56" y="4" width="24" height="28" rx="1" fill="#0C1B33" stroke="#2B3642" strokeWidth="1" />
          <line x1="68" y1="4" x2="68" y2="32" stroke="#4A5568" strokeWidth="0.8" />
          <line x1="56" y1="18" x2="80" y2="18" stroke="#4A5568" strokeWidth="0.8" />

          {/* Port panel (right) */}
          <rect x="56" y="58" width="24" height="28" rx="1" fill="#0C1B33" stroke="#2B3642" strokeWidth="1" />
          <line x1="68" y1="58" x2="68" y2="86" stroke="#4A5568" strokeWidth="0.8" />
          <line x1="56" y1="72" x2="80" y2="72" stroke="#4A5568" strokeWidth="0.8" />

          {/* Forward avionics nose */}
          <path d="M 98 40 L 110 45 L 98 50 Z" fill="#1C242D" stroke="#3A4454" strokeWidth="1" />

          {/* Forward Magnetometer boom */}
          <line x1="110" y1="45" x2="148" y2="45" stroke="#64748B" strokeWidth="1" />
          <rect x="148" y="43" width="5" height="4" fill="#D4AF37" />
        </svg>
      </div>
    </div>
  );
};
