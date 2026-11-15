import React from 'react';
import type { SimulationSnapshot } from '../../../runtime/types';

export interface PropulsionNavigationPanelProps {
  snap: SimulationSnapshot;
}

const SegmentedBar: React.FC<{
  value: number;
  max: number;
  min?: number;
  segments?: number;
  variant?: 'cyan' | 'amber' | 'green';
}> = ({ value, max, min = 0, segments = 12, variant = 'cyan' }) => {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const activeCount = Math.round(norm * segments);
  const activeColor =
    variant === 'amber' ? 'bg-[#F5A623]' : variant === 'green' ? 'bg-[#31C48D]' : 'bg-[#35C6F4]';

  return (
    <div className="flex gap-1 items-center h-2 w-full max-w-[140px] bg-black/60 p-0.5 rounded border border-white/10">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-full rounded-[1px] transition-all duration-300 ${
            i < activeCount ? activeColor : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
};

export const PropulsionNavigationPanel: React.FC<PropulsionNavigationPanelProps> = ({ snap }) => {
  // Navigation & orbital metrics (nominal Jovian tour/Europa survey values as in reference)
  const isJovianTour =
    snap.navigation?.centralBody === 'EUROPA' || snap.navigation?.centralBody === 'JUPITER';
  const apoapsisKm = isJovianTour && snap.navigation?.currentOrbit?.apoapsisRadiusMetres
    ? Math.round(snap.navigation.currentOrbit.apoapsisRadiusMetres / 1000)
    : 14800;
  const periapsisKm = isJovianTour && snap.navigation?.currentOrbit?.periapsisRadiusMetres
    ? Math.round(snap.navigation.currentOrbit.periapsisRadiusMetres / 1000)
    : 120;
  const currentVelocityKmS = isJovianTour && snap.navigation?.currentOrbit?.currentVelocityMps
    ? snap.navigation.currentOrbit.currentVelocityMps / 1000
    : 1.84;

  // Propulsion metrics
  const thrustN = (snap.flightState as string) === 'MANEUVER_EXECUTION' ? 440.0 : 0.0;
  const rcsFuelPercent = 82;
  const propRemainingKg = snap.propellantRemainingKg ?? 2450.0;
  const isEngineFiring = thrustN > 0;

  return (
    <aside
      className="w-full h-full bg-[#060A10]/90 backdrop-blur-md border-l border-white/10 p-3.5 flex flex-col gap-4 font-mono select-none overflow-y-auto text-xs"
      aria-label="Propulsion and Navigation Telemetry Panel"
    >
      {/* Panel Header */}
      <div className="border-b border-white/10 pb-2">
        <h2 className="text-[#A5B1C2] text-[11px] font-bold tracking-widest uppercase">
          PROPULSION &amp; NAVIGATION
        </h2>
        <span className="text-[9px] text-[#A5B1C2]/60 uppercase">
          GN&amp;C // MPS Flight Dynamics
        </span>
      </div>

      {/* 1. APOAPSIS */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div>
          <span className="text-[#A5B1C2] text-[10px] block uppercase">APOAPSIS:</span>
          <span className="text-white font-bold text-base tracking-wider">
            {apoapsisKm.toLocaleString()} km
          </span>
        </div>
        {/* Orbital Sphere SVG Icon */}
        <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#35C6F4]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8M3.6 15h16.8" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
          </svg>
        </div>
      </div>

      {/* 2. PERIAPSIS */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div>
          <span className="text-[#A5B1C2] text-[10px] block uppercase">PERIAPSIS:</span>
          <span className="text-white font-bold text-base tracking-wider">
            {periapsisKm.toLocaleString()} km
          </span>
        </div>
        {/* Periapsis Trajectory SVG Icon */}
        <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#35C6F4]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19C8 19 12 15 15 11L19 4M19 4L14 4M19 4L19 9" />
            <circle cx="8" cy="15" r="2" />
          </svg>
        </div>
      </div>

      {/* 3. VELOCITY */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div>
          <span className="text-[#A5B1C2] text-[10px] block uppercase">VELOCITY:</span>
          <span className="text-white font-bold text-base tracking-wider">
            {currentVelocityKmS.toFixed(2)} km/s
          </span>
        </div>
        {/* Velocity Spacecraft SVG Icon */}
        <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#35C6F4]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L15 9H9L12 2ZM12 9V22M7 14H17M5 19H19" />
          </svg>
        </div>
      </div>

      {/* 4. THRUST */}
      <div className="space-y-1.5 border-b border-white/5 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#A5B1C2] text-[10px] block uppercase">THRUST:</span>
            <span className="text-white font-bold text-base tracking-wider">
              {thrustN.toFixed(1)} N
            </span>
          </div>
          {/* Thruster SVG Icon */}
          <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#35C6F4]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 3H16V9L18 16H6L8 9V3ZM9 16V21M15 16V21M12 16V22" />
            </svg>
          </div>
        </div>
        <SegmentedBar
          value={thrustN}
          min={0}
          max={440}
          variant={isEngineFiring ? 'green' : 'cyan'}
        />
      </div>

      {/* 5. RCS FUEL */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#A5B1C2] text-[10px] block uppercase">RCS FUEL:</span>
            <span className="text-white font-bold text-base tracking-wider">
              {rcsFuelPercent}%
            </span>
          </div>
          {/* RCS Quad Pod SVG Icon */}
          <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#35C6F4]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3V7M12 17V21M3 12H7M17 12H21" />
            </svg>
          </div>
        </div>
        <SegmentedBar value={rcsFuelPercent} min={0} max={100} variant="cyan" />
      </div>

      {/* Extra Propulsion Telemetry Footer */}
      <div className="mt-auto pt-3 border-t border-white/10 space-y-1.5 text-[10px]">
        <div className="flex justify-between text-[#A5B1C2]">
          <span>PROPELLANT MASS:</span>
          <span className="text-white font-bold">{propRemainingKg.toFixed(1)} kg</span>
        </div>
        <div className="flex justify-between text-[#A5B1C2]">
          <span>ENGINE STATUS:</span>
          <span className={isEngineFiring ? 'text-[#31C48D] font-bold animate-pulse' : 'text-[#35C6F4] font-bold'}>
            {isEngineFiring ? 'FIRING' : 'READY'}
          </span>
        </div>
        <div className="flex justify-between text-[#A5B1C2]">
          <span>FLIGHT MODE:</span>
          <span className="text-[#A5B1C2] font-semibold">{snap.flightState}</span>
        </div>
      </div>
    </aside>
  );
};
