/**
 * SECTOR 17 — Europa Surface Exploration Constants & Configuration
 * Physical environmental constants, rover technical baselines, terrain parameters,
 * power/thermal thresholds, and strict scientific provenance tagging.
 *
 * PROVENANCE CLASSIFICATIONS:
 * - VERIFIED: Supported by NASA/ESA planetary science and Galileo/Clipper data.
 * - SIMPLIFIED: Reduced physical model for deterministic gameplay.
 * - FICTIONAL: Mission equipment, rover specifications, or game scenarios.
 * - UNVERIFIED: Preliminary or uncorroborated in-game evidence.
 */

/* -------------------------------------------------------------------------- */
/* 1. Europa Physical Environment Constants                                   */
/* -------------------------------------------------------------------------- */

/** Europa surface gravitational acceleration in m/s² (VERIFIED: Galileo data) */
export const EUROPA_SURFACE_GRAVITY_MPS2 = 1.315;

/** Europa surface atmospheric pressure in bar (VERIFIED: Hard near-vacuum ~10⁻¹² bar) */
export const EUROPA_SURFACE_PRESSURE_BAR = 1e-12;

/** Europa mean surface temperature in Kelvin (VERIFIED: ~100 K / -173 °C) */
export const EUROPA_SURFACE_TEMP_MEAN_KELVIN = 100.0;

/** Europa equatorial daytime peak surface temperature in Kelvin (VERIFIED: ~130 K) */
export const EUROPA_SURFACE_TEMP_DAY_PEAK_KELVIN = 130.0;

/** Europa equatorial night minimum surface temperature in Kelvin (VERIFIED: ~50 K) */
export const EUROPA_SURFACE_TEMP_NIGHT_MIN_KELVIN = 50.0;

/**
 * Surface ionizing radiation absorbed dose rate in rads/second.
 * (SIMPLIFIED: ~180 rad/hour = 1.8 Gy/hr in Jovian magnetosphere belt;
 * Configurable gameplay hazard metric, not an official NASA safety standard).
 */
export const EUROPA_SURFACE_RADIATION_DOSE_RATE_RAD_PER_SEC = 0.05;

/* -------------------------------------------------------------------------- */
/* 2. Rover Engineering Baseline & Power Specifications                       */
/* -------------------------------------------------------------------------- */

/** Surface Rover Call-sign (FICTIONAL: Expedition-V micro-rover asset) */
export const ROVER_ASSET_ID = 'ROVER-PROMETHEUS-IV';
export const ROVER_NAME = 'PROMETHEUS-IV';

/** Rover total dry mass in kg (FICTIONAL: Chassis + avionics + wheels + science payload) */
export const ROVER_MASS_KG = 65.0;

/** Rover battery energy capacity in Watt-hours (FICTIONAL: 800 Wh) */
export const ROVER_BATTERY_CAPACITY_WH = 800.0;

/** Rover battery energy capacity in Joules (1 Wh = 3600 J -> 2,880,000 J) */
export const ROVER_BATTERY_CAPACITY_JOULES = ROVER_BATTERY_CAPACITY_WH * 3600.0;

/** Radioisotope Thermoelectric Generator (RTG) continuous electrical output (Watts) (SIMPLIFIED/FICTIONAL) */
export const ROVER_RTG_POWER_OUTPUT_WATTS = 45.0;

/** Internal thermal heat capacity in Joules/Kelvin (SIMPLIFIED: lumped thermal model) */
export const ROVER_THERMAL_CAPACITY_J_PER_K = 18_000.0;

/** Minimum safe internal operating temperature in Kelvin (SIMPLIFIED: avionics cold limit ~ -40 °C) */
export const ROVER_SAFE_TEMP_MIN_KELVIN = 233.0;

/** Maximum safe internal operating temperature in Kelvin (SIMPLIFIED: avionics hot limit ~ +50 °C) */
export const ROVER_SAFE_TEMP_MAX_KELVIN = 323.0;

/** Nominal internal equilibrium setpoint in Kelvin (~ +15 °C) */
export const ROVER_NOMINAL_INTERNAL_TEMP_KELVIN = 288.15;

/** Cumulative radiation limit in rads before avionics degradation (SIMPLIFIED: 250 krad radiation-hardened) */
export const ROVER_MAX_RADIATION_TOLERANCE_RADS = 250_000.0;

/* -------------------------------------------------------------------------- */
/* 3. Operating Modes & Power Demands (Watts)                                  */
/* -------------------------------------------------------------------------- */

export const ROVER_POWER_DEMANDS_WATTS = {
  SAFE: 15.0,          // Minimal survival heaters + watchdogs
  SLEEP: 18.0,         // Low-power standby + thermal maintenance
  IDLE: 30.0,          // System telemetry, sensor polling, stationary
  TRAVERSE: 95.0,      // Drive motors + steering + hazard-avoidance cameras
  SCIENCE: 65.0,       // Sample acquisition, spectrometers, drill actuation
  COMMUNICATION: 75.0, // UHF transceiver to lander relay
} as const;

/* -------------------------------------------------------------------------- */
/* 4. Mobility, Terrain & Grid Constants                                       */
/* -------------------------------------------------------------------------- */

/** Grid dimensions for local survey site (10 x 10 cells) */
export const SURFACE_GRID_WIDTH = 10;
export const SURFACE_GRID_HEIGHT = 10;

/** Physical width and height of each discrete terrain cell in metres (SIMPLIFIED) */
export const TERRAIN_CELL_SIZE_METRES = 20.0;

/** Nominal traverse speed in m/s (SIMPLIFIED: 5 cm/s = 180 m/hour typical planetary rover pace) */
export const ROVER_NOMINAL_SPEED_MPS = 0.05;

/** Maximum slope in degrees negotiable by rover wheels before tipping/traction failure */
export const ROVER_MAX_TRAVERSABLE_SLOPE_DEG = 25.0;

/** Maximum surface roughness index (0.0 to 1.0) navigable before mechanical stall */
export const ROVER_MAX_TRAVERSABLE_ROUGHNESS = 0.70;

/** Mobility health minimum threshold (percentage) required for autonomous traverse */
export const ROVER_MIN_MOBILITY_HEALTH_PERCENT = 15.0;

/* -------------------------------------------------------------------------- */
/* 5. Surface Communications & Storage Specifications                         */
/* -------------------------------------------------------------------------- */

/** Rover onboard solid-state storage capacity in bytes (FICTIONAL: 500 MB) */
export const ROVER_STORAGE_CAPACITY_BYTES = 500_000_000;

/** Local UHF proximity data rate from Rover to Lander relay in bits/sec (SIMPLIFIED: 64 kbps) */
export const ROVER_TO_LANDER_RELAY_BPS = 64_000;

/**
 * Explicit Mission Architecture Assumption Note:
 * Required by Directive Section 2.1 to prevent unphysical deployment claims.
 */
export const LANDER_ORBITAL_CAPTURE_ASSUMPTION_TEXT =
  'MISSION PREREQUISITE (SIMPLIFIED): Powered descent begins from an assumed 100 km circular Europa parking orbit. Direct atmospheric capture is physically impossible in Europa near-vacuum, and AETHON hyperbolic flyby excess velocity (~4.4 km/s) requires external staging or dedicated insertion.';
