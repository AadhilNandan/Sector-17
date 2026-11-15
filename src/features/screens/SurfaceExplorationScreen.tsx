/**
 * SECTOR 17 — Surface Exploration & Autonomous Rover Screen
 * Connected directly to the authoritative surface simulation runtime.
 *
 * Operational Capabilities:
 * 1. Rover deployment & initialization under 100 km parking orbit prerequisite.
 * 2. 10x10 interactive topological survey grid with live obstacle & hazard detection.
 * 3. Kinematic traverse planning with energy cost & slope feasibility validation.
 * 4. Micro-rover telemetry (RTG, battery energy, thermal equilibrium, radiation dose).
 * 5. Surface science payload acquisition (Drill, Camera, Seismometer, Heat Probe).
 * 6. Store-and-forward proximity data relay to AETHON carrier and DSN downlink.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameHeader } from '../../components/ui/GameHeader';
import { SceneContainer } from '../../components/ui/SceneContainer';
import { GamePanel } from '../../components/ui/GamePanel';
import { GameButton } from '../../components/ui/GameButton';
import { SurfaceIcyScene } from '../../components/scenes/SurfaceIcyScene';
import { useSurfaceMission } from '../../runtime';
import { sounds } from '../../utils/soundEffects';
import {
  Compass,
  Zap,
  Radio,
  Scan,
  CheckSquare,
  Square,
  ArrowRight,
  AlertTriangle,
  Play,
  Navigation,
  Database,
  Activity,
} from 'lucide-react';
import type {
  SurfaceInstrumentId,
  RoverOperatingMode,
} from '../../simulation/surface/types';
import { validateMoveFeasibility, getTerrainCell } from '../../simulation/surface/terrainModel';

export const SurfaceExplorationScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    surface,
    landingSite,
    parkingOrbitPrerequisiteMet,
    parkingOrbitAssumptionNotice,
    rover,
    terrainGrid,
    objectives,
    landerFlightState,
    deployRover,
    executeTraverse,
    executeScience,
    transmitDataToRelay,
    setOperatingMode,
  } = useSurfaceMission();

  const [selectedCellCoords, setSelectedCellCoords] = useState<[number, number] | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<SurfaceInstrumentId>('CRYO_DRILL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const currentRover = rover ?? surface?.rover;
  const isRoverDeployed = currentRover?.deploymentState === 'DEPLOYED';
  const roverCoords = currentRover?.currentCoords ?? [4, 4];

  // Selected cell & move validation preview
  const activeSelectedCoords = selectedCellCoords ?? roverCoords;
  const activeSelectedCell = getTerrainCell(terrainGrid, activeSelectedCoords[0], activeSelectedCoords[1]);
  const moveValidation = currentRover
    ? validateMoveFeasibility(terrainGrid, currentRover, activeSelectedCoords)
    : undefined;

  // Handlers
  const handleDeployRover = () => {
    sounds.playClick();
    const res = deployRover();
    setActionMessage(res.message);
  };

  const handleCellClick = (x: number, y: number) => {
    sounds.playClick(1000);
    setSelectedCellCoords([x, y]);
  };

  const handleExecuteMove = () => {
    if (!selectedCellCoords) return;
    sounds.playThruster();
    const res = executeTraverse(selectedCellCoords[0], selectedCellCoords[1]);
    if (res.success) {
      setActionMessage(`Traversed to [${selectedCellCoords[0]}, ${selectedCellCoords[1]}]. Distance: +${res.distanceTraveledMetres.toFixed(1)} m.`);
    } else {
      setActionMessage(`Traverse blocked: ${res.failureReason}`);
    }
  };

  const handleSampleScience = () => {
    sounds.playScan();
    const res = executeScience(selectedInstrument);
    if (res.success) {
      setActionMessage(res.observation?.summary ?? 'Science sample acquired.');
    } else {
      setActionMessage(`Sampling failed: ${res.failureReason}`);
    }
  };

  const handleRelayData = () => {
    sounds.playClick();
    const res = transmitDataToRelay();
    setActionMessage(res.message);
  };

  const handleModeChange = (mode: RoverOperatingMode) => {
    sounds.playClick();
    setOperatingMode(mode);
  };

  // Battery percentage calculation
  const batteryJoules = currentRover?.batteryEnergyJoules ?? 0;
  const batteryCapJoules = currentRover?.batteryCapacityJoules || 2_880_000;
  const batteryPercent = Math.round((batteryJoules / batteryCapJoules) * 100);
  const batteryWh = (batteryJoules / 3600).toFixed(0);
  const batteryCapWh = (batteryCapJoules / 3600).toFixed(0);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070B] flex flex-col font-sans select-none">
      {/* 1. Header */}
      <GameHeader
        title="SURFACE EXPLORATION · EUROPA"
        subtitle={`Landing Site: ${landingSite} · Conamara Chaos Survey Grid`}
        icon={<Compass size={18} className="text-[#35C6F4]" />}
        backTo="/operations"
        backLabel="OPERATIONS"
        rightElement={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-[#35C6F4]">
              <Radio size={13} className={`animate-pulse ${isRoverDeployed ? 'text-[#31C48D]' : 'text-[#F5A623]'}`} />
              <span>
                {isRoverDeployed ? 'ROVER: ACTIVE (PROMETHEUS-IV)' : 'ROVER: STOWED ON LANDER'}
              </span>
            </div>
            {activeSelectedCell?.isAnomalyTarget && (
              <button
                type="button"
                onClick={() => navigate('/anomaly')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5A623]/20 hover:bg-[#F5A623]/30 border border-[#F5A623]/40 text-[#F5A623] font-mono text-xs font-bold uppercase transition-all"
              >
                <span>Anomaly Sector</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        }
      />

      {/* 2. Main Viewport & Map / Telemetry Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col lg:flex-row">
        {/* Left Side: 2D Surface Canvas with Interactive Topological Grid Overlay */}
        <div className="relative flex-1 h-full overflow-hidden flex flex-col items-center justify-center p-4">
          <SceneContainer>
            <SurfaceIcyScene />
          </SceneContainer>

          {/* Interactive Topological Survey Grid Overlay (10x10) */}
          <div className="relative z-20 bg-[#05070B]/85 backdrop-blur-md p-4 rounded-xl border border-white/15 shadow-2xl max-w-xl w-full">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-[#35C6F4] font-bold">
                <Navigation size={14} />
                <span>TOPOLOGICAL SURVEY GRID (200m x 200m)</span>
              </div>
              <span className="text-[#A5B1C2] text-[10px]">
                COORD: [{roverCoords[0]}, {roverCoords[1]}] · HEADING: {currentRover?.headingDeg ?? 0}°
              </span>
            </div>

            {/* 10x10 Grid Cells */}
            <div className="grid grid-cols-10 gap-1 aspect-square w-full max-h-[380px] mx-auto p-1 bg-black/40 rounded-lg border border-white/10">
              {terrainGrid.map((row, y) =>
                row.map((cell, x) => {
                  const isRoverHere = roverCoords[0] === x && roverCoords[1] === y;
                  const isSelected = activeSelectedCoords[0] === x && activeSelectedCoords[1] === y;
                  const isAdjacent = Math.abs(x - roverCoords[0]) <= 1 && Math.abs(y - roverCoords[1]) <= 1 && !(x === roverCoords[0] && y === roverCoords[1]);

                  let cellBg = 'bg-white/5';
                  let borderCol = 'border-white/10';

                  if (cell.hasObstacle) {
                    cellBg = 'bg-[#E02424]/20';
                    borderCol = 'border-[#E02424]/40';
                  } else if (cell.isAnomalyTarget) {
                    cellBg = 'bg-[#F5A623]/25 animate-pulse';
                    borderCol = 'border-[#F5A623]/60';
                  } else if (cell.isSurveyed) {
                    cellBg = 'bg-[#31C48D]/15';
                    borderCol = 'border-[#31C48D]/30';
                  }

                  if (isRoverHere) {
                    cellBg = 'bg-[#35C6F4]/30 ring-2 ring-[#35C6F4]';
                  } else if (isSelected) {
                    cellBg = 'bg-white/20 ring-2 ring-white';
                  } else if (isAdjacent && isRoverDeployed) {
                    borderCol = 'border-[#35C6F4]/50';
                  }

                  return (
                    <button
                      type="button"
                      key={`cell-${x}-${y}`}
                      onClick={() => handleCellClick(x, y)}
                      className={`relative w-full h-full rounded border flex flex-col items-center justify-center transition-all cursor-pointer ${cellBg} ${borderCol} hover:scale-105`}
                      title={`${cell.featureName ?? `Sector [${x}, ${y}]`} (Slope: ${cell.slopeDeg}°, Roughness: ${cell.roughness})`}
                    >
                      {isRoverHere ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#35C6F4] shadow-md flex items-center justify-center text-[7px] text-black font-bold">
                          ▲
                        </div>
                      ) : cell.hasObstacle ? (
                        <span className="text-[9px] text-[#E02424] font-bold">✕</span>
                      ) : cell.isAnomalyTarget ? (
                        <span className="text-[9px] text-[#F5A623] font-bold">★</span>
                      ) : (
                        <span className="text-[8px] font-mono text-[#A5B1C2]/60">
                          {cell.elevationMetres > 0 ? `+${cell.elevationMetres.toFixed(0)}` : cell.elevationMetres.toFixed(0)}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Grid Legend & Status */}
            <div className="flex items-center justify-between pt-2.5 text-[10px] font-mono text-[#A5B1C2] border-t border-white/10 mt-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#35C6F4]" /> Rover</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#31C48D]" /> Surveyed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E02424]" /> Obstacle</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F5A623]" /> Anomaly</span>
              </div>
              <span>Total Distance: <span className="text-white font-bold">{currentRover?.distanceTraveledMetres.toFixed(1)} m</span></span>
            </div>
          </div>

          {/* Scientific Provenance Banner (Required by Directive Section 2.1 & 2.3) */}
          <div className="relative z-20 mt-3 max-w-xl w-full p-2.5 rounded-lg bg-black/60 border border-white/10 text-[10px] font-mono text-[#A5B1C2] leading-relaxed">
            <div className="flex items-center gap-1.5 text-[#F5A623] font-bold mb-1">
              <AlertTriangle size={12} />
              <span>MISSION ARCHITECTURE & PROVENANCE CLASSIFICATION</span>
            </div>
            <p className="text-[#A5B1C2]/90">
              {parkingOrbitAssumptionNotice ??
                'MISSION PREREQUISITE (SIMPLIFIED): Powered descent begins from an assumed 100 km circular Europa parking orbit.'}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-white/60">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">GRAVITY: VERIFIED (1.315 m/s²)</span>
              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">ROVER: FICTIONAL</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">TERRAIN: SIMPLIFIED</span>
            </div>
          </div>
        </div>

        {/* Right Side: Operational HUD & Control Panels */}
        <div className="w-full lg:w-96 p-4 overflow-y-auto space-y-4 z-20 bg-[#05070B]/90 border-l border-white/10">
          {/* Action Message Alert */}
          {actionMessage && (
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/15 text-xs font-mono text-[#35C6F4] flex items-start gap-2 shadow-lg">
              <Activity size={14} className="shrink-0 mt-0.5 text-[#35C6F4]" />
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Uninitialized / Pre-Deployment Panel */}
          {!isRoverDeployed ? (
            <GamePanel
              title="Rover Deployment Required"
              subtitle="Prometheus-IV Autonomous Egress"
              className="border-white/15"
            >
              <p className="font-mono text-xs text-[#A5B1C2] mb-3 leading-relaxed">
                {landerFlightState === 'TOUCHDOWN'
                  ? 'Carrier lander touchdown confirmed at Pelagon Chaos. Surface micro-rover is stowed in carrier bay. Verify systems and initiate egress onto Europa cryogenic regolith.'
                  : 'Lander is currently in transit or stowed. Powered descent and touchdown confirmation required before surface micro-rover egress.'}
              </p>

              <div className="space-y-1.5 font-mono text-[11px] mb-4 p-2.5 rounded bg-white/5 border border-white/10">
                <div className="flex justify-between">
                  <span className="text-[#A5B1C2]">Parking Orbit Staging:</span>
                  <span className={parkingOrbitPrerequisiteMet ? 'text-[#31C48D] font-bold' : 'text-[#F59E0B] font-bold'}>
                    {parkingOrbitPrerequisiteMet ? 'AUTHORIZED' : 'NOT AUTHORIZED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A5B1C2]">Lander Touchdown:</span>
                  <span
                    className={
                      landerFlightState === 'TOUCHDOWN'
                        ? 'text-[#31C48D] font-bold'
                        : landerFlightState === 'CRASHED'
                          ? 'text-[#EF4444] font-bold'
                          : 'text-[#A5B1C2] font-bold'
                    }
                  >
                    {landerFlightState === 'TOUCHDOWN'
                      ? isRoverDeployed
                        ? 'TOUCHDOWN CONFIRMED, ROVER DEPLOYED'
                        : 'TOUCHDOWN CONFIRMED'
                      : landerFlightState === 'DEPLOYED' ||
                          landerFlightState === 'DEORBITING' ||
                          landerFlightState === 'DESCENT'
                        ? 'DESCENDING'
                        : landerFlightState === 'CRASHED'
                          ? 'CRASHED'
                          : 'STOWED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A5B1C2]">Surface Atmospheric Pressure:</span>
                  <span className="text-white">~10⁻¹² bar (Near-Vacuum)</span>
                </div>
              </div>

              <GameButton
                variant="cyan"
                size="md"
                fullWidth
                disabled={!parkingOrbitPrerequisiteMet || landerFlightState !== 'TOUCHDOWN'}
                onClick={handleDeployRover}
                icon={<Play size={15} />}
                className="h-10 font-bold text-xs tracking-wider"
              >
                DEPLOY PROMETHEUS-IV ROVER
              </GameButton>
            </GamePanel>
          ) : (
            <>
              {/* Rover Systems & Power Telemetry */}
              <GamePanel
                title="Prometheus-IV Telemetry"
                subtitle="Power, Thermal & Mobility Subsystems"
                className="border-white/15"
              >
                <div className="space-y-3 font-mono text-xs">
                  {/* Operating Mode Selector */}
                  <div>
                    <span className="text-[10px] text-[#A5B1C2] block mb-1">OPERATING MODE:</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['IDLE', 'TRAVERSE', 'SCIENCE', 'COMMUNICATION', 'SLEEP', 'SAFE'] as RoverOperatingMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleModeChange(mode)}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                            currentRover?.operatingMode === mode
                              ? 'bg-[#35C6F4]/25 text-[#35C6F4] border border-[#35C6F4]/40'
                              : 'bg-white/5 text-[#A5B1C2] hover:bg-white/10'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Battery State of Charge */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="flex items-center gap-1 text-[#F5A623]">
                        <Zap size={12} /> Battery Energy
                      </span>
                      <span className="text-white font-bold">{batteryWh} / {batteryCapWh} Wh ({batteryPercent}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${batteryPercent < 20 ? 'bg-[#E02424]' : batteryPercent < 45 ? 'bg-[#F5A623]' : 'bg-[#31C48D]'}`}
                        style={{ width: `${batteryPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/10">
                    <div>
                      Power Draw: <span className="text-white font-bold">{currentRover?.powerConsumptionWatts.toFixed(0)} W</span>
                    </div>
                    <div>
                      RTG Output: <span className="text-[#31C48D] font-bold">+45 W</span>
                    </div>
                    <div>
                      Internal Temp: <span className="text-white font-bold">{currentRover?.internalTemperatureKelvin.toFixed(1)} K</span>
                    </div>
                    <div>
                      Mobility Health: <span className="text-white font-bold">{currentRover?.mobilityHealthPercent.toFixed(0)}%</span>
                    </div>
                    <div className="col-span-2">
                      Radiation Absorbed: <span className="text-[#F5A623] font-bold">{((currentRover?.cumulativeRadiationRads ?? 0) / 1e3).toFixed(1)} krad</span>
                    </div>
                  </div>
                </div>
              </GamePanel>

              {/* Movement & Traverse Planning Card */}
              <GamePanel
                title="Traverse Planner"
                subtitle={`Target: [${activeSelectedCoords[0]}, ${activeSelectedCoords[1]}]`}
                className="border-white/15"
              >
                <div className="space-y-2.5 font-mono text-xs">
                  {activeSelectedCell ? (
                    <div className="p-2.5 rounded bg-white/5 border border-white/10 space-y-1 text-[11px]">
                      <div className="font-bold text-white flex justify-between">
                        <span>{activeSelectedCell.featureName ?? `Sector [${activeSelectedCell.x}, ${activeSelectedCell.y}]`}</span>
                        <span className={activeSelectedCell.hasObstacle ? 'text-[#E02424]' : 'text-[#31C48D]'}>
                          {activeSelectedCell.hasObstacle ? 'OBSTACLE' : 'CLEAR'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-[#A5B1C2] text-[10px]">
                        <div>Slope: <span className="text-white">{activeSelectedCell.slopeDeg}°</span></div>
                        <div>Roughness: <span className="text-white">{activeSelectedCell.roughness.toFixed(2)}</span></div>
                        <div>Elevation: <span className="text-white">{activeSelectedCell.elevationMetres.toFixed(1)} m</span></div>
                        <div>Science Interest: <span className="text-[#35C6F4]">{activeSelectedCell.scienceInterestValue}</span></div>
                      </div>
                      {moveValidation && (
                        <div className="pt-1.5 border-t border-white/10 text-[10px]">
                          <div>Est. Distance: <span className="text-white font-bold">{moveValidation.distanceMetres.toFixed(1)} m</span></div>
                          <div>Energy Cost: <span className="text-[#F5A623] font-bold">{(moveValidation.energyCostJoules / 3600).toFixed(1)} Wh</span></div>
                          {moveValidation.reason && (
                            <div className="text-[#E02424] mt-1">{moveValidation.reason}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[#A5B1C2] text-xs">Select adjacent cell on grid to plan traverse.</div>
                  )}

                  <GameButton
                    variant="cyan"
                    size="sm"
                    fullWidth
                    onClick={handleExecuteMove}
                    disabled={!moveValidation?.isFeasible}
                    icon={<Play size={14} />}
                    className="h-9 font-bold text-xs"
                  >
                    EXECUTE TRAVERSE
                  </GameButton>
                </div>
              </GamePanel>

              {/* Surface Science Instruments Card */}
              <GamePanel
                title="Surface Science Payload"
                subtitle="Cryogenic Drilling & Spectroscopy"
                className="border-white/15"
              >
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentRover?.instruments.map((inst) => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => setSelectedInstrument(inst.id)}
                        className={`p-2 rounded text-left border transition-all ${
                          selectedInstrument === inst.id
                            ? 'bg-[#35C6F4]/20 border-[#35C6F4]/40 text-white'
                            : 'bg-white/5 border-white/10 text-[#A5B1C2] hover:bg-white/10'
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate">{inst.id}</div>
                        <div className="text-[9px] text-[#A5B1C2]">{inst.powerConsumptionWatts}W · {inst.sampleDurationSeconds}s</div>
                      </button>
                    ))}
                  </div>

                  <GameButton
                    variant="amber"
                    size="sm"
                    fullWidth
                    onClick={handleSampleScience}
                    icon={<Scan size={14} />}
                    className="h-9 font-bold text-xs"
                  >
                    ACQUIRE SCIENCE SAMPLE ({selectedInstrument})
                  </GameButton>
                </div>
              </GamePanel>

              {/* Data Storage & Relay to Carrier */}
              <GamePanel
                title="Data Relay & Storage"
                subtitle="Rover -> Lander -> AETHON Carrier"
                className="border-white/15"
              >
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#A5B1C2] flex items-center gap-1">
                      <Database size={12} /> Onboard Storage
                    </span>
                    <span className="text-white font-bold">
                      {((currentRover?.onboardStorageUsedBytes ?? 0) / 1e6).toFixed(1)} / 500 MB
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#A5B1C2]">
                    <span>Relay Link Budget:</span>
                    <span className="text-[#31C48D] font-bold">NOMINAL (+14.2 dB — configured proximity baseline)</span>
                  </div>

                  <GameButton
                    variant="glass"
                    size="sm"
                    fullWidth
                    onClick={handleRelayData}
                    icon={<Radio size={14} />}
                    className="h-9 font-bold text-xs border-white/20 text-[#35C6F4] hover:bg-[#35C6F4]/10"
                  >
                    RELAY DATA TO AETHON CARRIER
                  </GameButton>
                </div>
              </GamePanel>

              {/* Mission Objectives Checklist */}
              <GamePanel
                title="Surface Directives"
                subtitle="Autonomous Mission Checklist"
                className="border-white/15"
              >
                <div className="space-y-2 font-mono text-xs">
                  {objectives.map((obj) => (
                    <div
                      key={obj.id}
                      className={`flex items-start gap-2.5 p-2 rounded border ${
                        obj.isCompleted ? 'bg-[#31C48D]/15 border-[#31C48D]/40 text-white' : 'bg-white/5 border-white/10 text-[#A5B1C2]'
                      }`}
                    >
                      {obj.isCompleted ? (
                        <CheckSquare size={14} className="text-[#31C48D] shrink-0 mt-0.5" />
                      ) : (
                        <Square size={14} className="text-[#6D7A8D] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`text-[11px] ${obj.isCompleted ? 'font-bold' : ''}`}>{obj.title}</div>
                        <div className="text-[10px] text-[#A5B1C2]">{obj.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </GamePanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurfaceExplorationScreen;
