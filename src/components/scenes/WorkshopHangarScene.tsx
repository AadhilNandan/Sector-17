import React from 'react';
import type { SpacecraftConfig, ComponentCategory } from '../../types/game';

export type WorkshopViewMode = '3/4' | 'front' | 'side' | 'rear';

export interface WorkshopHangarSceneProps {
  spacecraft: SpacecraftConfig;
  viewMode?: WorkshopViewMode;
  selectedCategory?: ComponentCategory;
}

export const WorkshopHangarScene: React.FC<WorkshopHangarSceneProps> = ({
  spacecraft,
  viewMode = '3/4',
  selectedCategory = 'structure',
}) => {
  const isSolar = spacecraft.parts.power?.id === 'power-solar-wings';
  const isIon = spacecraft.parts.propulsion?.id === 'prop-ion-gridded';
  const isNuclear = spacecraft.parts.propulsion?.id === 'prop-nuclear-thermal';
  const isRadar = spacecraft.parts.instruments?.id === 'inst-subsurface-radar';
  const isOpticalComm = spacecraft.parts.communication?.id === 'comm-ka-band-optical';

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#07090C] select-none">
      {/* Real NASA Cleanroom / Assembly Bay Background Layer */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-20 mix-blend-luminosity scale-105"
        style={{ backgroundImage: `url('/assets/images/hangar_craft.jpg')` }}
      />
      <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-[#07090C] via-[#07090C]/85 to-[#0D1116]/90" />

      {/* Engineering Drafting Grid Background */}
      <div className="absolute inset-0 w-full h-full tech-grid opacity-30 pointer-events-none" />

      {/* Main Technical Viewport SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1280 800"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hangarFloorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#151B22" />
            <stop offset="40%" stopColor="#0D1116" />
            <stop offset="100%" stopColor="#07090C" />
          </linearGradient>

          <linearGradient id="technicalSpotlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7FB7D4" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#07090C" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="solarCellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="45%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id="busTitaniumGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E6E2D6" />
            <stop offset="35%" stopColor="#A9B0B5" />
            <stop offset="70%" stopColor="#4A5568" />
            <stop offset="100%" stopColor="#2B3642" />
          </linearGradient>

          <linearGradient id="goldMLIGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5D061" />
            <stop offset="35%" stopColor="#E0A43A" />
            <stop offset="85%" stopColor="#B5733C" />
            <stop offset="100%" stopColor="#5E3612" />
          </linearGradient>

          <pattern id="caliperPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2B3642" strokeWidth="0.5" strokeOpacity="0.5" />
          </pattern>
        </defs>

        {/* Structural Gantry Overhead Crane */}
        <rect x="0" y="24" width="100%" height="28" fill="#0D1116" stroke="#2B3642" strokeWidth="1" />
        <rect x="540" y="20" width="200" height="36" fill="#151B22" stroke="#7FB7D4" strokeWidth="1" rx="2" />
        <text
          x="640"
          y="42"
          textAnchor="middle"
          fill="#7FB7D4"
          fontSize="11"
          fontFamily="monospace"
          fontWeight="600"
          letterSpacing="0.1em"
        >
          GANTRY HOIST · SECTOR 17 BAY-2
        </text>

        {/* Technical Conical Downlight */}
        <polygon points="560,56 420,540 700,540" fill="url(#technicalSpotlight)" />
        <polygon points="720,56 580,540 860,540" fill="url(#technicalSpotlight)" />

        {/* Rigging Cables */}
        <line x1="640" y1="56" x2="640" y2="180" stroke="#6B757D" strokeWidth="1.5" strokeDasharray="4 2" />
        <path d="M 632 180 C 632 195, 648 195, 648 180" fill="none" stroke="#E0A43A" strokeWidth="3" />

        {/* Integration Staging Floor & Turntable */}
        <polygon points="0,540 1280,540 1280,800 0,800" fill="url(#hangarFloorGrad)" />
        <line x1="0" y1="540" x2="1280" y2="540" stroke="#2B3642" strokeWidth="1.5" />

        {/* Ground Reference Scale / Datum Markings */}
        <line x1="140" y1="540" x2="140" y2="760" stroke="#2B3642" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="1140" y1="540" x2="1140" y2="760" stroke="#2B3642" strokeWidth="1" strokeDasharray="2 4" />
        <text x="148" y="555" fill="#6B757D" fontSize="10" fontFamily="monospace">STATION -5.00m</text>
        <text x="1148" y="555" fill="#6B757D" fontSize="10" fontFamily="monospace">STATION +5.00m</text>

        {/* Turntable Pedestal */}
        <g transform="translate(640, 540)">
          <ellipse cx="0" cy="0" rx="160" ry="24" fill="#0D1116" stroke="#2B3642" strokeWidth="2" />
          <ellipse cx="0" cy="-6" rx="130" ry="18" fill="#151B22" stroke="#7FB7D4" strokeWidth="1" strokeDasharray="4 4" />
          <rect x="-35" y="-95" width="70" height="90" fill="#0D1116" stroke="#2B3642" strokeWidth="1.5" />
          <circle cx="0" cy="-95" r="28" fill="#151B22" stroke="#7FB7D4" strokeWidth="1.5" />
          <text x="0" y="20" textAnchor="middle" fill="#6B757D" fontSize="9" fontFamily="monospace" letterSpacing="0.15em">
            ROTARY PEDESTAL // 360° AZIMUTH
          </text>
        </g>

        {/* ================================================================= */}
        {/* DRAFTING VIEWS (3/4, FRONT, SIDE, REAR)                           */}
        {/* ================================================================= */}
        <g transform="translate(640, 380)">
          {/* VIEW: 3/4 (PERSPECTIVE / ISOMETRIC DEFAULT) */}
          {viewMode === '3/4' && (
            <g id="craft-view-34">
              {/* Power Subsystem Left (Solar Wings or RTG) */}
              {isSolar ? (
                <g
                  transform="translate(-190, -25)"
                  className={selectedCategory === 'power' ? 'drop-shadow-[0_0_12px_rgba(127,183,212,0.6)]' : ''}
                >
                  <line x1="0" y1="25" x2="90" y2="25" stroke="#A9B0B5" strokeWidth="6" />
                  <rect x="-150" y="-35" width="150" height="120" rx="2" fill="url(#solarCellGrad)" stroke="#7FB7D4" strokeWidth="1.5" />
                  <line x1="-112" y1="-35" x2="-112" y2="85" stroke="#2B3642" strokeWidth="1" />
                  <line x1="-75" y1="-35" x2="-75" y2="85" stroke="#2B3642" strokeWidth="1" />
                  <line x1="-38" y1="-35" x2="-38" y2="85" stroke="#2B3642" strokeWidth="1" />
                  <line x1="-150" y1="5" x2="0" y2="5" stroke="#2B3642" strokeWidth="1" />
                  <line x1="-150" y1="45" x2="0" y2="45" stroke="#2B3642" strokeWidth="1" />
                </g>
              ) : (
                <g
                  transform="translate(-150, 0)"
                  className={selectedCategory === 'power' ? 'drop-shadow-[0_0_12px_rgba(127,183,212,0.6)]' : ''}
                >
                  <line x1="0" y1="0" x2="60" y2="0" stroke="#A9B0B5" strokeWidth="7" />
                  <rect x="-50" y="-28" width="50" height="56" rx="2" fill="#1C242D" stroke="#E0A43A" strokeWidth="2" />
                  <circle cx="-25" cy="0" r="12" fill="#E0A43A" opacity="0.85" />
                  <text x="-25" y="4" textAnchor="middle" fill="#07090C" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    RTG
                  </text>
                </g>
              )}

              {/* Power Subsystem Right (Solar Wings or RTG) */}
              {isSolar ? (
                <g
                  transform="translate(190, -25)"
                  className={selectedCategory === 'power' ? 'drop-shadow-[0_0_12px_rgba(127,183,212,0.6)]' : ''}
                >
                  <line x1="-90" y1="25" x2="0" y2="25" stroke="#A9B0B5" strokeWidth="6" />
                  <rect x="0" y="-35" width="150" height="120" rx="2" fill="url(#solarCellGrad)" stroke="#7FB7D4" strokeWidth="1.5" />
                  <line x1="38" y1="-35" x2="38" y2="85" stroke="#2B3642" strokeWidth="1" />
                  <line x1="75" y1="-35" x2="75" y2="85" stroke="#2B3642" strokeWidth="1" />
                  <line x1="112" y1="-35" x2="112" y2="85" stroke="#2B3642" strokeWidth="1" />
                  <line x1="0" y1="5" x2="150" y2="5" stroke="#2B3642" strokeWidth="1" />
                  <line x1="0" y1="45" x2="150" y2="45" stroke="#2B3642" strokeWidth="1" />
                </g>
              ) : (
                <g
                  transform="translate(150, 0)"
                  className={selectedCategory === 'power' ? 'drop-shadow-[0_0_12px_rgba(127,183,212,0.6)]' : ''}
                >
                  <line x1="-60" y1="0" x2="0" y2="0" stroke="#A9B0B5" strokeWidth="7" />
                  <rect x="0" y="-28" width="50" height="56" rx="2" fill="#1C242D" stroke="#E0A43A" strokeWidth="2" />
                  <circle cx="25" cy="0" r="12" fill="#E0A43A" opacity="0.85" />
                  <text x="25" y="4" textAnchor="middle" fill="#07090C" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    RTG
                  </text>
                </g>
              )}

              {/* Central Hexagonal Core Chassis (Structure) */}
              <g className={selectedCategory === 'structure' ? 'drop-shadow-[0_0_14px_rgba(127,183,212,0.7)]' : ''}>
                <rect
                  x="-100"
                  y="-60"
                  width="200"
                  height="120"
                  rx="2"
                  fill="url(#busTitaniumGrad)"
                  stroke="#2B3642"
                  strokeWidth="2"
                />
                {/* Thermal Multi-Layer Insulation (MLI) blankets */}
                <rect
                  x="-80"
                  y="-40"
                  width="65"
                  height="80"
                  fill="url(#goldMLIGrad)"
                  stroke="#2B3642"
                  strokeWidth="1"
                  className={selectedCategory === 'thermal' ? 'stroke-[#7FB7D4] stroke-2' : ''}
                />
                <rect
                  x="15"
                  y="-40"
                  width="65"
                  height="80"
                  fill="url(#goldMLIGrad)"
                  stroke="#2B3642"
                  strokeWidth="1"
                  className={selectedCategory === 'thermal' ? 'stroke-[#7FB7D4] stroke-2' : ''}
                />
                {/* Equipment Bay Ports & Indicators */}
                <rect x="-12" y="-35" width="24" height="70" fill="#0D1116" stroke="#2B3642" strokeWidth="1" rx="1" />
                <circle cx="0" cy="-22" r="3" fill="#6FAE7C" />
                <circle cx="0" cy="-8" r="3" fill="#7FB7D4" />
                <circle cx="0" cy="6" r="3" fill="#E0A43A" />
                <circle cx="0" cy="20" r="3" fill="#6FAE7C" />
              </g>

              {/* Mission Designation Decal */}
              <text
                x="0"
                y="50"
                textAnchor="middle"
                fill="#07090C"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="700"
                letterSpacing="0.1em"
              >
                AETHON · EXP-V
              </text>

              {/* Rear Propulsion Engine (Left of bus) */}
              <g
                transform="translate(-100, 0)"
                className={selectedCategory === 'propulsion' ? 'drop-shadow-[0_0_14px_rgba(127,183,212,0.8)]' : ''}
              >
                {isIon ? (
                  <g>
                    <polygon points="0,-26 -44,-38 -44,38 0,26" fill="#1C242D" stroke="#2B3642" strokeWidth="2" />
                    <ellipse cx="-44" cy="0" rx="8" ry="36" fill="#0F172A" stroke="#7FB7D4" strokeWidth="1.5" />
                    <ellipse cx="-44" cy="0" rx="5" ry="26" fill="#7FB7D4" opacity="0.9" />
                  </g>
                ) : isNuclear ? (
                  <g>
                    <polygon points="0,-32 -54,-48 -54,48 0,32" fill="#151B22" stroke="#2B3642" strokeWidth="2" />
                    <ellipse cx="-54" cy="0" rx="10" ry="46" fill="#6FAE7C" opacity="0.8" />
                  </g>
                ) : (
                  <g>
                    <polygon points="0,-30 -48,-46 -48,46 0,30" fill="#2B3642" stroke="#A9B0B5" strokeWidth="2" />
                    <ellipse cx="-48" cy="0" rx="10" ry="44" fill="#B5733C" opacity="0.85" />
                  </g>
                )}
              </g>

              {/* Forward Science Instruments Deck (Right of bus) */}
              <g
                transform="translate(100, 0)"
                className={selectedCategory === 'instruments' ? 'drop-shadow-[0_0_14px_rgba(127,183,212,0.8)]' : ''}
              >
                <polygon points="0,-40 38,-28 38,28 0,40" fill="#E6E2D6" stroke="#2B3642" strokeWidth="2" />
                {isRadar ? (
                  <g transform="translate(38, 0)">
                    <line x1="0" y1="0" x2="65" y2="0" stroke="#E0A43A" strokeWidth="4" />
                    <path d="M 55 -38 Q 30 0 55 38" fill="none" stroke="#E0A43A" strokeWidth="3.5" />
                    <circle cx="42" cy="0" r="4.5" fill="#E6E2D6" />
                  </g>
                ) : (
                  <g transform="translate(38, 0)">
                    <rect x="0" y="-20" width="50" height="40" rx="2" fill="#1C242D" stroke="#7FB7D4" strokeWidth="2" />
                    <circle cx="25" cy="0" r="12" fill="#7FB7D4" opacity="0.8" />
                  </g>
                )}
              </g>

              {/* Top Communications Mast (High Gain Dish or Optical) */}
              <g
                transform="translate(0, -60)"
                className={selectedCategory === 'communication' ? 'drop-shadow-[0_0_14px_rgba(127,183,212,0.8)]' : ''}
              >
                <line x1="0" y1="0" x2="0" y2="-45" stroke="#A9B0B5" strokeWidth="3" />
                {isOpticalComm ? (
                  <g transform="translate(0, -45)">
                    <rect x="-12" y="-20" width="24" height="20" rx="2" fill="#1C242D" stroke="#7FB7D4" strokeWidth="1.5" />
                    <circle cx="0" cy="-10" r="6" fill="#7FB7D4" />
                  </g>
                ) : (
                  <g transform="translate(0, -45)">
                    <path d="M -45 -15 Q 0 10 45 -15" fill="none" stroke="#E6E2D6" strokeWidth="4" />
                    <line x1="0" y1="0" x2="0" y2="-12" stroke="#E0A43A" strokeWidth="2" />
                    <circle cx="0" cy="-12" r="3" fill="#E0A43A" />
                  </g>
                )}
              </g>
            </g>
          )}

          {/* VIEW: FRONT (ORTHOGONAL NOSE VIEW) */}
          {viewMode === 'front' && (
            <g id="craft-view-front">
              {/* Wings Extension Left & Right */}
              {isSolar && (
                <>
                  <rect x="-280" y="-12" width="200" height="24" rx="2" fill="url(#solarCellGrad)" stroke="#7FB7D4" strokeWidth="1.5" />
                  <rect x="80" y="-12" width="200" height="24" rx="2" fill="url(#solarCellGrad)" stroke="#7FB7D4" strokeWidth="1.5" />
                </>
              )}
              {/* Bus Cross Section */}
              <circle cx="0" cy="0" r="80" fill="url(#busTitaniumGrad)" stroke="#2B3642" strokeWidth="2" />
              {/* Instrument Array Central Deck */}
              <circle cx="0" cy="0" r="50" fill="#151B22" stroke="#7FB7D4" strokeWidth="1.5" />
              <circle cx="0" cy="-15" r="16" fill="#0D1116" stroke="#E0A43A" strokeWidth="2" />
              <text x="0" y="-11" textAnchor="middle" fill="#E0A43A" fontSize="9" fontFamily="monospace">CAM</text>
              <rect x="-20" y="10" width="40" height="15" fill="#1C242D" stroke="#6FAE7C" strokeWidth="1" />
              <text x="0" y="21" textAnchor="middle" fill="#6FAE7C" fontSize="8" fontFamily="monospace">SPECTRO</text>
            </g>
          )}

          {/* VIEW: SIDE (LONGITUDINAL PROFILE) */}
          {viewMode === 'side' && (
            <g id="craft-view-side">
              {/* Aft Engine Nozzle (Left) */}
              <polygon points="-120,-35 -170,-50 -170,50 -120,35" fill="#1C242D" stroke="#2B3642" strokeWidth="2" />
              {/* Main Core Body (Center) */}
              <rect x="-120" y="-55" width="220" height="110" rx="2" fill="url(#busTitaniumGrad)" stroke="#2B3642" strokeWidth="2" />
              {/* Top Mounted Antenna Dish */}
              <line x1="-20" y1="-55" x2="-20" y2="-105" stroke="#A9B0B5" strokeWidth="3" />
              <path d="M -60 -115 Q -20 -95 20 -115" fill="none" stroke="#E6E2D6" strokeWidth="3" />
              {/* Forward Sensor Pod (Right) */}
              <polygon points="100,-40 160,-20 160,20 100,40" fill="#E6E2D6" stroke="#2B3642" strokeWidth="2" />
            </g>
          )}

          {/* VIEW: REAR (THRUSTER BELL PERSPECTIVE) */}
          {viewMode === 'rear' && (
            <g id="craft-view-rear">
              {/* Structural Adapter Ring */}
              <circle cx="0" cy="0" r="90" fill="#0D1116" stroke="#2B3642" strokeWidth="3" />
              {/* Primary Engine Bell Nozzle */}
              <circle cx="0" cy="0" r="55" fill="#1C242D" stroke="#7FB7D4" strokeWidth="2" />
              <circle cx="0" cy="0" r="30" fill="#07090C" stroke="#E0A43A" strokeWidth="2" />
              {/* RCS Quad Pods */}
              <rect x="-85" y="-10" width="15" height="20" fill="#2B3642" />
              <rect x="70" y="-10" width="15" height="20" fill="#2B3642" />
              <rect x="-10" y="-85" width="20" height="15" fill="#2B3642" />
              <rect x="-10" y="70" width="20" height="15" fill="#2B3642" />
              <text x="0" y="5" textAnchor="middle" fill="#7FB7D4" fontSize="11" fontFamily="monospace" fontWeight="bold">
                NOZZLE EXIT
              </text>
            </g>
          )}

          {/* Subsystem Callout Calliper / Leader Indicator for Active Selection */}
          <g transform="translate(0, -110)">
            <rect x="-100" y="-24" width="200" height="22" rx="2" fill="#0D1116" stroke="#7FB7D4" strokeWidth="1" />
            <text
              x="0"
              y="-10"
              textAnchor="middle"
              fill="#7FB7D4"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="600"
              letterSpacing="0.1em"
            >
              ACTIVE: {selectedCategory.toUpperCase()} SUB-ASSEMBLY
            </text>
            <line x1="0" y1="-2" x2="0" y2="28" stroke="#7FB7D4" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="0" cy="28" r="3" fill="#7FB7D4" />
          </g>
        </g>
      </svg>
    </div>
  );
};
