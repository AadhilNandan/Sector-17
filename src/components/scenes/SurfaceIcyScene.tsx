import React from 'react';

export const SurfaceIcyScene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B] select-none">
      {/* Background Starfield and Sky */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-20 mix-blend-screen scale-105"
        style={{ backgroundImage: `url('/assets/images/deep_space.jpg')` }}
      />

      {/* Photorealistic Europa Surface Mosaic Terrain Base */}
      <div
        className="absolute bottom-0 left-0 w-full h-[60%] bg-cover bg-bottom opacity-40 mix-blend-luminosity filter contrast-125"
        style={{ backgroundImage: `url('/assets/images/europa_surface.jpg')` }}
      />

      {/* Atmospheric depth gradients over terrain */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#080D16]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070B]/80 via-transparent to-[#05070B]/80" />

      {/* SVG Canvas for Celestial Crescent, Ice Chasms, Headlights & Rover */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Headlight illumination beam gradient */}
          <linearGradient id="roverHeadlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="25%" stopColor="#fef08a" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#F5A623" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </linearGradient>

          {/* Subsurface Ice Crevasse Glow */}
          <linearGradient id="chasmIceGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#35C6F4" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#0284c7" stopOpacity="0.8" />
            <stop offset="85%" stopColor="#082f49" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0" />
          </linearGradient>

          {/* Distant Alien Portal Aperture Glow */}
          <radialGradient id="surfacePortalAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="20%" stopColor="#35C6F4" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#0284c7" stopOpacity="0.5" />
            <stop offset="85%" stopColor="#F5A623" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0" />
          </radialGradient>

          {/* Crescent Planet Mask */}
          <mask id="crescentMask">
            <rect width="1920" height="1080" fill="white" />
            <circle cx="700" cy="270" r="160" fill="black" />
          </mask>
        </defs>

        {/* Ambient starry backdrop */}
        {Array.from({ length: 120 }).map((_, i) => (
          <circle
            key={i}
            cx={(i * 157.3) % 1920}
            cy={(i * 73.1) % 650}
            r={((i % 4) + 1) * 0.65}
            fill="#ffffff"
            opacity={((i % 5) + 3) / 10}
          />
        ))}

        {/* ======================================================== */}
        {/* CELESTIAL CRESCENT IN THE SKY (Jupiter/Io looming above) */}
        {/* ======================================================== */}
        <g transform="translate(680, 260)">
          {/* Atmosphere rim halo */}
          <circle cx="0" cy="0" r="150" fill="#35C6F4" opacity="0.08" />
          {/* Crescent body */}
          <circle cx="0" cy="0" r="140" fill="#cbd5e1" mask="url(#crescentMask)" opacity="0.85" />
          <circle cx="0" cy="0" r="140" fill="none" stroke="#35C6F4" strokeWidth="1" opacity="0.5" />
        </g>

        {/* Jagged Ice Ridges and Crags on Horizon */}
        <polygon points="1000,620 1140,460 1260,620" fill="#080D16" opacity="0.9" />
        <polygon points="1180,640 1340,420 1480,640" fill="#101925" />
        <polygon points="1400,640 1560,480 1720,640" fill="#080D16" opacity="0.95" />

        {/* ======================================================== */}
        {/* DISTANT COLOSSAL ANOMALY PORTAL RING (Far Right Horizon) */}
        {/* ======================================================== */}
        <g transform="translate(1480, 480)">
          {/* Volumetric energy aura */}
          <circle cx="0" cy="0" r="150" fill="url(#surfacePortalAura)" />

          {/* Heavy Precursor Torus Outer Ring */}
          <ellipse
            cx="0"
            cy="0"
            rx="110"
            ry="130"
            fill="none"
            stroke="#162232"
            strokeWidth="24"
          />
          <ellipse
            cx="0"
            cy="0"
            rx="110"
            ry="130"
            fill="none"
            stroke="#334155"
            strokeWidth="4"
          />

          {/* Concentric Nested Rings with Segmented Markings */}
          <ellipse
            cx="0"
            cy="0"
            rx="88"
            ry="105"
            fill="none"
            stroke="#F5A623"
            strokeWidth="3.5"
            strokeDasharray="24 12"
            opacity="0.85"
          />
          <ellipse
            cx="0"
            cy="0"
            rx="66"
            ry="80"
            fill="none"
            stroke="#35C6F4"
            strokeWidth="3"
            strokeDasharray="40 16"
            opacity="0.9"
          />

          {/* Aperture Core Glowing Threshold */}
          <circle cx="0" cy="0" r="32" fill="#ffffff" />
          <circle cx="0" cy="0" r="35" fill="none" stroke="#35C6F4" strokeWidth="3" className="animate-pulse" />

          {/* Target HUD Bounding Box */}
          <g>
            {/* Corner brackets */}
            <path d="M -140 -150 L -110 -150 M -140 -150 L -140 -120" stroke="#35C6F4" strokeWidth="2" fill="none" />
            <path d="M 140 -150 L 110 -150 M 140 -150 L 140 -120" stroke="#35C6F4" strokeWidth="2" fill="none" />
            <path d="M -140 150 L -110 150 M -140 150 L -140 120" stroke="#35C6F4" strokeWidth="2" fill="none" />
            <path d="M 140 150 L 110 150 M 140 150 L 140 120" stroke="#35C6F4" strokeWidth="2" fill="none" />

            {/* Target Telemetry Label */}
            <text
              x="-135"
              y="-165"
              fill="#35C6F4"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="11"
              letterSpacing="2"
            >
              [ TARGET // ANOMALOUS TOROIDAL STRUCTURE ]
            </text>
            <text
              x="-135"
              y="180"
              fill="#F5A623"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="10"
              letterSpacing="1"
            >
              DIST: 1.84 KM · HARMONIC FLUX: +340%
            </text>
          </g>
        </g>

        {/* ======================================================== */}
        {/* GLOWING SUBSURFACE ICE CHASMS & FRACTURES                */}
        {/* ======================================================== */}
        <g>
          {/* Main glowing cyan fissure across ice */}
          <path
            d="M 520 860 Q 840 760 1120 820 T 1760 740"
            stroke="url(#chasmIceGlow)"
            strokeWidth="12"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M 520 860 Q 840 760 1120 820 T 1760 740"
            stroke="#ffffff"
            strokeWidth="2.5"
            fill="none"
            opacity="0.9"
          />

          {/* Subsidiary thermal ice crack networks */}
          <path d="M 760 810 L 890 920 M 1120 820 L 1240 960" stroke="#35C6F4" strokeWidth="1.5" opacity="0.6" />
          <path d="M 1320 780 L 1460 880" stroke="#35C6F4" strokeWidth="1.2" opacity="0.5" />
        </g>

        {/* ======================================================== */}
        {/* EXPEDITION ROVER (Foreground 6-wheeled vehicle)          */}
        {/* ======================================================== */}
        <g transform="translate(680, 820) scale(1.4)">
          {/* High-Intensity Headlight Cones Casting Across Ice */}
          {/* Upper Headlight Beam */}
          <polygon
            points="65,-14 620,-90 660,70 65,4"
            fill="url(#roverHeadlightBeam)"
          />
          {/* Ground reflection glow */}
          <ellipse cx="380" cy="20" rx="220" ry="25" fill="#fef08a" opacity="0.15" />

          {/* Rover Wheels (6 Heavy all-terrain alloy treads) */}
          {/* Wheel 1 (Rear) */}
          <ellipse cx="-52" cy="28" rx="16" ry="20" fill="#05070B" stroke="#475569" strokeWidth="3.5" />
          <circle cx="-52" cy="28" r="7" fill="#162232" stroke="#6D7A8D" strokeWidth="1.5" />

          {/* Wheel 2 (Center) */}
          <ellipse cx="0" cy="28" rx="16" ry="20" fill="#05070B" stroke="#475569" strokeWidth="3.5" />
          <circle cx="0" cy="28" r="7" fill="#162232" stroke="#6D7A8D" strokeWidth="1.5" />

          {/* Wheel 3 (Front) */}
          <ellipse cx="52" cy="28" rx="16" ry="20" fill="#05070B" stroke="#475569" strokeWidth="3.5" />
          <circle cx="52" cy="28" r="7" fill="#162232" stroke="#6D7A8D" strokeWidth="1.5" />

          {/* Suspension Wishbone Links */}
          <line x1="-52" y1="16" x2="-26" y2="2" stroke="#64748b" strokeWidth="4" />
          <line x1="0" y1="16" x2="0" y2="2" stroke="#64748b" strokeWidth="4" />
          <line x1="52" y1="16" x2="26" y2="2" stroke="#64748b" strokeWidth="4" />

          {/* Armored Rover Chassis Hull */}
          <polygon
            points="-68,-22 42,-22 66,-6 66,16 -68,16"
            fill="#101925"
            stroke="#475569"
            strokeWidth="2.5"
          />

          {/* Upper Cabin Compartment */}
          <polygon
            points="-56,-42 22,-42 46,-22 -56,-22"
            fill="#162232"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Cyan Cockpit Visor / Optical Sensor Array */}
          <polygon
            points="14,-40 38,-40 44,-24 14,-24"
            fill="#35C6F4"
            stroke="#38bdf8"
            strokeWidth="1"
            opacity="0.85"
          />

          {/* Equipment Compartments & Gold MLI Foil Packs */}
          <rect x="-48" y="-36" width="24" height="12" rx="2" fill="#D88A18" stroke="#F5A623" strokeWidth="1" />
          <rect x="-18" y="-36" width="26" height="12" rx="2" fill="#080D16" stroke="#475569" strokeWidth="1" />

          {/* Roof-Mounted Scientific Sensor Mast & Antenna */}
          <rect x="-38" y="-48" width="32" height="6" fill="#334155" />
          <line x1="-22" y1="-48" x2="-22" y2="-72" stroke="#cbd5e1" strokeWidth="2.5" />
          <ellipse cx="-22" cy="-74" rx="8" ry="4" fill="#162232" stroke="#35C6F4" strokeWidth="1.5" />
          <circle cx="-22" cy="-74" r="2.5" fill="#F5A623" />

          {/* Front High-Output LED Headlights */}
          <circle cx="66" cy="-4" r="5" fill="#ffffff" />
          <circle cx="66" cy="8" r="5" fill="#ffffff" />
          <circle cx="66" cy="-4" r="8" fill="#fef08a" opacity="0.6" />
          <circle cx="66" cy="8" r="8" fill="#fef08a" opacity="0.6" />
        </g>

        {/* Viewport Telemetry Hud Footer */}
        <g opacity="0.6">
          <text
            x="48"
            y="1040"
            fill="#6D7A8D"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="11"
            letterSpacing="2"
          >
            ROVER NAVIGATION // LAT 79°14'22"S · LON 142°08'49"W · ICE TEMPERATURE -162°C
          </text>
        </g>
      </svg>
    </div>
  );
};
