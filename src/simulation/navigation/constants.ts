/**
 * SECTOR 17 — Navigation & Astrodynamics Constants
 * Physical constants, body gravitational parameters, radii, and spacecraft baseline
 * engineering metrics for Jovian carrier AETHON and its independent Europa surface lander.
 *
 * All calculations use SI units internally (metres, seconds, kg, radians).
 * Provenance:
 * - Planetary constants: NASA JPL Planetary Fact Sheets & IAU 2012 resolutions (VERIFIED)
 * - Jovian & Europan gravity: Galileo & Europa Clipper mission baselines (VERIFIED)
 * - Spacecraft masses and propulsion metrics: Expedition-V mission design (SIMPLIFIED)
 */

import { G0, ASTRONOMICAL_UNIT_METRES, MU_SUN, MU_EARTH, MU_JUPITER, MU_EUROPA } from '../constants';

export { G0, ASTRONOMICAL_UNIT_METRES, MU_SUN, MU_EARTH, MU_JUPITER, MU_EUROPA };

/* -------------------------------------------------------------------------- */
/* Physical Radii of Celestial Bodies                                         */
/* -------------------------------------------------------------------------- */

/** Earth mean volumetric radius (m) — NASA JPL */
export const RADIUS_EARTH_METRES = 6_371_000;

/** Jupiter mean volumetric radius (m) — NASA JPL */
export const RADIUS_JUPITER_METRES = 69_911_000;

/** Jupiter equatorial radius (m) — NASA JPL (used for cloud top entry reference) */
export const RADIUS_JUPITER_EQUATORIAL_METRES = 71_492_000;

/** Europa mean radius (m) — NASA JPL Galileo data */
export const RADIUS_EUROPA_METRES = 1_560_800;

/* -------------------------------------------------------------------------- */
/* Orbital Geometry & Ephemerides                                             */
/* -------------------------------------------------------------------------- */

/** Mean Earth orbital radius around Sun (1.0 AU) */
export const EARTH_ORBIT_RADIUS_METRES = 1.0 * ASTRONOMICAL_UNIT_METRES;

/** Mean Jupiter semi-major axis around Sun (5.2044 AU) */
export const JUPITER_ORBIT_RADIUS_METRES = 5.2044 * ASTRONOMICAL_UNIT_METRES;

/** Mean Europa orbital radius around Jupiter (670,900 km) */
export const EUROPA_ORBIT_RADIUS_METRES = 670_900_000;

/** Europa orbital period around Jupiter in seconds (3.551181 days) */
export const EUROPA_ORBIT_PERIOD_SECONDS = 3.551181 * 86_400; // 306,822.04 s

/** Europa mean orbital speed around Jupiter in m/s: sqrt(mu_J / r_Europa) */
export const EUROPA_MEAN_ORBITAL_SPEED_MPS = 13_740; // ~13.74 km/s

/** Maximum flyby distance for high-resolution reconnaissance science (m) */
export const EUROPA_MAX_RECON_DISTANCE_METRES = 5_000_000; // 5,000 km

/** Target close-approach flyby altitude for radar and plume sampling (m) */
export const EUROPA_NOMINAL_FLYBY_ALTITUDE_METRES = 100_000; // 100 km above surface

/* -------------------------------------------------------------------------- */
/* AETHON Carrier Spacecraft Navigation & Propulsion Baseline                 */
/* -------------------------------------------------------------------------- */

/** AETHON dry mass (bus + avionics + instruments + stowed lander package) in kg */
export const AETHON_DRY_MASS_KG = 2_340.0;

/** AETHON usable propellant capacity in kg */
export const AETHON_PROPELLANT_CAPACITY_KG = 2_450.0;

/** AETHON Main Engine Specific Impulse in seconds (hypergolic bipropellant N2O4/MMH) */
export const AETHON_MAIN_ENGINE_ISP_SECONDS = 325.0;

/** AETHON Main Engine Thrust in Newtons */
export const AETHON_MAIN_ENGINE_THRUST_NEWTONS = 450.0;

/** Minimum reserve propellant margin percentage required for mission safety */
export const AETHON_MIN_PROPELLANT_MARGIN_PERCENT = 0.10; // 10%

/* -------------------------------------------------------------------------- */
/* Independent Europa Lander Asset Specifications                            */
/* -------------------------------------------------------------------------- */

/** Separate Lander structural dry mass (structure + legs + avionics + surface package) in kg */
export const LANDER_DRY_MASS_KG = 450.0;

/** Separate Lander bipropellant load in kg */
export const LANDER_PROPELLANT_CAPACITY_KG = 400.0;

/** Total wet mass of lander at deployment from AETHON in kg */
export const LANDER_INITIAL_WET_MASS_KG = LANDER_DRY_MASS_KG + LANDER_PROPELLANT_CAPACITY_KG; // 850.0 kg

/** Lander descent rocket engine specific impulse in seconds */
export const LANDER_ENGINE_ISP_SECONDS = 315.0;

/** Lander descent rocket engine maximum thrust in Newtons (terminal throttleable) */
export const LANDER_ENGINE_MAX_THRUST_NEWTONS = 3_200.0;

/** Maximum allowable vertical touchdown velocity in m/s (structural landing gear limit) */
export const LANDER_MAX_TOUCHDOWN_VERTICAL_VELOCITY_MPS = 2.5;

/** Maximum allowable horizontal touchdown velocity in m/s */
export const LANDER_MAX_TOUCHDOWN_HORIZONTAL_VELOCITY_MPS = 0.5;

/** Europa surface gravitational acceleration in m/s²: mu_Europa / r_Europa² */
export const EUROPA_SURFACE_GRAVITY_MPS2 = 1.315; // m/s²

/* -------------------------------------------------------------------------- */
/* Heliocentric Transfer Flight Dynamics Baselines                            */
/* -------------------------------------------------------------------------- */

/**
 * Theoretical Hohmann Transfer minimum Delta-V from Earth to Jupiter (m/s)
 * Departure: ~8.8 km/s from LEO (or ~3.9 km/s from C3=0)
 * Arrival: ~5.6 km/s at Jupiter orbital distance relative to circular orbit
 */
export const HOHMANN_THEORETICAL_DEPARTURE_DV_MPS = 8_800;
export const HOHMANN_THEORETICAL_ARRIVAL_DV_MPS = 5_643;
export const HOHMANN_THEORETICAL_DURATION_DAYS = 997.0; // ~2.73 years

/**
 * Realistic AETHON Direct Interplanetary Transfer
 * High-energy direct injection with Falcon Heavy / Centaur upper stage,
 * reducing cruise duration to ~1,100 - 1,400 days with active midcourse corrections.
 */
export const REALISTIC_AETHON_TRANSFER_DURATION_DAYS = 1_180.0;
export const REALISTIC_AETHON_DEPARTURE_C3_KM2PS2 = 41.7; // Falcon Heavy class injection
