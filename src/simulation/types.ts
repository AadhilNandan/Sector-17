/**
 * SECTOR 17 — Simulation Type Definitions
 * Strict types for astrodynamics, rocketry, and mission engineering.
 * All units are SI internally.
 */

/**
 * Parameters for calculating an idealized two-body Hohmann transfer
 */
export interface HohmannTransferParams {
  /** Initial circular orbit radius in metres (e.g. Earth orbit radius) */
  r1: number;
  /** Final circular orbit radius in metres (e.g. Jupiter orbit radius) */
  r2: number;
  /** Standard gravitational parameter of central body in m³/s² (defaults to Sun: MU_SUN) */
  mu?: number;
}

/**
 * Detailed output from a two-body Hohmann transfer computation
 */
export interface HohmannTransferResult {
  /** Transfer ellipse semi-major axis in metres: a = (r1 + r2) / 2 */
  semiMajorAxisMetres: number;
  /** One-way transfer duration in seconds */
  transferTimeSeconds: number;
  /** One-way transfer duration in standard days (86,400 s/day) */
  transferTimeDays: number;
  /** One-way transfer duration in Julian years (365.25 days/year) */
  transferTimeYears: number;
  /** Velocity on transfer orbit at perihelion (r1) in m/s */
  initialTransferVelocityMps: number;
  /** Velocity on transfer orbit at aphelion (r2) in m/s */
  finalTransferVelocityMps: number;
  /** Circular orbital velocity at initial radius (r1) in m/s */
  initialCircularVelocityMps: number;
  /** Circular orbital velocity at final radius (r2) in m/s */
  finalCircularVelocityMps: number;
  /** First impulse Delta-V required at r1 in m/s: |v_t1 - v_c1| */
  departureDeltaVMps: number;
  /** Second impulse Delta-V required at r2 in m/s: |v_c2 - v_t2| */
  arrivalDeltaVMps: number;
  /** Total two-burn transfer Delta-V in m/s: departureDeltaV + arrivalDeltaV */
  totalDeltaVMps: number;
}

/**
 * Complete mass breakdown and performance results from the Tsiolkovsky Rocket Equation
 */
export interface RocketPerformanceResult {
  /** Initial wet mass (dry mass + propellant) in kilograms */
  initialMassKg: number;
  /** Final dry mass in kilograms */
  dryMassKg: number;
  /** Usable propellant mass in kilograms */
  propellantMassKg: number;
  /** Structural mass ratio: m0 / mf */
  massRatio: number;
  /** Propellant mass fraction: m_prop / m0 (0.0 to 1.0) */
  propellantFraction: number;
  /** Achievable ideal Delta-V in metres per second */
  deltaVMps: number;
  /** Effective exhaust velocity in metres per second: Isp * g0 */
  effectiveExhaustVelocityMps: number;
}

/* ========================================================================== */
/* PHASE 2: SPACECRAFT ENGINEERING VALIDATION TYPES                           */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* 1. Mass Budget Types                                                       */
/* -------------------------------------------------------------------------- */

export type MassCategory =
  | 'bus'
  | 'propulsionDry'
  | 'propellant'
  | 'instruments'
  | 'communication'
  | 'power'
  | 'thermal'
  | 'lander'
  | 'rover'
  | 'other';

export interface MassItem {
  id?: string;
  name?: string;
  category: MassCategory;
  massKg: number;
}

export interface MassBudgetInput {
  /** Explicit itemized component list */
  items?: MassItem[];
  /** Explicit category aggregate dictionary (mutually exclusive with items to prevent double-counting) */
  categories?: Partial<Record<MassCategory, number>>;
  /** Configurable launch vehicle payload limit in kg */
  launchMassLimitKg?: number;
  /** Warning threshold margin percentage (e.g. 10%) */
  marginThresholdPercent?: number;
  /** Optional target delta-v in m/s for rocket equation propulsion verification */
  targetDeltaVMps?: number;
  /** Optional engine specific impulse in seconds for rocket equation propulsion verification */
  ispSeconds?: number;
}

export type MassBudgetStatus = 'NOMINAL' | 'WARNING' | 'EXCEEDED' | 'UNKNOWN';

export interface MassBudgetResult {
  categoryBreakdownKg: Record<MassCategory, number>;
  totalDryMassKg: number;
  totalPropellantMassKg: number;
  totalWetMassKg: number;
  payloadMassKg: number;
  payloadFractionWet: number;
  payloadFractionDry: number;
  propellantFraction: number;
  launchMassLimitKg?: number;
  massMarginKg?: number;
  massMarginPercent?: number;
  marginThresholdPercent: number;
  status: MassBudgetStatus;
  isWithinLaunchCapacity: boolean | null;
  warnings: string[];
  errors: string[];
  achievedDeltaVMps?: number;
}

/* -------------------------------------------------------------------------- */
/* 2. Power Budget Types                                                      */
/* -------------------------------------------------------------------------- */

export type PowerSourceType = 'solar' | 'radioisotope' | 'other';

export interface SolarArrayConfig {
  type: 'solar';
  name?: string;
  /** Rated electrical output at 1 AU in Watts */
  ratedPower1AuWatts?: number;
  /** Heliocentric distance in AU */
  distanceAu?: number;
  /** Radiation / environmental degradation factor [0, 1] */
  degradationFactor?: number;
  /** Pointing or sun-tracking efficiency [0, 1] */
  pointingEfficiency?: number;
  /** Operational efficiency factor [0, 1] */
  operationalEfficiency?: number;
}

export interface RadioisotopeSourceConfig {
  type: 'radioisotope';
  name?: string;
  /** Explicitly verified electrical output in Watts */
  ratedPowerWatts?: number;
  /** Degradation factor over mission duration [0, 1] */
  degradationFactor?: number;
}

export interface OtherPowerSourceConfig {
  type: 'other';
  name?: string;
  /** Explicitly verified electrical output in Watts */
  ratedPowerWatts?: number;
}

export type PowerSourceInput = SolarArrayConfig | RadioisotopeSourceConfig | OtherPowerSourceConfig;

export type PowerLoadCategory =
  | 'bus'
  | 'communication'
  | 'instruments'
  | 'thermal'
  | 'dataHandling'
  | 'propulsion'
  | 'lander'
  | 'rover'
  | 'other';

export interface PowerLoadItem {
  id?: string;
  name?: string;
  category: PowerLoadCategory;
  /** Electrical consumption in Watts */
  powerWatts?: number;
  /** Flag denoting whether power data is known and verified */
  isSpecified?: boolean;
}

export interface PowerBudgetInput {
  sources: PowerSourceInput[];
  loads: PowerLoadItem[];
  /** Default or mission heliocentric distance in AU for solar calculations */
  distanceAu?: number;
  /** Configurable reserve threshold percentage (default 20%) */
  reserveThresholdPercent?: number;
  /** Whether the propulsion system is electric, requiring verified electrical input power */
  isElectricPropulsion?: boolean;
  /** Explicit electrical input power in Watts for electric propulsion */
  propulsionElectricalInputPowerWatts?: number;
}

export type PowerBudgetStatus = 'NOMINAL' | 'WARNING' | 'DEFICIT' | 'INCOMPLETE';

export interface PowerBudgetResult {
  totalGenerationWatts: number;
  totalConsumptionWatts: number;
  netPowerWatts: number;
  powerMarginWatts: number;
  powerReservePercent: number;
  powerDeficitWatts: number;
  reserveThresholdPercent: number;
  loadBreakdownWatts: Record<PowerLoadCategory, number>;
  status: PowerBudgetStatus;
  isGenerationKnown: boolean;
  isConsumptionKnown: boolean;
  isPropulsionFeasible: boolean;
  missingData: string[];
  warnings: string[];
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* 3. Thermal Model Types                                                     */
/* -------------------------------------------------------------------------- */

export interface ThermalSolverOptions {
  /** Initial temperature guess in Kelvin (default: 300 K) */
  initialGuessKelvin?: number;
  /** Convergence tolerance in Kelvin (default: 1e-5 K) */
  toleranceKelvin?: number;
  /** Maximum solver iterations (default: 100) */
  maxIterations?: number;
}

export interface ThermalModelInput {
  /** Surface solar absorptivity alpha (0 < alpha <= 1) */
  solarAbsorptivity: number;
  /** Projected area exposed to direct solar flux in m² (A_projected > 0) */
  projectedAreaM2: number;
  /** Infrared surface emissivity epsilon (0 < epsilon <= 1) */
  surfaceEmissivity: number;
  /** Total effective radiating area in m² (A_radiating > 0) */
  radiatingAreaM2: number;
  /** Heliocentric distance in AU (r > 0) */
  distanceAu: number;
  /** Internal electrical heat dissipation in Watts (Q_internal >= 0) */
  internalHeatDissipationWatts?: number;
  /** Deep-space background temperature in Kelvin (default: 2.7255 K) */
  spaceTemperatureKelvin?: number;
  /** Minimum allowable component operating temperature in Kelvin */
  minOperatingTempKelvin?: number;
  /** Maximum allowable component operating temperature in Kelvin */
  maxOperatingTempKelvin?: number;
  /** Solver options */
  solverOptions?: ThermalSolverOptions;
}

export type ThermalStatus = 'NOMINAL' | 'WARNING' | 'OVERHEATING' | 'UNDERCOOLING' | 'NON_CONVERGENT';

export interface ThermalModelResult {
  solarFluxWattsPerM2: number;
  solarAbsorbedPowerWatts: number;
  internalHeatWatts: number;
  totalThermalInWatts: number;
  radiatedPowerWatts: number;
  equilibriumTemperatureKelvin: number;
  equilibriumTemperatureCelsius: number;
  iterations: number;
  converged: boolean;
  status: ThermalStatus;
  isWithinOperatingLimits: boolean;
  minOperatingTempKelvin: number;
  maxOperatingTempKelvin: number;
  warnings: string[];
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* 4. Spacecraft Validator Types                                              */
/* -------------------------------------------------------------------------- */

export type EngineeringValidationStatus = 'PASS' | 'WARNING' | 'FAIL' | 'INCOMPLETE';

export interface SubsystemValidationResult {
  status: EngineeringValidationStatus;
  passed: boolean;
  failures: string[];
  warnings: string[];
  missingData: string[];
}

export interface SpacecraftValidationInput {
  massBudget: MassBudgetResult | MassBudgetInput;
  powerBudget: PowerBudgetResult | PowerBudgetInput;
  thermalModel?: ThermalModelResult | ThermalModelInput;
  componentCompleteness?: {
    missingComponentSpecs?: string[];
    unverifiedComponents?: string[];
  };
}

export interface SpacecraftValidationReport {
  overallStatus: EngineeringValidationStatus;
  subsystems: {
    mass: SubsystemValidationResult;
    power: SubsystemValidationResult;
    thermal: SubsystemValidationResult;
    completeness: SubsystemValidationResult;
  };
  failures: string[];
  warnings: string[];
  missingData: string[];
  metrics: {
    totalDryMassKg: number;
    totalWetMassKg: number;
    launchMassLimitKg?: number;
    massMarginKg?: number;
    massMarginPercent?: number;
    totalPowerGenerationWatts: number;
    totalPowerConsumptionWatts: number;
    netPowerWatts: number;
    powerReservePercent: number;
    equilibriumTemperatureKelvin?: number;
    equilibriumTemperatureCelsius?: number;
  };
}

/* ========================================================================== */
/* PHASE 3: MISSION OPERATIONS ENGINE TYPES                                   */
/* ========================================================================== */

export interface MissionClockState {
  /** Mission elapsed time (MET) in seconds from mission epoch (MET >= 0) */
  metSeconds: number;
  /** Reference epoch timestamp in seconds (e.g. UTC Unix seconds or arbitrary mission origin) */
  epochTimestampSeconds: number;
  /** Absolute simulation timestamp: epochTimestampSeconds + metSeconds */
  currentTimestampSeconds: number;
  /** Whether the simulation time advancement is actively running */
  isRunning: boolean;
  /** Number of discrete time steps executed */
  stepCount: number;
}

export type EventStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';

export interface MissionEvent<T = unknown> {
  /** Unique event identifier */
  id: string;
  /** Event classification type */
  type: string;
  /** Scheduled execution time in Mission Elapsed Time (MET) seconds */
  scheduledTimeSeconds: number;
  /** Immutable event payload data */
  payload: T;
  /** Priority ordering (higher integer = higher execution priority at identical timestamp) */
  priority: number;
  /** Monotonic sequence order assigned upon scheduling for deterministic FIFO tie-breaking */
  sequenceNumber: number;
  /** Current execution status */
  status: EventStatus;
  /** Simulation time in MET seconds when the event was scheduled */
  createdAtSeconds: number;
}

export interface EventScheduleInput<T = unknown> {
  id: string;
  type: string;
  scheduledTimeSeconds: number;
  payload?: T;
  priority?: number;
}

export interface EventExecutionResult<T = unknown, R = unknown> {
  eventId: string;
  eventType: string;
  scheduledTimeSeconds: number;
  executedAtSeconds: number;
  status: 'EXECUTED' | 'FAILED' | 'SKIPPED';
  success: boolean;
  payload: T;
  result?: R;
  error?: string;
}

export interface MissionExecutionContext {
  metSeconds: number;
  currentTimestampSeconds: number;
  stepCount: number;
}

export type MissionEventHandler<T = unknown, R = unknown> = (
  event: MissionEvent<T>,
  context: MissionExecutionContext
) => R | void;

export interface TimeStepExecutionReport {
  previousTimeSeconds: number;
  currentTimeSeconds: number;
  timeAdvancedSeconds: number;
  eventsProcessedCount: number;
  executedEvents: EventExecutionResult[];
  failedEvents: EventExecutionResult[];
  skippedEvents: EventExecutionResult[];
  isPaused: boolean;
  /** Whether the processing loop terminated because it hit maxEventsPerStep */
  stepLimitReached: boolean;
}

export interface PruneEventsOptions {
  /** If provided, only prune events with scheduledTimeSeconds <= olderThanMETSeconds */
  olderThanMETSeconds?: number;
  /** Whether to prune executed events (default: true) */
  removeExecuted?: boolean;
  /** Whether to prune cancelled events (default: true) */
  removeCancelled?: boolean;
  /** Whether to prune failed events (default: true) */
  removeFailed?: boolean;
}

export interface PruneHistoryOptions extends PruneEventsOptions {
  /** If true, also prunes execution records from engine execution history (default: true) */
  pruneExecutionHistory?: boolean;
}

export interface PruneHistoryResult {
  prunedSchedulerEvents: number;
  prunedExecutionReports: number;
}
