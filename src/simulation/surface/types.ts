/**
 * SECTOR 17 — Europa Surface Exploration & Science Operations Types
 * Strict type definitions for rover systems, terrain modeling, mobility kinematics,
 * surface science instruments, data relay, mission objectives, and authoritative state persistence.
 */

import type { ScientificProvenanceTag } from '../science/types';

/* -------------------------------------------------------------------------- */
/* 1. Rover State & Operating Modes                                            */
/* -------------------------------------------------------------------------- */

export type RoverDeploymentState = 'STOWED' | 'DEPLOYING' | 'DEPLOYED' | 'FAILED';

export type RoverMobilityState =
  | 'STOWED'
  | 'DEPLOYED'
  | 'READY'
  | 'MOVING'
  | 'PAUSED'
  | 'DISABLED'
  | 'LOST';

export type RoverOperatingMode =
  | 'SAFE'
  | 'IDLE'
  | 'TRAVERSE'
  | 'SCIENCE'
  | 'COMMUNICATION'
  | 'SLEEP';

export type RoverActivityType =
  | 'TRAVERSE'
  | 'SCIENCE_ACQUISITION'
  | 'DATA_RELAY'
  | 'SYSTEM_REBOOT';

export interface RoverActivity {
  readonly id: string;
  readonly type: RoverActivityType;
  readonly description: string;
  readonly startedAtMET: number;
  readonly durationSeconds: number;
  readonly energyConsumedJoules: number;
  readonly targetCoords?: readonly [number, number];
  readonly instrumentId?: string;
  readonly progressPercent: number;
}

/* -------------------------------------------------------------------------- */
/* 2. Terrain Grid & Cell Topology                                            */
/* -------------------------------------------------------------------------- */

export type ObstacleType =
  | 'ICE_CREVASSE'
  | 'SERAC_PINNACLE'
  | 'BOULDER_PRESSURE_RIDGE'
  | 'VENT_CRUST'
  | 'CHAOS_FRACTURE';

export interface TerrainCell {
  readonly x: number;
  readonly y: number;
  readonly elevationMetres: number;
  readonly slopeDeg: number;
  readonly roughness: number; // 0.0 (smooth cryo-plane) to 1.0 (impassable chaos)
  readonly hasObstacle: boolean;
  readonly obstacleType?: ObstacleType;
  readonly traversalDifficulty: number; // Difficulty multiplier >= 1.0
  readonly hazardLevel: number; // 0.0 to 1.0 risk factor
  readonly scienceInterestValue: number; // 0 to 100
  readonly featureName?: string;
  readonly isSurveyed: boolean;
  readonly isAnomalyTarget?: boolean;
}

export interface TraverseValidationResult {
  readonly isFeasible: boolean;
  readonly reason?: string;
  readonly distanceMetres: number;
  readonly durationSeconds: number;
  readonly energyCostJoules: number;
  readonly pathCoords: readonly (readonly [number, number])[];
  readonly hazardFactor: number;
}

/* -------------------------------------------------------------------------- */
/* 3. Surface Science Instruments & Observations                              */
/* -------------------------------------------------------------------------- */

export type SurfaceInstrumentId =
  | 'CRYO_DRILL'
  | 'SURFACE_CAM'
  | 'MICRO_SEISMIC'
  | 'THERMAL_PROBE';

export type SurfaceScienceCategory =
  | 'CRYOGENIC_CHEMISTRY'
  | 'SURFACE_GEOLOGY'
  | 'ICE_TECTONICS'
  | 'THERMAL_GRADIENT';

export interface SurfaceInstrument {
  readonly id: SurfaceInstrumentId;
  readonly name: string;
  readonly description: string;
  readonly powerConsumptionWatts: number;
  readonly sampleDurationSeconds: number;
  readonly generatedDataSizeBytes: number;
  readonly status: 'NOMINAL' | 'DEGRADED' | 'FAULT' | 'OFF';
  readonly scienceCategory: SurfaceScienceCategory;
  readonly totalAcquisitions: number;
  readonly provenance: ScientificProvenanceTag;
}

export interface SurfaceObservation {
  readonly id: string;
  readonly instrumentId: SurfaceInstrumentId;
  readonly acquisitionMET: number;
  readonly coords: readonly [number, number];
  readonly qualityPercent: number; // 0 to 100%
  readonly uncertainty: number; // standard error fraction
  readonly sizeBytes: number;
  readonly scienceCategory: SurfaceScienceCategory;
  readonly summary: string;
  readonly rawReading: Record<string, unknown>;
  readonly dataPacketId: string;
  readonly isTransmittedToRelay: boolean;
  readonly provenanceTag: ScientificProvenanceTag;
}

/* -------------------------------------------------------------------------- */
/* 4. Surface Mission Objectives & Decisions                                  */
/* -------------------------------------------------------------------------- */

export interface SurfaceObjective {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly isCompleted: boolean;
  readonly completedAtMET?: number;
  readonly targetValue?: number;
  readonly currentValue?: number;
}

/* -------------------------------------------------------------------------- */
/* 5. Complete Authoritative Rover State                                      */
/* -------------------------------------------------------------------------- */

export interface RoverState {
  readonly roverId: string;
  readonly deploymentState: RoverDeploymentState;
  readonly mobilityState: RoverMobilityState;
  readonly currentCoords: readonly [number, number];
  readonly headingDeg: number;
  readonly distanceTraveledMetres: number;
  readonly batteryEnergyJoules: number;
  readonly batteryCapacityJoules: number;
  readonly powerConsumptionWatts: number;
  readonly operatingMode: RoverOperatingMode;
  readonly internalTemperatureKelvin: number;
  readonly mobilityHealthPercent: number;
  readonly wheelHealthPercents: readonly [number, number, number, number]; // 4 wheels
  readonly cumulativeRadiationRads: number;
  readonly radiationTier?: 'NOMINAL' | 'DEGRADED_250K' | 'CRITICAL_350K';
  readonly instruments: readonly SurfaceInstrument[];
  readonly observations: readonly SurfaceObservation[];
  readonly onboardStorageUsedBytes: number;
  readonly onboardStorageCapacityBytes: number;
  readonly currentActivity?: RoverActivity;
  readonly faultHistory: readonly string[];
  readonly warningHistory: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* 6. Relay Communications & Surface Mission Snapshot                         */
/* -------------------------------------------------------------------------- */

export interface SurfaceRelayState {
  readonly isRelayLinkAvailable: boolean;
  readonly linkBudgetMarginDb: number;
  readonly unseveredLineOfSight: boolean;
  readonly pendingUploadBytes: number;
  readonly totalUploadedToCarrierBytes: number;
}

export interface SurfaceMissionSnapshot {
  readonly isInitialized: boolean;
  readonly landingSite: string;
  readonly parkingOrbitPrerequisiteMet: boolean;
  readonly parkingOrbitAssumptionNotice: string;
  readonly rover: RoverState;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly terrainGrid: readonly (readonly TerrainCell[])[];
  readonly objectives: readonly SurfaceObjective[];
  readonly relay: SurfaceRelayState;
  readonly lastActionStatus?: {
    readonly success: boolean;
    readonly message: string;
    readonly timestampMET: number;
  };
}

/* -------------------------------------------------------------------------- */
/* 7. Authoritative Save / Restore State Serialization                         */
/* -------------------------------------------------------------------------- */

export interface SurfaceSerializedState {
  readonly schemaVersion: number;
  readonly isInitialized: boolean;
  readonly landingSite: string;
  readonly parkingOrbitPrerequisiteMet: boolean;
  readonly rover: RoverState;
  readonly terrainGrid: readonly (readonly TerrainCell[])[];
  readonly objectives: readonly SurfaceObjective[];
  readonly relay: SurfaceRelayState;
}
