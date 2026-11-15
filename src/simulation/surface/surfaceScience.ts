/**
 * SECTOR 17 — Surface Science Acquisition & Observation Engine
 * Validates, executes, and records scientific sampling via the rover payload suite.
 * Enforces energy, storage, instrument health constraints, and generates deterministic observations.
 */

import { getTerrainCell } from './terrainModel';
import type {
  RoverState,
  TerrainCell,
  SurfaceInstrumentId,
  SurfaceObservation,
} from './types';
import type { Level0Product } from '../science/types';

export interface ScienceAcquisitionResult {
  readonly success: boolean;
  readonly failureReason?: string;
  readonly updatedRover: RoverState;
  readonly observation?: SurfaceObservation;
  readonly level0Product?: Level0Product;
  readonly energyConsumedJoules: number;
  readonly durationSeconds: number;
}

/**
 * Validates and executes a scientific observation using a rover surface instrument.
 * Strictly guarantees that failure does NOT mutate rover resources or generate spurious data.
 */
export function executeSurfaceScienceAcquisition(
  grid: readonly (readonly TerrainCell[])[],
  rover: RoverState,
  instrumentId: SurfaceInstrumentId,
  currentMET: number
): ScienceAcquisitionResult {
  // 1. Mobility Status Checks
  if (rover.mobilityState === 'MOVING') {
    return createFailedScienceResult(rover, 'Rover is currently moving. Stop vehicle before initiating science sampling.');
  }
  if (rover.mobilityState === 'STOWED') {
    return createFailedScienceResult(rover, 'Rover is stowed. Deployment required prior to science operations.');
  }
  if (rover.mobilityState === 'DISABLED' || rover.mobilityState === 'LOST') {
    return createFailedScienceResult(rover, `Rover is ${rover.mobilityState}. Science instruments interlocked.`);
  }

  // 2. Instrument Verification
  const instrument = rover.instruments.find((i) => i.id === instrumentId);
  if (!instrument) {
    return createFailedScienceResult(rover, `Surface instrument "${instrumentId}" not found in rover manifest.`);
  }
  if (instrument.status === 'FAULT' || instrument.status === 'OFF') {
    return createFailedScienceResult(rover, `Instrument "${instrument.name}" status is ${instrument.status}. Sampling disallowed.`);
  }

  // 3. Energy Requirement Verification
  const requiredEnergyJoules = instrument.powerConsumptionWatts * instrument.sampleDurationSeconds;
  if (rover.batteryEnergyJoules < requiredEnergyJoules) {
    const deficitWh = ((requiredEnergyJoules - rover.batteryEnergyJoules) / 3600).toFixed(1);
    return createFailedScienceResult(
      rover,
      `Insufficient energy for ${instrument.name}: required ${(requiredEnergyJoules / 3600).toFixed(1)} Wh, available ${(rover.batteryEnergyJoules / 3600).toFixed(1)} Wh (deficit: ${deficitWh} Wh).`
    );
  }

  // 4. Onboard Flash Storage Space Verification
  const availableStorageBytes = rover.onboardStorageCapacityBytes - rover.onboardStorageUsedBytes;
  if (availableStorageBytes < instrument.generatedDataSizeBytes) {
    return createFailedScienceResult(
      rover,
      `Rover onboard storage full: required ${(instrument.generatedDataSizeBytes / 1e6).toFixed(1)} MB, but only ${(availableStorageBytes / 1e6).toFixed(1)} MB available. Downlink data to lander relay first.`
    );
  }

  // 5. Current Cell Context
  const [cx, cy] = rover.currentCoords;
  const cell = getTerrainCell(grid, cx, cy) ?? {
    x: cx,
    y: cy,
    elevationMetres: 0,
    slopeDeg: 0,
    roughness: 0.1,
    hasObstacle: false,
    traversalDifficulty: 1,
    hazardLevel: 0.1,
    scienceInterestValue: 50,
    isSurveyed: true,
  };

  // 6. Generate Deterministic Scientific Data (with monotonic sequence counter for uniqueness)
  const sequence = instrument.totalAcquisitions + 1;
  const observationId = `obs-${instrumentId.toLowerCase()}-${cx}_${cy}-${currentMET}-${sequence}`;
  const packetId = `pkt-surf-${instrumentId.toLowerCase()}-${currentMET}-${sequence}`;
  const qualityMultiplier = instrument.status === 'DEGRADED' ? 0.75 : 1.0;
  const qualityPercent = Math.min(100, Math.max(30, Math.round((cell.scienceInterestValue * 0.4 + 55) * qualityMultiplier)));
  const uncertainty = Math.round((0.02 + cell.roughness * 0.05 + (100 - qualityPercent) * 0.001) * 1000) / 1000;

  const { summary, rawReading } = generateScientificContent(instrument.id, cell, qualityPercent);

  const observation: SurfaceObservation = {
    id: observationId,
    instrumentId,
    acquisitionMET: currentMET,
    coords: [cx, cy],
    qualityPercent,
    uncertainty,
    sizeBytes: instrument.generatedDataSizeBytes,
    scienceCategory: instrument.scienceCategory,
    summary,
    rawReading,
    dataPacketId: packetId,
    isTransmittedToRelay: false,
    provenanceTag: 'FICTIONAL',
  };

  // 7. Update Rover State (Consume energy, fill storage, increment instrument acquisition)
  const updatedInstruments = rover.instruments.map((inst) =>
    inst.id === instrumentId
      ? { ...inst, totalAcquisitions: inst.totalAcquisitions + 1 }
      : inst
  );

  const updatedRover: RoverState = {
    ...rover,
    batteryEnergyJoules: Math.max(0, rover.batteryEnergyJoules - requiredEnergyJoules),
    onboardStorageUsedBytes: rover.onboardStorageUsedBytes + instrument.generatedDataSizeBytes,
    instruments: updatedInstruments,
    observations: [...rover.observations, observation],
    operatingMode: 'IDLE',
  };

  // 8. Construct Level 0 Product for central registry integration
  const level0Product: Level0Product = {
    id: `l0-${observationId}`,
    instrument: instrumentId as any,
    packetId,
    category: 'science',
    acquisitionMET: currentMET,
    ingestionMET: currentMET,
    status: 'VALIDATED',
    sizeBytes: instrument.generatedDataSizeBytes,
    rawPayload: rawReading as any,
    checksumValid: true,
  };

  return {
    success: true,
    updatedRover,
    observation,
    level0Product,
    energyConsumedJoules: requiredEnergyJoules,
    durationSeconds: instrument.sampleDurationSeconds,
  };
}

function createFailedScienceResult(
  rover: RoverState,
  reason: string
): ScienceAcquisitionResult {
  return {
    success: false,
    failureReason: reason,
    updatedRover: rover,
    energyConsumedJoules: 0,
    durationSeconds: 0,
  };
}

/**
 * Deterministically generates payload readings and descriptive summaries for surface instruments.
 */
function generateScientificContent(
  instrumentId: SurfaceInstrumentId,
  cell: TerrainCell,
  qualityPercent: number
): { summary: string; rawReading: Record<string, unknown> } {
  const loc = cell.featureName ? `${cell.featureName} [${cell.x}, ${cell.y}]` : `Sector [${cell.x}, ${cell.y}]`;

  switch (instrumentId) {
    case 'CRYO_DRILL': {
      const h2oPurity = (96.5 + (cell.elevationMetres % 3.0)).toFixed(1);
      const saltPercent = (2.2 + (cell.roughness * 2.5)).toFixed(2);
      const summary = `Cryogenic core drill sample at ${loc}: ${h2oPurity}% water-ice matrix with ${saltPercent}% magnesium sulphate (MgSO4) hydrated salts.`;
      const rawReading = {
        sampleDepthCm: 22.5,
        h2oPurityPercent: Number(h2oPurity),
        magnesiumSulphatePercent: Number(saltPercent),
        organicVolatilePpm: cell.isAnomalyTarget ? 142.8 : 8.4,
        spectrometerSNR: qualityPercent,
      };
      return { summary, rawReading };
    }
    case 'SURFACE_CAM': {
      const grainSizeMicrons = Math.round(180 + cell.roughness * 250);
      const summary = `Multispectral micro-imaging at ${loc}: sintered cryo-regolith grains (${grainSizeMicrons} µm) with micro-fracture lineations.`;
      const rawReading = {
        meanGrainDiameterMicrons: grainSizeMicrons,
        albedo: 0.68,
        microfractureDensityPerMm2: cell.roughness * 12.0,
        illuminationIntensityLumens: 850,
      };
      return { summary, rawReading };
    }
    case 'MICRO_SEISMIC': {
      const tremorAmplitudeNm = Math.round((12.5 + cell.slopeDeg * 2.1) * 10) / 10;
      const dominantFreqHz = cell.isAnomalyTarget ? 4.8 : 1.2;
      const summary = `Acoustic seismic recording at ${loc}: continuous ${tremorAmplitudeNm} nm micro-tremor detected at ${dominantFreqHz} Hz tidal harmonic.`;
      const rawReading = {
        peakAmplitudeNanometres: tremorAmplitudeNm,
        dominantFrequencyHz: dominantFreqHz,
        tidalPhaseCorrelation: 0.91,
        recordingDurationSeconds: 60,
      };
      return { summary, rawReading };
    }
    case 'THERMAL_PROBE': {
      const heatFluxMw = cell.isAnomalyTarget ? 185.4 : Math.round((28.5 + cell.slopeDeg * 1.5) * 10) / 10;
      const summary = `Subsurface thermal gradient probe at ${loc}: geothermal heat flux measured at ${heatFluxMw} mW/m² into ice crust.`;
      const rawReading = {
        heatFluxMilliwattsPerM2: heatFluxMw,
        thermalGradientKelvinPerM: cell.isAnomalyTarget ? 0.38 : 0.08,
        sensorDepthCm: 15.0,
      };
      return { summary, rawReading };
    }
  }
}
