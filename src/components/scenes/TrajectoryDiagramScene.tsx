import React, { useEffect, useState } from 'react';

export interface TrajectoryDiagramSceneProps {
  isSimulating: boolean;
}

export const TrajectoryDiagramScene: React.FC<TrajectoryDiagramSceneProps> = ({ isSimulating }) => {
  const [probeProgress, setProbeProgress] = useState(0.48);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setProbeProgress((prev) => (prev >= 0.96 ? 0.04 : prev + 0.012));
    }, 50);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Cubic Bezier interpolation: Earth (260, 520) -> Europa (940, 240)
  const t = probeProgress;
  const p0 = { x: 260, y: 520 };
  const p1 = { x: 440, y: 520 };
  const p2 = { x: 680, y: 260 };
  const p3 = { x: 940, y: 240 };

  const cx =
    Math.pow(1 - t, 3) * p0.x +
    3 * Math.pow(1 - t, 2) * t * p1.x +
    3 * (1 - t) * Math.pow(t, 2) * p2.x +
    Math.pow(t, 3) * p3.x;

  const cy =
    Math.pow(1 - t, 3) * p0.y +
    3 * Math.pow(1 - t, 2) * t * p1.y +
    3 * (1 - t) * Math.pow(t, 2) * p2.y +
    Math.pow(t, 3) * p3.y;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B]">
      {/* Deep Space Background with Starfield */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-20 mix-blend-screen"
        style={{ backgroundImage: `url('/assets/images/deep_space.jpg')` }}
      />
      <div className="absolute inset-0 w-full h-full bg-radial from-transparent via-[#05070B]/80 to-[#05070B] pointer-events-none" />

      {/* Trajectory Arcs, Maneuver Checkpoints & Orbital Guides */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hohmannTrajectoryGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#35C6F4" />
            <stop offset="60%" stopColor="#35C6F4" />
            <stop offset="100%" stopColor="#F5A623" />
          </linearGradient>

          <pattern id="trajectoryGridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="60" y2="0" stroke="rgba(53, 198, 244, 0.04)" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="60" stroke="rgba(53, 198, 244, 0.04)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#trajectoryGridPattern)" />

        {/* Orbital Ellipse Guides (Earth Orbit & Jovian Orbit) */}
        <ellipse
          cx="150"
          cy="660"
          rx="340"
          ry="220"
          fill="none"
          stroke="#35C6F4"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.3"
        />

        <ellipse
          cx="1100"
          cy="120"
          rx="460"
          ry="320"
          fill="none"
          stroke="#F5A623"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.25"
        />

        {/* ======================================================== */}
        {/* HOHMANN TRANSFER TRAJECTORY ARC                          */}
        {/* ======================================================== */}
        {/* Ambient trajectory glow */}
        <path
          d="M 260 520 C 440 520, 680 260, 940 240"
          fill="none"
          stroke="#35C6F4"
          strokeWidth="7"
          opacity="0.2"
        />
        {/* Core sharp line */}
        <path
          d="M 260 520 C 440 520, 680 260, 940 240"
          fill="none"
          stroke="url(#hohmannTrajectoryGrad)"
          strokeWidth="2.5"
        />

        {/* Maneuver Checkpoint Nodes */}
        {/* Node 1: TJI Burn (Earth Departure) */}
        <g transform="translate(330, 514)">
          <circle cx="0" cy="0" r="9" fill="#05070B" stroke="#35C6F4" strokeWidth="2" />
          <circle cx="0" cy="0" r="3.5" fill="#35C6F4" />
          <text x="0" y="-15" textAnchor="middle" fill="#A5B1C2" fontSize="10" fontFamily="monospace" fontWeight="600">
            TJI BURN
          </text>
        </g>

        {/* Node 2: Mid-Course Correction MCC-1 */}
        <g transform="translate(480, 475)">
          <circle cx="0" cy="0" r="9" fill="#05070B" stroke="#35C6F4" strokeWidth="2" />
          <circle cx="0" cy="0" r="3.5" fill="#35C6F4" />
          <text x="0" y="-15" textAnchor="middle" fill="#A5B1C2" fontSize="10" fontFamily="monospace" fontWeight="600">
            MCC-1
          </text>
        </g>

        {/* Node 3: Jovian Gravity Assist Flyby */}
        <g transform="translate(680, 335)">
          <circle cx="0" cy="0" r="10" fill="#05070B" stroke="#35C6F4" strokeWidth="2" />
          <circle cx="0" cy="0" r="4" fill="#35C6F4" />
          <text x="0" y="-16" textAnchor="middle" fill="#A5B1C2" fontSize="10" fontFamily="monospace" fontWeight="600">
            JOVIAN FLYBY
          </text>
        </g>

        {/* Node 4: Europa Orbital Insertion EOI */}
        <g transform="translate(880, 245)">
          <circle cx="0" cy="0" r="9" fill="#05070B" stroke="#F5A623" strokeWidth="2" />
          <circle cx="0" cy="0" r="3.5" fill="#F5A623" />
          <text x="0" y="-15" textAnchor="middle" fill="#F5A623" fontSize="10" fontFamily="monospace" fontWeight="600">
            EOI INSERTION
          </text>
        </g>

        {/* Animated Traveling Spacecraft Marker */}
        <g transform={`translate(${cx}, ${cy})`}>
          <circle cx="0" cy="0" r="14" fill="#35C6F4" opacity="0.3" className="animate-ping" />
          <polygon points="0,-8 10,8 0,4 -10,8" fill="#F1F5FA" stroke="#35C6F4" strokeWidth="1.5" />
          <line x1="0" y1="6" x2="-8" y2="16" stroke="#35C6F4" strokeWidth="2" strokeDasharray="2 2" />
        </g>
      </svg>

      {/* ======================================================== */}
      {/* REAL PHOTOGRAPHIC PLANET 1: EARTH (Lower-Left)           */}
      {/* ======================================================== */}
      <div
        className="absolute z-10 flex flex-col items-center pointer-events-none"
        style={{ left: '200px', top: '460px' }}
      >
        <div className="relative w-28 h-28 rounded-full overflow-hidden shadow-[0_0_40px_rgba(53,198,244,0.4)] border border-[#35C6F4]/40">
          <img
            src="/assets/images/earth.jpg"
            alt="Earth NASA Apollo 17 Blue Marble"
            className="w-full h-full object-cover object-center"
          />
          {/* Atmosphere blue scattering limb */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_40%_40%,transparent_40%,rgba(5,7,11,0.5)_75%,rgba(5,7,11,0.98)_98%)]" />
        </div>
        <span className="mt-2.5 font-display text-sm font-bold tracking-widest text-[#F1F5FA] uppercase drop-shadow-md">
          Earth
        </span>
      </div>

      {/* ======================================================== */}
      {/* REAL PHOTOGRAPHIC PLANET 2: EUROPA (Upper-Right)         */}
      {/* ======================================================== */}
      <div
        className="absolute z-10 flex flex-col items-center pointer-events-none"
        style={{ left: '880px', top: '180px' }}
      >
        <div className="relative w-32 h-32 rounded-full overflow-hidden shadow-[0_0_40px_rgba(53,198,244,0.35)] border border-white/20">
          <img
            src="/assets/images/europa.jpg"
            alt="Europa NASA Galileo View"
            className="w-full h-full object-cover object-center"
          />
          {/* Day/night spherical terminator */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,transparent_35%,rgba(5,7,11,0.4)_70%,rgba(5,7,11,0.98)_98%)]" />
        </div>
        <span className="mt-2.5 font-display text-sm font-bold tracking-widest text-[#F1F5FA] uppercase drop-shadow-md">
          Europa
        </span>
      </div>
    </div>
  );
};
