/**
 * SECTOR 17 — Deep-Space Communications & Ground Segment Constants
 * Physical constants, standard radio bands, and operational thresholds.
 * All units are standard SI internally.
 */

import { SPEED_OF_LIGHT, ASTRONOMICAL_UNIT_METRES } from '../constants';

export { SPEED_OF_LIGHT, ASTRONOMICAL_UNIT_METRES };

/**
 * Boltzmann constant (exact SI definition from CODATA 2018)
 * Units: J / K  (or W / (Hz · K))
 */
export const BOLTZMANN_CONSTANT = 1.380649e-23;

/**
 * Standard Deep Space RF Carrier Frequency Allocations (ITU / CCSDS / NASA DSN)
 * Units: Hertz (Hz)
 */
export const FREQUENCY_S_BAND_UPLINK_HZ = 2.115e9; // 2.115 GHz
export const FREQUENCY_S_BAND_DOWNLINK_HZ = 2.295e9; // 2.295 GHz

export const FREQUENCY_X_BAND_UPLINK_HZ = 7.165e9; // 7.165 GHz
export const FREQUENCY_X_BAND_DOWNLINK_HZ = 8.425e9; // 8.425 GHz

export const FREQUENCY_KA_BAND_UPLINK_HZ = 34.45e9; // 34.45 GHz
export const FREQUENCY_KA_BAND_DOWNLINK_HZ = 32.05e9; // 32.05 GHz

/**
 * Default Parabolic Antenna Aperture Efficiency
 * Dimensionless factor [0, 1] (Typical shaped Cassegrain deep-space reflector)
 */
export const DEFAULT_ANTENNA_EFFICIENCY = 0.65;

/**
 * Default Minimum Ground Station Horizon Mask Elevation
 * Below this angle, atmospheric noise, ground multipath, and tropospheric absorption degrade link
 * Units: Degrees
 */
export const DEFAULT_MIN_ELEVATION_DEG = 10.0;

/**
 * Earth Mean Sidereal Rotation Rate
 * Angular speed of Earth's rotation relative to vernal equinox
 * Units: radians per second (360° / 86164.0905 s)
 */
export const EARTH_ROTATION_RATE_RAD_PER_SEC = 7.2921159e-5;

/**
 * Standard Required Link Margin for Critical Deep Space Operations
 * Units: Decibels (dB)
 */
export const DEFAULT_REQUIRED_LINK_MARGIN_DB = 3.0;

/**
 * Default Eb/N0 Required for High-Performance Deep-Space FEC Codes
 * (e.g., CCSDS LDPC rate 1/2 or Turbo code with QPSK at BER 1e-6)
 * Units: Decibels (dB)
 */
export const DEFAULT_REQUIRED_EB_N0_DB = 2.5;

/**
 * Default Spacecraft Onboard Data Storage Limit
 * 128 Gigabytes (128 * 1024^3 bytes)
 */
export const DEFAULT_STORAGE_CAPACITY_BYTES = 128 * 1024 * 1024 * 1024;

/**
 * Typed Communication Event Names for MissionEventEngine Integration
 */
export const COMM_EVENT_TYPES = {
  WINDOW_OPEN: 'COMM_WINDOW_OPEN',
  WINDOW_CLOSE: 'COMM_WINDOW_CLOSE',
  UPLINK_STARTED: 'UPLINK_TRANSMISSION_STARTED',
  UPLINK_ARRIVED: 'UPLINK_COMMAND_ARRIVED',
  COMMAND_ACKNOWLEDGED: 'COMMAND_ACKNOWLEDGED',
  DOWNLINK_STARTED: 'DOWNLINK_TRANSMISSION_STARTED',
  DOWNLINK_DATA_RECEIVED: 'DOWNLINK_DATA_RECEIVED',
  COMM_FAILURE: 'COMMUNICATION_FAILURE',
} as const;
