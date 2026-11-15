/**
 * SECTOR 17 — Navigation & Europa Approach Telemetry Panel
 * Displays live authoritative astrodynamics, Jovian orbit parameters,
 * Europa flyby observation window status, and independent lander package telemetry.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GamePanel } from '../../../components/ui/GamePanel';
import { GameButton } from '../../../components/ui/GameButton';
import { useNavigation, useSimulationRuntime } from '../../../runtime';
import { sounds } from '../../../utils/soundEffects';
import {
  Compass,
  Radar,
  ExternalLink,
  Shield,
} from 'lucide-react';

export const NavigationPanel: React.FC = () => {
  const navigate = useNavigate();
  const runtime = useSimulationRuntime();
  const {
    currentPhase,
    currentOrbit,
    europaFlyby,
    lander,
  } = useNavigation();

  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleReconScan = () => {
    setIsScanning(true);
    sounds.playScan();
    try {
      const res = runtime.triggerReconnaissanceScan();
      if (res.success) {
        setScanMessage(`Scan complete: ${(res.bytesGenerated / 1e6).toFixed(0)} MB science sounding dataset acquired!`);
      } else {
        setScanMessage(res.reason ?? 'Reconnaissance scan unsuccessful.');
      }
    } catch (err: any) {
      setScanMessage(err?.message ?? 'Scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const inObservationWindow = europaFlyby?.inObservationWindow ?? false;
  const canScan = currentPhase === 'EUROPA_RECONNAISSANCE' || inObservationWindow;

  return (
    <GamePanel
      title="Navigation & Europa Approach"
      subtitle="Astrodynamics, Flyby Geometry & Lander Telemetry"
      className="border-white/15"
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Navigation Phase & Central Body */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5 text-[#35C6F4]">
            <Compass size={14} />
            <span className="font-bold">PHASE</span>
          </div>
          <span className="text-white font-bold px-2 py-0.5 rounded bg-white/10">
            {currentPhase}
          </span>
        </div>

        {/* Orbital Parameters */}
        <div className="grid grid-cols-2 gap-2 text-[11px] py-1 border-b border-white/10">
          <div>
            Central Body: <span className="text-white font-bold">{currentOrbit?.centralBody ?? 'EARTH'}</span>
          </div>
          <div>
            Orbital Speed:{' '}
            <span className="text-[#31C48D] font-bold">
              {((currentOrbit?.currentVelocityMps ?? 0) / 1000).toFixed(2)} km/s
            </span>
          </div>
          <div>
            {currentPhase === 'HELIOCENTRIC_CRUISE' ? 'Perihelion:' : 'Periapsis:'}{' '}
            <span className="text-white font-bold">
              {currentPhase === 'HELIOCENTRIC_CRUISE'
                ? `${((currentOrbit?.periapsisRadiusMetres ?? 0) / 1.495978707e11).toFixed(2)} AU`
                : `${((currentOrbit?.periapsisRadiusMetres ?? 0) / 1e6).toFixed(1)} Mm`}
            </span>
          </div>
          <div>
            {currentPhase === 'HELIOCENTRIC_CRUISE' ? 'Aphelion:' : 'Apoapsis:'}{' '}
            <span className="text-white font-bold">
              {currentPhase === 'HELIOCENTRIC_CRUISE'
                ? `${((currentOrbit?.apoapsisRadiusMetres ?? 0) / 1.495978707e11).toFixed(2)} AU`
                : `${((currentOrbit?.apoapsisRadiusMetres ?? 0) / 1e6).toFixed(1)} Mm`}
            </span>
          </div>
        </div>

        {/* Europa Relative Distance & Flyby Observation */}
        <div className="py-2 border-b border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[#A5B1C2] flex items-center gap-1">
              <Radar size={13} className="text-[#35C6F4]" /> Europa Distance
            </span>
            <span className="text-white font-bold">
              {((europaFlyby?.currentEuropaDistanceMetres ?? 0) / 1e6).toFixed(1)} Mm
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#A5B1C2]">Observation Window:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                inObservationWindow
                  ? 'bg-[#31C48D]/20 text-[#31C48D] border border-[#31C48D]/30'
                  : 'bg-white/5 text-[#A5B1C2]'
              }`}
            >
              {inObservationWindow ? 'IN OBSERVATION WINDOW (<5 Mm)' : 'APPROACH TRANSIT'}
            </span>
          </div>

          {/* Trigger Reconnaissance Scan Button */}
          {canScan && (
            <div className="pt-1.5">
              <GameButton
                variant="glass"
                size="sm"
                fullWidth
                onClick={handleReconScan}
                disabled={isScanning}
                icon={<Radar size={13} className="text-[#35C6F4]" />}
                className="h-8 text-xs font-mono border-[#35C6F4]/30 text-[#35C6F4] hover:bg-[#35C6F4]/10"
              >
                {isScanning ? 'Acquiring Sounding Data...' : 'Acquire Radar Sounding Data'}
              </GameButton>
            </div>
          )}

          {scanMessage && (
            <div className="p-2 rounded bg-white/5 border border-white/10 text-[10px] text-[#31C48D] mt-1">
              {scanMessage}
            </div>
          )}
        </div>

        {/* Independent Lander Telemetry */}
        <div className="py-2 border-b border-white/10 space-y-1 text-[11px]">
          <div className="flex items-center justify-between text-white font-bold">
            <span className="flex items-center gap-1 text-[#F5A623]">
              <Shield size={13} /> SURFACE LANDER ASSET
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5A623]/20 text-[#F5A623]">
              {lander?.flightState ?? 'STOWED'}
            </span>
          </div>
          <div className="text-[#A5B1C2]">
            Target Site: <span className="text-white">{lander?.targetLandingSite ?? 'Pelagon Chaos'}</span>
          </div>
          <div className="text-[#A5B1C2]">
            Lander Propellant: <span className="text-[#31C48D]">{lander?.propellantRemainingKg.toFixed(1)} / {lander?.propellantCapacityKg} kg</span>
          </div>
          {lander?.touchdownAtMET && (
            <div className="text-[#31C48D] font-bold">
              ✓ Soft Touchdown Confirmed (MET: {lander.touchdownAtMET.toFixed(0)} s)
            </div>
          )}
        </div>

        {/* Trajectory Planner Gateway */}
        <div className="pt-1">
          <GameButton
            variant="glass"
            size="sm"
            fullWidth
            onClick={() => navigate('/trajectory')}
            icon={<ExternalLink size={13} />}
            className="h-8 text-xs font-mono"
          >
            Open Trajectory Planner
          </GameButton>
        </div>
      </div>
    </GamePanel>
  );
};
