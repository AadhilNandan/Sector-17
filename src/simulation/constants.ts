/**
 * SECTOR 17 — Astrodynamics & Physics Constants
 * All physical and astronomical constants are defined in standard SI units
 * based on IAU, CODATA, and NASA JPL standards.
 */

/**
 * Standard acceleration of gravity on Earth (exact ISO definition)
 * Units: m/s²
 */
export const G0 = 9.80665;

/**
 * 1 Astronomical Unit (AU) in metres (exact IAU 2012 resolution B2)
 * Units: m
 */
export const ASTRONOMICAL_UNIT_METRES = 149_597_870_700;

/**
 * Speed of light in vacuum (exact SI definition)
 * Units: m/s
 */
export const SPEED_OF_LIGHT = 299_792_458;

/**
 * Heliocentric gravitational parameter (GM of the Sun, IAU standard)
 * Units: m³/s²
 */
export const MU_SUN = 1.32712440018e20;

/**
 * Geocentric gravitational parameter (GM of the Earth, WGS-84 / NASA JPL)
 * Units: m³/s²
 */
export const MU_EARTH = 3.986004418e14;

/**
 * Jovian gravitational parameter (GM of the Jupiter system, NASA JPL)
 * Units: m³/s²
 */
export const MU_JUPITER = 1.26686534e17;

/**
 * Europan gravitational parameter (GM of Europa, Galileo mission data)
 * Units: m³/s²
 */
export const MU_EUROPA = 3.20273e12;

/**
 * Mean orbital radius of Earth around the Sun (1 AU)
 * Units: m
 */
export const EARTH_ORBITAL_RADIUS_M = 1.0 * ASTRONOMICAL_UNIT_METRES;

/**
 * Nominal mean orbital radius of Jupiter around the Sun (5.2 AU)
 * Units: m
 */
export const JUPITER_ORBITAL_RADIUS_M = 5.2 * ASTRONOMICAL_UNIT_METRES;

/**
 * Time Conversion Constants
 */
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;
export const DAYS_PER_JULIAN_YEAR = 365.25;
export const SECONDS_PER_JULIAN_YEAR = DAYS_PER_JULIAN_YEAR * SECONDS_PER_DAY; // 31,557,600 s

/**
 * Stefan-Boltzmann constant (CODATA 2018 standard)
 * Units: W / (m² · K⁴)
 */
export const STEFAN_BOLTZMANN_CONSTANT = 5.670374419e-8;

/**
 * Total Solar Irradiance (TSI) at 1 Astronomical Unit (WMO / SORCE solar constant)
 * Units: W/m²
 */
export const SOLAR_CONSTANT_1AU = 1361.0;

/**
 * Cosmic Microwave Background (CMB) deep-space background temperature
 * Units: K
 */
export const DEEP_SPACE_TEMPERATURE_KELVIN = 2.7255;

/**
 * Offset between Celsius and Kelvin temperature scales: T(K) = T(°C) + 273.15
 */
export const CELSIUS_KELVIN_OFFSET = 273.15;

/**
 * Default engineering margin and reserve thresholds
 */
export const DEFAULT_MASS_MARGIN_PERCENT = 10.0;
export const DEFAULT_POWER_RESERVE_PERCENT = 20.0;
export const DEFAULT_MIN_OPERATING_TEMP_KELVIN = 233.15; // -40°C
export const DEFAULT_MAX_OPERATING_TEMP_KELVIN = 333.15; // +60°C

/**
 * Mission Operations Constants (Phase 3 & Phase 3.1)
 */
export const DEFAULT_MISSION_EPOCH_SECONDS = 0;
export const DEFAULT_EVENT_PRIORITY = 100;

/**
 * Default limit on events processed during a single simulation advance step (Phase 3.1)
 * Prevents runaway infinite loops when events dynamically schedule same-timestamp child events.
 */
export const DEFAULT_MAX_EVENTS_PER_STEP = 1000;
