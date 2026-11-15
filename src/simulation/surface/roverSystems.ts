/**
 * SECTOR 17 — Rover Systems Simulation (Power, Thermal, Health & Modes)
 * Deterministic model of RTG electrical generation, battery storage, operating modes,
 * internal thermal equilibrium, ionizing radiation accumulation, and mechanical wear.
 */

import {
  ROVER_ASSET_ID,
  ROVER_BATTERY_CAPACITY_JOULES,
  ROVER_RTG_POWER_OUTPUT_WATTS,
  ROVER_POWER_DEMANDS_WATTS,
  ROVER_THERMAL_CAPACITY_J_PER_K,
  ROVER_SAFE_TEMP_MIN_KELVIN,
  ROVER_SAFE_TEMP_MAX_KELVIN,
  ROVER_NOMINAL_INTERNAL_TEMP_KELVIN,
  EUROPA_SURFACE_TEMP_MEAN_KELVIN,
  EUROPA_SURFACE_RADIATION_DOSE_RATE_RAD_PER_SEC,
  ROVER_MAX_RADIATION_TOLERANCE_RADS,
  ROVER_STORAGE_CAPACITY_BYTES,
} from './constants';
import type {
  RoverState,
  RoverOperatingMode,
  SurfaceInstrument,
} from './types';

/**
 * Creates the default initial science instrument suite aboard the micro-rover.
 * All instruments are categorized with the required 'FICTIONAL' scientific provenance tag.
 */
export function createDefaultSurfaceInstruments(): SurfaceInstrument[] {
  return [
    {
      id: 'CRYO_DRILL',
      name: 'Cryogenic Subsurface Ice Drill & Volatile Ingestor',
      description: 'Micro-percussive core drill capable of sampling pristine cryogenic ice down to 25 cm depth.',
      powerConsumptionWatts: 45.0,
      sampleDurationSeconds: 120,
      generatedDataSizeBytes: 25_000_000, // 25 MB
      status: 'NOMINAL',
      scienceCategory: 'CRYOGENIC_CHEMISTRY',
      totalAcquisitions: 0,
      provenance: 'FICTIONAL',
    },
    {
      id: 'SURFACE_CAM',
      name: 'Multispectral Surface Micro-Imager',
      description: 'High-resolution microscopic camera assessing ice grain morphology and cryo-regolith texture.',
      powerConsumptionWatts: 15.0,
      sampleDurationSeconds: 30,
      generatedDataSizeBytes: 45_000_000, // 45 MB
      status: 'NOMINAL',
      scienceCategory: 'SURFACE_GEOLOGY',
      totalAcquisitions: 0,
      provenance: 'FICTIONAL',
    },
    {
      id: 'MICRO_SEISMIC',
      name: 'Passive Acoustic Cryo-Seismometer',
      description: 'High-sensitivity 3-axis accelerometer measuring ice shelf fracturing and tidal stress tremors.',
      powerConsumptionWatts: 12.0,
      sampleDurationSeconds: 60,
      generatedDataSizeBytes: 15_000_000, // 15 MB
      status: 'NOMINAL',
      scienceCategory: 'ICE_TECTONICS',
      totalAcquisitions: 0,
      provenance: 'FICTIONAL',
    },
    {
      id: 'THERMAL_PROBE',
      name: 'Cryogenic Heat Flow & Thermal Radiometer',
      description: 'Subsurface thermal gradient thermocouple assessing geothermal heat flux from the ocean mantle.',
      powerConsumptionWatts: 18.0,
      sampleDurationSeconds: 45,
      generatedDataSizeBytes: 10_000_000, // 10 MB
      status: 'NOMINAL',
      scienceCategory: 'THERMAL_GRADIENT',
      totalAcquisitions: 0,
      provenance: 'FICTIONAL',
    },
  ];
}

/**
 * Initializes the default stowed state of the Europa micro-rover aboard the lander.
 */
export function createInitialRoverState(): RoverState {
  return {
    roverId: ROVER_ASSET_ID,
    deploymentState: 'STOWED',
    mobilityState: 'STOWED',
    currentCoords: [4, 4], // Center of primary landing zone
    headingDeg: 0,
    distanceTraveledMetres: 0,
    batteryEnergyJoules: ROVER_BATTERY_CAPACITY_JOULES * 0.95, // 95% initial state of charge
    batteryCapacityJoules: ROVER_BATTERY_CAPACITY_JOULES,
    powerConsumptionWatts: ROVER_POWER_DEMANDS_WATTS.SLEEP,
    operatingMode: 'SLEEP',
    internalTemperatureKelvin: ROVER_NOMINAL_INTERNAL_TEMP_KELVIN,
    mobilityHealthPercent: 100.0,
    wheelHealthPercents: [100.0, 100.0, 100.0, 100.0],
    cumulativeRadiationRads: 0,
    radiationTier: 'NOMINAL',
    instruments: createDefaultSurfaceInstruments(),
    observations: [],
    onboardStorageUsedBytes: 0,
    onboardStorageCapacityBytes: ROVER_STORAGE_CAPACITY_BYTES,
    faultHistory: [],
    warningHistory: [],
  };
}

/**
 * Sets the rover operating mode, adjusting power demands accordingly.
 */
export function setRoverOperatingMode(
  state: RoverState,
  newMode: RoverOperatingMode
): RoverState {
  if (state.operatingMode === newMode) return state;

  // Cannot switch to active modes if battery is completely depleted
  if (state.batteryEnergyJoules <= 0 && newMode !== 'SAFE' && newMode !== 'SLEEP') {
    return {
      ...state,
      warningHistory: [
        ...state.warningHistory,
        `Mode transition to ${newMode} rejected: battery depleted.`,
      ],
    };
  }

  const powerConsumptionWatts = ROVER_POWER_DEMANDS_WATTS[newMode];

  return {
    ...state,
    operatingMode: newMode,
    powerConsumptionWatts,
  };
}

/**
 * Deterministically steps the rover power, thermal, radiation, and subsystem health models forward.
 *
 * Physics & Equations:
 * - Net Power = P_RTG - P_consumed (Watts = J/s)
 * - Energy(t + dt) = Energy(t) + Net Power * dt (Strictly clamped: 0 <= E <= E_cap)
 * - Thermal Equilibrium: Heat Loss = k * (T_int - T_amb); dT = (P_heaters + P_waste - Heat Loss) * dt / C_th
 * - Radiation Accumulation: Dose(t + dt) = Dose(t) + dose_rate * dt
 */
export function updateRoverSystems(
  state: RoverState,
  deltaSeconds: number
): RoverState {
  if (deltaSeconds <= 0) return state;

  const warnings: string[] = [...state.warningHistory];
  const faults: string[] = [...state.faultHistory];

  // 1. Power & Energy Dynamics
  const netPowerWatts = ROVER_RTG_POWER_OUTPUT_WATTS - state.powerConsumptionWatts;
  const deltaEnergyJoules = netPowerWatts * deltaSeconds;
  let newEnergyJoules = Math.min(
    state.batteryCapacityJoules,
    Math.max(0, state.batteryEnergyJoules + deltaEnergyJoules)
  );

  let newOperatingMode = state.operatingMode;
  let newMobilityState = state.mobilityState;

  // Battery Depletion Handling
  if (newEnergyJoules === 0 && state.batteryEnergyJoules > 0) {
    warnings.push('CRITICAL: Rover battery energy fully depleted. Dropping into SAFE survival mode.');
    newOperatingMode = 'SAFE';
    if (newMobilityState === 'MOVING') {
      newMobilityState = 'DISABLED';
      faults.push('Traverse interrupted: complete power loss.');
    }
  }

  // 2. Thermal Dynamics (Lumped model with MLI insulation & RTG thermal dissipation)
  // RTG emits ~180 W thermal dissipation; MLI thermal conductance k ~ 0.65 W/K
  const rtgThermalDissipationWatts = 160.0;
  const insulationConductanceWperK = 0.65;
  const ambientTempK = EUROPA_SURFACE_TEMP_MEAN_KELVIN; // ~100 K

  const heatLossWatts = insulationConductanceWperK * (state.internalTemperatureKelvin - ambientTempK);
  const internalHeatGainWatts = state.powerConsumptionWatts + rtgThermalDissipationWatts;
  const netHeatFlowWatts = internalHeatGainWatts - heatLossWatts;

  const deltaTempKelvin = (netHeatFlowWatts * deltaSeconds) / ROVER_THERMAL_CAPACITY_J_PER_K;
  const newTempKelvin = Math.round((state.internalTemperatureKelvin + deltaTempKelvin) * 100) / 100;

  // Thermal Boundary Monitoring
  if (newTempKelvin < ROVER_SAFE_TEMP_MIN_KELVIN) {
    if (!warnings.some((w) => w.includes('sub-zero thermal violation'))) {
      warnings.push(`Avionics sub-zero thermal violation: internal temperature (${newTempKelvin} K) below limit.`);
    }
  } else if (newTempKelvin > ROVER_SAFE_TEMP_MAX_KELVIN) {
    if (!warnings.some((w) => w.includes('thermal over-temperature'))) {
      warnings.push(`Avionics thermal over-temperature: internal temperature (${newTempKelvin} K) exceeds limit.`);
    }
  }

  // 3. Ionizing Radiation Accumulation & Consequential Degradation (MAJ-01 Idempotent)
  const deltaRadiation = EUROPA_SURFACE_RADIATION_DOSE_RATE_RAD_PER_SEC * deltaSeconds;
  const newCumulativeRadiation = Math.round((state.cumulativeRadiationRads + deltaRadiation) * 10) / 10;

  // Authoritative radiation degradation tier: validate against known tiers
  const validTiers = ['NOMINAL', 'DEGRADED_250K', 'CRITICAL_350K'];
  let currentTier: 'NOMINAL' | 'DEGRADED_250K' | 'CRITICAL_350K' =
    state.radiationTier && validTiers.includes(state.radiationTier)
      ? state.radiationTier
      : state.cumulativeRadiationRads >= 350_000.0
        ? 'CRITICAL_350K'
        : state.cumulativeRadiationRads >= ROVER_MAX_RADIATION_TOLERANCE_RADS
          ? 'DEGRADED_250K'
          : 'NOMINAL';

  let updatedInstruments = state.instruments;
  let updatedMobilityHealth = state.mobilityHealthPercent;
  let updatedWheelHealth = [...state.wheelHealthPercents] as [number, number, number, number];

  // Tier 2: Severe threshold (>= 350 krad)
  if (newCumulativeRadiation >= 350_000.0) {
    if (currentTier !== 'CRITICAL_350K') {
      currentTier = 'CRITICAL_350K';
      if (!faults.some((f) => f.includes('Critical radiation threshold exceeded (350 krad)'))) {
        faults.push(
          `Critical radiation threshold exceeded (350 krad): avionics hard fault, all instruments offline, mobility disabled.`
        );
      }
      updatedInstruments = updatedInstruments.map((inst) => ({ ...inst, status: 'FAULT' }));
      updatedMobilityHealth = 0.0;
      updatedWheelHealth = [0.0, 0.0, 0.0, 0.0];
      newMobilityState = 'DISABLED';
      newOperatingMode = 'SAFE';
    }
  } else if (newCumulativeRadiation >= ROVER_MAX_RADIATION_TOLERANCE_RADS) {
    // Tier 1: Moderate threshold (>= 250 krad and < 350 krad) - One-time idempotent transition
    if (currentTier === 'NOMINAL') {
      currentTier = 'DEGRADED_250K';
      if (!faults.some((f) => f.includes('Radiation tolerance exceeded (250 krad)'))) {
        faults.push(
          `Radiation tolerance exceeded (250 krad): cumulative ionizing dose (${newCumulativeRadiation.toFixed(0)} rads) causing sensor and mobility degradation.`
        );
      }
      // Degrade exactly one nominal instrument once
      const nominalIdx = updatedInstruments.findIndex((inst) => inst.status === 'NOMINAL');
      if (nominalIdx !== -1) {
        updatedInstruments = updatedInstruments.map((inst, idx) =>
          idx === nominalIdx ? { ...inst, status: 'DEGRADED' } : inst
        );
      }
      // Degrade mobility health by 25%
      updatedMobilityHealth = Math.min(updatedMobilityHealth, 75.0);
      updatedWheelHealth = updatedWheelHealth.map((w) => Math.min(w, 75.0)) as [number, number, number, number];
    }
  }

  return {
    ...state,
    batteryEnergyJoules: Math.round(newEnergyJoules),
    operatingMode: newOperatingMode,
    mobilityState: newMobilityState,
    powerConsumptionWatts: ROVER_POWER_DEMANDS_WATTS[newOperatingMode],
    internalTemperatureKelvin: newTempKelvin,
    cumulativeRadiationRads: newCumulativeRadiation,
    radiationTier: currentTier,
    instruments: updatedInstruments,
    mobilityHealthPercent: updatedMobilityHealth,
    wheelHealthPercents: updatedWheelHealth,
    warningHistory: warnings,
    faultHistory: faults,
  };
}
