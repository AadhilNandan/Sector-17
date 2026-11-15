import React from 'react';

export const AnomalyChamberScene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B] select-none">
      {/* Background Deep Space Starfield & Cavern Fissure */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-15 mix-blend-screen scale-105"
        style={{ backgroundImage: `url('/assets/images/deep_space.jpg')` }}
      />

      {/* Atmospheric Vignette & Volumetric Fog Layers */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-transparent to-[#05070B]/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070B]/90 via-transparent to-[#05070B]/85" />

      {/* SVG Canvas for Colossal Precursor Torus & Singularity Core */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Intense Golden Singularity Core Gradient */}
          <radialGradient id="anomalyCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="22%" stopColor="#fef08a" />
            <stop offset="48%" stopColor="#F5A623" stopOpacity="0.9" />
            <stop offset="75%" stopColor="#D88A18" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0" />
          </radialGradient>

          {/* Broad Radial Energy Field */}
          <radialGradient id="anomalyEnergyField" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#D88A18" stopOpacity="0.2" />
            <stop offset="75%" stopColor="#35C6F4" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0" />
          </radialGradient>

          {/* Metallic Alien Alloy Gradient */}
          <linearGradient id="torusMetallicAlloy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="25%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="75%" stopColor="#334155" />
            <stop offset="100%" stopColor="#101925" />
          </linearGradient>

          {/* Ground Dust Amber Illumination */}
          <linearGradient id="groundAmberGaze" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#D88A18" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ambient starfield visible through ceiling chasm */}
        {Array.from({ length: 85 }).map((_, i) => (
          <circle
            key={i}
            cx={(i * 179.3) % 1920}
            cy={(i * 59.1) % 450}
            r={((i % 4) + 1) * 0.65}
            fill="#ffffff"
            opacity={((i % 4) + 2) / 10}
          />
        ))}

        {/* Rocky Volcanic Cavern Flanks */}
        <polygon points="0,0 360,0 260,480 0,720" fill="#080D16" />
        <polygon points="0,680 420,860 620,1080 0,1080" fill="#101925" />
        <polygon points="1580,0 1920,0 1920,880 1520,540" fill="#080D16" opacity="0.9" />

        {/* Ground excavation bedrock floor */}
        <polygon points="260,1080 620,780 1480,780 1780,1080" fill="url(#groundAmberGaze)" />

        {/* ======================================================== */}
        {/* COLOSSAL PRECURSOR ALIEN TOROIDAL PORTAL                 */}
        {/* Centered at (780, 520) matching reference framing        */}
        {/* ======================================================== */}
        <g transform="translate(780, 520)">
          {/* Volumetric Radial Aura */}
          <circle cx="0" cy="0" r="440" fill="url(#anomalyEnergyField)" />

          {/* Radiating Volumetric Energy Strands */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const x2 = 380 * Math.cos((angle * Math.PI) / 180);
            const y2 = 380 * Math.sin((angle * Math.PI) / 180);
            return (
              <line
                key={i}
                x1="0"
                y1="0"
                x2={x2}
                y2={y2}
                stroke="#F5A623"
                strokeWidth={i % 2 === 0 ? '1.5' : '0.8'}
                strokeDasharray={i % 2 === 0 ? '8 12' : '4 16'}
                opacity={i % 3 === 0 ? '0.45' : '0.2'}
              />
            );
          })}

          {/* Ring Foundation Support Struts & Braced Monoliths */}
          <polygon points="-380,380 -240,160 -180,180 -280,420" fill="#101925" stroke="#334155" strokeWidth="2" />
          <polygon points="380,380 240,160 180,180 280,420" fill="#101925" stroke="#334155" strokeWidth="2" />
          <polygon points="-80,260 0,180 80,260 160,420 -160,420" fill="#162232" stroke="#475569" strokeWidth="1.5" />

          {/* Outer Layer 1: Massive Segmented Alloy Ring */}
          <circle cx="0" cy="0" r="320" fill="none" stroke="url(#torusMetallicAlloy)" strokeWidth="48" />
          <circle cx="0" cy="0" r="320" fill="none" stroke="#64748b" strokeWidth="2.5" strokeDasharray="36 12" />
          <circle cx="0" cy="0" r="344" fill="none" stroke="#F5A623" strokeWidth="1" strokeOpacity="0.4" />
          <circle cx="0" cy="0" r="296" fill="none" stroke="#35C6F4" strokeWidth="1" strokeOpacity="0.3" />

          {/* Outer Ring Alien Runic Glyphs & Segments */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            const rad = (angle * Math.PI) / 180;
            const x = 320 * Math.cos(rad);
            const y = 320 * Math.sin(rad);
            return (
              <g key={i} transform={`translate(${x}, ${y}) rotate(${angle})`}>
                <rect x="-8" y="-8" width="16" height="16" fill="#080D16" stroke="#F5A623" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="3" fill="#ffffff" />
              </g>
            );
          })}

          {/* Layer 2: Middle Structural Pylons with Runic Arcs */}
          <circle cx="0" cy="0" r="240" fill="none" stroke="#0f172a" strokeWidth="32" />
          <circle cx="0" cy="0" r="240" fill="none" stroke="#F5A623" strokeWidth="4" strokeDasharray="24 16" opacity="0.9" />
          <circle cx="0" cy="0" r="224" fill="none" stroke="#D88A18" strokeWidth="1.5" strokeDasharray="8 8" />

          {/* Layer 3: Inner Counter-Rotating Harmonic Accelerator Ring */}
          <circle cx="0" cy="0" r="175" fill="none" stroke="#162232" strokeWidth="18" />
          <circle cx="0" cy="0" r="175" fill="none" stroke="#35C6F4" strokeWidth="3.5" strokeDasharray="60 25" opacity="0.85" />
          <circle cx="0" cy="0" r="162" fill="none" stroke="#F5A623" strokeWidth="3" strokeDasharray="16 16" />

          {/* Layer 4: Aperture Glowing Threshold & Singularity Core */}
          <circle cx="0" cy="0" r="125" fill="none" stroke="#ffffff" strokeWidth="3" className="animate-pulse" />
          <circle cx="0" cy="0" r="115" fill="url(#anomalyCoreGlow)" />

          {/* Pure White Singularity Center & High Heat Corona */}
          <circle cx="0" cy="0" r="42" fill="#ffffff" />
          <circle cx="0" cy="0" r="46" fill="none" stroke="#fef08a" strokeWidth="4" />
          <circle cx="0" cy="0" r="54" fill="none" stroke="#F5A623" strokeWidth="2" strokeDasharray="6 6" />

          {/* Excavation Ramps & Approach Standoff Markers */}
          <polygon points="-220,320 -100,340 100,340 220,320 280,440 -280,440" fill="#080D16" stroke="#334155" strokeWidth="2" />
          <line x1="-180" y1="360" x2="180" y2="360" stroke="#F5A623" strokeWidth="1" strokeDasharray="8 8" opacity="0.6" />
        </g>

        {/* ======================================================== */}
        {/* HUD SCANNER TARGETING RETICLE (Amber Brackets)           */}
        {/* ======================================================== */}
        <g transform="translate(780, 520)">
          {/* Target Corner Brackets */}
          <path d="M -420 -400 L -360 -400 M -420 -400 L -420 -340" stroke="#F5A623" strokeWidth="3" fill="none" />
          <path d="M 420 -400 L 360 -400 M 420 -400 L 420 -340" stroke="#F5A623" strokeWidth="3" fill="none" />
          <path d="M -420 400 L -360 400 M -420 400 L -420 340" stroke="#F5A623" strokeWidth="3" fill="none" />
          <path d="M 420 400 L 360 400 M 420 400 L 420 340" stroke="#F5A623" strokeWidth="3" fill="none" />

          {/* Telemetry Annotation Label */}
          <text
            x="-410"
            y="-420"
            fill="#F5A623"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="12"
            fontWeight="bold"
            letterSpacing="2"
          >
            [ ANOMALY DETECTED // PRECURSOR TORUS SINGULARITY ]
          </text>
          <text
            x="-410"
            y="435"
            fill="#35C6F4"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="11"
            letterSpacing="1.5"
          >
            FREQ: 1420.4057 MHz · ANOMALOUS GRAVITATIONAL GRADIENT
          </text>
        </g>
      </svg>
    </div>
  );
};
