/**
 * SECTOR 17 — Navigation & Astrodynamics Types
 * Strict typing for Keplerian mechanics, interplanetary trajectories, Jovian capture,
 * Europa flyby reconnaissance, and separate surface lander powered descent.
 *
 * All physical values use standard SI units internally (m, s, kg, rad, N).
 */

/* -------------------------------------------------------------------------- */
/* 1. Validation & Feasibility Statuses                                       */
/* -------------------------------------------------------------------------- */

export type ValidationStatus = 'PASS' | 'WARNING' | 'FAIL' | 'INCOMPLETE';

export interface ManeuverValidationReport {
  readonly status: ValidationStatus;
  readonly isFeasible: boolean;
  readonly reasons: readonly string[];
  readonly requiredDeltaVMps: number;
  readonly requiredPropellantKg: number;
  readonly availablePropellantKg: number;
  readonly propellantMarginKg: number;
  readonly burnDurationSeconds: number;
  readonly initialMassKg: number;
  readonly finalMassKg: number;
}

/* -------------------------------------------------------------------------- */
/* 2. Celestial & Orbital Elements                                            */
/* -------------------------------------------------------------------------- */

export type CentralBody = 'SUN' | 'EARTH' | 'JUPITER' | 'EUROPA';

export interface OrbitalElements {
  readonly centralBody: CentralBody;
  readonly semiMajorAxisMetres: number;
  readonly eccentricity: number;
  readonly periapsisRadiusMetres: number;
  readonly apoapsisRadiusMetres: number;
  readonly orbitalPeriodSeconds: number;
  readonly specificOrbitalEnergyJPerKg: number;
  readonly inclinationRad: number;
  readonly trueAnomalyRad: number;
  /** Mean orbital speed in m/s at current semi-major axis */
  readonly currentVelocityMps: number;
}

/* -------------------------------------------------------------------------- */
/* 3. Heliocentric Trajectory Models                                          */
/* -------------------------------------------------------------------------- */

export type TransferType = 'HOHMANN_BASELINE' | 'REALISTIC_DIRECT';

export interface HeliocentricTrajectoryModel {
  readonly transferType: TransferType;
  readonly departureBody: 'EARTH';
  readonly arrivalBody: 'JUPITER';
  readonly departureRadiusMetres: number;
  readonly arrivalRadiusMetres: number;
  readonly semiMajorAxisMetres: number;
  readonly transferTimeSeconds: number;
  readonly transferTimeDays: number;
  readonly departureDeltaVMps: number;
  readonly arrivalDeltaVMps: number;
  readonly totalDeltaVMps: number;
  readonly c3LaunchEnergyKm2ps2: number;
  readonly departureVelocityVectorMps: readonly [number, number, number];
  readonly arrivalVelocityVectorMps: readonly [number, number, number];
  /** Explicit provenance flag: Hohmann is a theoretical minimum energy baseline */
  readonly isTheoreticalBaseline: boolean;
  readonly description: string;
}

/* -------------------------------------------------------------------------- */
/* 4. Jupiter Arrival and Orbit Insertion (JOI)                               */
/* -------------------------------------------------------------------------- */

export interface JupiterCaptureState {
  readonly arrivalVelocityInfinityMps: number;
  readonly perijoveRadiusMetres: number;
  readonly perijoveAltitudeMetres: number;
  readonly perijoveVelocityMps: number;
  readonly captureDeltaVMps: number;
  readonly capturedOrbit: OrbitalElements;
  readonly isCaptured: boolean;
  readonly captureBurnExecutedAtMET?: number;
}

/* -------------------------------------------------------------------------- */
/* 5. Europa Ephemeris & Reconnaissance Flyby                                 */
/* -------------------------------------------------------------------------- */

export interface EuropaRelativeState {
  readonly europaOrbitalRadiusMetres: number;
  readonly europaPhaseAngleRad: number;
  readonly aethonDistanceToJupiterMetres: number;
  readonly aethonPhaseAngleRad: number;
  readonly relativeDistanceMetres: number;
  readonly relativeVelocityMps: number;
  readonly isWithinObservationWindow: boolean;
  readonly observationQualityPercent: number;
}

export interface EuropaFlybyState {
  readonly currentEuropaDistanceMetres: number;
  readonly closestApproachDistanceMetres: number;
  readonly relativeVelocityMps: number;
  readonly inObservationWindow: boolean;
  readonly observationWindowStartMET?: number;
  readonly observationWindowEndMET?: number;
  readonly totalFlybysCompleted: number;
  readonly reconnaissanceDataAcquired: boolean;
  readonly highResolutionScansCompleted: number;
}

/* -------------------------------------------------------------------------- */
/* 6. Independent Surface Lander Asset & Powered Descent                      */
/* -------------------------------------------------------------------------- */

export type LanderFlightState =
  | 'STOWED'        // Stowed aboard carrier spacecraft AETHON
  | 'DEPLOYED'      // Separated from AETHON in Jovian orbit
  | 'DEORBITING'    // Executing deorbit impulse toward Europa
  | 'DESCENT'       // Near-vacuum rocket powered terminal descent
  | 'TOUCHDOWN'     // Safely landed on Europa surface
  | 'CRASHED';      // Terminal descent failure (overspeed or fuel exhaustion)

export interface LanderState {
  readonly flightState: LanderFlightState;
  readonly deployedAtMET?: number;
  readonly dryMassKg: number;
  readonly propellantRemainingKg: number;
  readonly propellantCapacityKg: number;
  readonly totalMassKg: number;
  readonly altitudeMetres: number;
  readonly verticalVelocityMps: number;
  readonly horizontalVelocityMps: number;
  readonly targetLandingSite: string;
  readonly terrainHazardFactor: number; // 0.0 (smooth plains) to 1.0 (impassable chaos terrain)
  readonly descentDeltaVExpendedMps: number;
  readonly remainingDeltaVCapacityMps: number;
  readonly touchdownAtMET?: number;
  readonly touchdownVerticalVelocityMps?: number;
  readonly touchdownHorizontalVelocityMps?: number;
  readonly failureReason?: string;
  readonly parkingOrbitPrerequisiteMet?: boolean;
  readonly parkingOrbitAssumptionNotice?: string;
}

/* -------------------------------------------------------------------------- */
/* 7. Maneuver Planning & Execution Records                                   */
/* -------------------------------------------------------------------------- */

export type ManeuverType =
  | 'TRANS_JOVIAN_INJECTION'
  | 'MIDCOURSE_CORRECTION'
  | 'JUPITER_APPROACH'
  | 'JUPITER_ORBIT_INSERTION'
  | 'EUROPA_FLYBY_TARGETING'
  | 'LANDER_DEPLOYMENT'
  | 'LANDER_DEORBIT'
  | 'LANDER_POWERED_DESCENT';

export interface ManeuverPlan {
  readonly id: string;
  readonly type: ManeuverType;
  readonly title: string;
  readonly description: string;
  readonly targetBody: CentralBody;
  readonly deltaVMps: number;
  readonly plannedMETSeconds: number;
  readonly estimatedPropellantKg: number;
  readonly estimatedBurnDurationSeconds: number;
  readonly isExecuted: boolean;
  readonly executedAtMET?: number;
}

export interface ManeuverExecutionResult {
  readonly success: boolean;
  readonly maneuverId: string;
  readonly maneuverType: ManeuverType;
  readonly executedAtMET: number;
  readonly actualDeltaVMps: number;
  readonly propellantConsumedKg: number;
  readonly resultingOrbit?: OrbitalElements;
  readonly validationReport: ManeuverValidationReport;
  readonly failureReason?: string;
}

/* -------------------------------------------------------------------------- */
/* 8. Mission Phase Navigation Snapshot (Exposed to UI & Runtime)             */
/* -------------------------------------------------------------------------- */

export type NavigationPhase =
  | 'PRE_LAUNCH'
  | 'HELIOCENTRIC_CRUISE'
  | 'JUPITER_APPROACH'
  | 'JOVIAN_ORBIT'
  | 'EUROPA_RECONNAISSANCE'
  | 'LANDER_DESCENT'
  | 'SURFACE_OPERATIONS';

export interface NavigationSnapshot {
  readonly currentPhase: NavigationPhase;
  readonly centralBody: CentralBody;
  readonly currentOrbit: OrbitalElements;
  readonly heliocentricTrajectory: HeliocentricTrajectoryModel;
  readonly jupiterCapture: JupiterCaptureState;
  readonly europaFlyby: EuropaFlybyState;
  readonly lander: LanderState;
  readonly availableManeuvers: readonly ManeuverPlan[];
  readonly executedManeuvers: readonly ManeuverExecutionResult[];
  readonly lastValidationReport?: ManeuverValidationReport;
  readonly totalDeltaVExpendedMps: number;
  readonly totalPropellantBurnedKg: number;
  readonly reconScanSequence?: number;
  readonly eventCounter?: number;
  readonly isParkingOrbitBypassActive?: boolean;
  readonly parkingOrbitBypassNotice?: string;
}

/* -------------------------------------------------------------------------- */
/* 9. Serialized Navigation State for Authoritative Save/Restore              */
/* -------------------------------------------------------------------------- */

export interface NavigationSerializedState {
  readonly schemaVersion: number;
  readonly currentPhase: NavigationPhase;
  readonly centralBody: CentralBody;
  readonly currentOrbit: OrbitalElements;
  readonly heliocentricTrajectory: HeliocentricTrajectoryModel;
  readonly jupiterCapture: JupiterCaptureState;
  readonly europaFlyby: EuropaFlybyState;
  readonly lander: LanderState;
  readonly plannedManeuvers: readonly ManeuverPlan[];
  readonly executedManeuvers: readonly ManeuverExecutionResult[];
  readonly totalDeltaVExpendedMps: number;
  readonly totalPropellantBurnedKg: number;
  readonly reconScanSequence?: number;
  readonly eventCounter?: number;
  readonly isParkingOrbitBypassActive?: boolean;
  readonly parkingOrbitBypassNotice?: string;
}
