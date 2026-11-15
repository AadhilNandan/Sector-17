import React from 'react';

export const TransitCruiseScene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B] select-none">
      {/* Background Deep Space Starfield & Subtle JWST Nebula */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-25 mix-blend-screen scale-105"
        style={{ backgroundImage: `url('/assets/images/deep_space.jpg')` }}
      />
      {/* Darkening vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070B] via-[#080D16]/80 to-[#05070B]/90" />

      {/* SVG Canvas for Celestial Bodies, Trajectory Vectors & Spacecraft */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Spherical Clip Paths */}
          <clipPath id="jupiterTransitClip">
            <circle cx="1520" cy="540" r="380" />
          </clipPath>
          <clipPath id="europaTransitClip">
            <circle cx="1140" cy="280" r="70" />
          </clipPath>

          {/* Jupiter Spherical Terminator Shadow */}
          <radialGradient id="jupiterTransitShadow" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#000000" stopOpacity="0.1" />
            <stop offset="75%" stopColor="#05070B" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#020408" stopOpacity="0.98" />
          </radialGradient>

          {/* Europa Spherical Terminator Shadow */}
          <radialGradient id="europaTransitShadow" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0.2" />
            <stop offset="85%" stopColor="#05070B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#020408" stopOpacity="0.98" />
          </radialGradient>

          {/* Ion Engine Plasma Plume Gradient */}
          <linearGradient id="ionExhaustPlume" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#35C6F4" />
            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </linearGradient>

          {/* Ion Core High Heat */}
          <radialGradient id="ionCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#35C6F4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>

          {/* Solar Panel Texture */}
          <pattern id="solarGridCruise" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#0d1e38" stroke="#35C6F4" strokeWidth="0.4" strokeOpacity="0.4" />
            <line x1="0" y1="6" x2="12" y2="6" stroke="#35C6F4" strokeWidth="0.3" strokeOpacity="0.3" />
          </pattern>
        </defs>

        {/* Ambient background stars */}
        {Array.from({ length: 140 }).map((_, i) => (
          <circle
            key={i}
            cx={(i * 137.5) % 1920}
            cy={(i * 93.7) % 1080}
            r={((i % 4) + 1) * 0.65}
            fill="#ffffff"
            opacity={((i % 5) + 3) / 10}
          />
        ))}

        {/* Navigation Trajectory Vector Lines */}
        <path
          d="M 120 740 Q 640 680 1020 460 T 1140 280"
          stroke="#35C6F4"
          strokeWidth="1.5"
          strokeDasharray="8 8"
          fill="none"
          opacity="0.4"
        />

        {/* ======================================================== */}
        {/* CELESTIAL BODY 1: JUPITER (High-res photographic disk)   */}
        {/* ======================================================== */}
        <g>
          {/* Subtle atmospheric Jovian glow */}
          <circle cx="1520" cy="540" r="392" fill="#F5A623" opacity="0.12" filter="blur(8px)" />
          <circle cx="1520" cy="540" r="384" fill="#35C6F4" opacity="0.08" />

          {/* High-res Cassini Jupiter image */}
          <image
            href="/assets/images/jupiter.jpg"
            x="1140"
            y="160"
            width="760"
            height="760"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#jupiterTransitClip)"
          />

          {/* Spherical Day/Night Terminator Shadow */}
          <circle
            cx="1520"
            cy="540"
            r="380"
            fill="url(#jupiterTransitShadow)"
          />

          {/* Subdued limb rim light */}
          <circle
            cx="1520"
            cy="540"
            r="380"
            fill="none"
            stroke="#fed7aa"
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />
        </g>

        {/* ======================================================== */}
        {/* CELESTIAL BODY 2: EUROPA (Hanging above Jupiter)         */}
        {/* ======================================================== */}
        <g>
          {/* Subtle Europa atmospheric halo */}
          <circle cx="1140" cy="280" r="74" fill="#35C6F4" opacity="0.18" />

          {/* High-res Galileo Europa image */}
          <image
            href="/assets/images/europa.jpg"
            x="1070"
            y="210"
            width="140"
            height="140"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#europaTransitClip)"
          />

          {/* Europa Day/Night Terminator */}
          <circle
            cx="1140"
            cy="280"
            r="70"
            fill="url(#europaTransitShadow)"
          />

          <circle
            cx="1140"
            cy="280"
            r="70"
            fill="none"
            stroke="#35C6F4"
            strokeWidth="1"
            strokeOpacity="0.6"
          />

          {/* Europa Label & Reticle */}
          <line x1="1140" y1="365" x2="1140" y2="385" stroke="#35C6F4" strokeWidth="1" opacity="0.7" />
          <line x1="1140" y1="385" x2="1200" y2="385" stroke="#35C6F4" strokeWidth="1" opacity="0.7" />
          <text
            x="1208"
            y="389"
            fill="#35C6F4"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="11"
            letterSpacing="2"
            opacity="0.9"
          >
            TARGET // EUROPA [04h TO INSERTION]
          </text>
        </g>

        {/* ======================================================== */}
        {/* EXPEDITION SPACECRAFT IN TRANSIT FLIGHT                  */}
        {/* Seen from rear-quarter angle facing towards Jupiter      */}
        {/* ======================================================== */}
        <g transform="translate(680, 640) rotate(-14) scale(1.35)">
          {/* Twin Ion Thruster Exhaust Plumes */}
          {/* Upper Plume */}
          <polygon
            points="-85,-22 -320,-38 -320,-4 -85,-10"
            fill="url(#ionExhaustPlume)"
          />
          <circle cx="-85" cy="-16" r="14" fill="url(#ionCoreGlow)" />
          <ellipse cx="-85" cy="-16" rx="5" ry="9" fill="#ffffff" />
          {/* Core high-intensity flare */}
          <line x1="-85" y1="-16" x2="-260" y2="-21" stroke="#ffffff" strokeWidth="2.5" opacity="0.85" />

          {/* Lower Plume */}
          <polygon
            points="-85,10 -320,4 -320,38 -85,22"
            fill="url(#ionExhaustPlume)"
          />
          <circle cx="-85" cy="16" r="14" fill="url(#ionCoreGlow)" />
          <ellipse cx="-85" cy="16" rx="5" ry="9" fill="#ffffff" />
          {/* Core high-intensity flare */}
          <line x1="-85" y1="16" x2="-260" y2="21" stroke="#ffffff" strokeWidth="2.5" opacity="0.85" />

          {/* Upper Extended Solar Array Wing (Angled perspective) */}
          <g>
            <polygon
              points="-30,-18 30,-58 120,-72 60,-28"
              fill="url(#solarGridCruise)"
              stroke="#35C6F4"
              strokeWidth="1.2"
            />
            {/* Array Structural Truss */}
            <line x1="-25" y1="-18" x2="35" y2="-58" stroke="#94a3b8" strokeWidth="2.5" />
            <line x1="35" y1="-58" x2="120" y2="-72" stroke="#94a3b8" strokeWidth="2" />
          </g>

          {/* Lower Extended Solar Array Wing (Angled perspective) */}
          <g>
            <polygon
              points="-30,18 60,28 120,72 30,58"
              fill="url(#solarGridCruise)"
              stroke="#35C6F4"
              strokeWidth="1.2"
            />
            {/* Array Structural Truss */}
            <line x1="-25" y1="18" x2="35" y2="58" stroke="#94a3b8" strokeWidth="2.5" />
            <line x1="35" y1="58" x2="120" y2="72" stroke="#94a3b8" strokeWidth="2" />
          </g>

          {/* Main Spacecraft Hull Fuselage */}
          <polygon
            points="-90,-26 40,-30 110,0 40,30 -90,26 -80,0"
            fill="#101925"
            stroke="#334155"
            strokeWidth="2"
          />

          {/* Central Service Module Ceramic Plating */}
          <polygon
            points="-70,-22 25,-24 85,0 25,24 -70,22"
            fill="#162232"
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Thermal Gold Foil Insulation Shielding */}
          <polygon
            points="-50,-16 0,-18 10,0 0,18 -50,16"
            fill="#D88A18"
            stroke="#F5A623"
            strokeWidth="1"
          />

          {/* High-Gain Parabolic Communications Dish Antenna */}
          <ellipse
            cx="20"
            cy="0"
            rx="24"
            ry="14"
            fill="#080D16"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="0" r="3" fill="#35C6F4" />
          <line x1="20" y1="0" x2="36" y2="0" stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Forward Instrument Boom & Star Tracker */}
          <polygon
            points="85,0 120,-4 125,0 120,4"
            fill="#cbd5e1"
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Navigation Strobe Lights */}
          <circle cx="125" cy="0" r="3" fill="#35C6F4" className="animate-ping" />
          <circle cx="30" cy="-58" r="2.5" fill="#31C48D" />
          <circle cx="30" cy="58" r="2.5" fill="#EF6464" />
        </g>

        {/* Viewport Technical HUD Overlay (Telemetry & Grid) */}
        <g opacity="0.6">
          <text
            x="48"
            y="980"
            fill="#6D7A8D"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="11"
            letterSpacing="2"
          >
            NAV VECTOR // BRG 084.2° · VEL 28.4 KM/S · ION EFFICIENCY 98.6%
          </text>
        </g>
      </svg>
    </div>
  );
};
