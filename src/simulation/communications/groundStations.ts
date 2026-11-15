/**
 * SECTOR 17 — Ground Stations Model
 * Represents Earth-based deep-space tracking stations, antenna parameters,
 * geographic locations, operating bands, and availability constraints.
 *
 * NOTE ON DSN DATA: The Goldstone, Madrid, and Canberra stations provided below
 * are configured with publicly available illustrative parameters (70m & 34m aperture sizes,
 * nominal coordinates, and typical microwave receiver noise temperatures).
 * They are labeled `isIllustrative: true` and are intended for simulation gameplay,
 * not official NASA JPL operational flight scheduling.
 */

import { DEFAULT_ANTENNA_EFFICIENCY, DEFAULT_MIN_ELEVATION_DEG } from './constants';
import type { GroundStation, FrequencyBand, StationBlackoutPeriod } from './types';

/**
 * Validates and instantiates an immutable GroundStation specification.
 *
 * @throws TypeError on invalid types or non-finite numbers
 * @throws RangeError on values outside physical domains
 */
export function createGroundStation(input: GroundStation): Readonly<GroundStation> {
  if (!input || typeof input !== 'object') {
    throw new TypeError('createGroundStation: Input must be an object.');
  }

  if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
    throw new TypeError('createGroundStation: Station ID must be a non-empty string.');
  }

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new TypeError('createGroundStation: Station name must be a non-empty string.');
  }

  if (typeof input.latitudeDeg !== 'number' || !Number.isFinite(input.latitudeDeg)) {
    throw new TypeError(`createGroundStation: Latitude must be a finite number. Received: ${input.latitudeDeg}`);
  }
  if (input.latitudeDeg < -90 || input.latitudeDeg > 90) {
    throw new RangeError(`createGroundStation: Latitude must be between -90 and +90 degrees. Received: ${input.latitudeDeg}`);
  }

  if (typeof input.longitudeDeg !== 'number' || !Number.isFinite(input.longitudeDeg)) {
    throw new TypeError(`createGroundStation: Longitude must be a finite number. Received: ${input.longitudeDeg}`);
  }
  if (input.longitudeDeg < -180 || input.longitudeDeg > 180) {
    throw new RangeError(`createGroundStation: Longitude must be between -180 and +180 degrees. Received: ${input.longitudeDeg}`);
  }

  if (typeof input.antennaDiameterMetres !== 'number' || !Number.isFinite(input.antennaDiameterMetres) || input.antennaDiameterMetres <= 0) {
    throw new RangeError(`createGroundStation: Antenna diameter must be a positive number. Received: ${input.antennaDiameterMetres} m`);
  }

  if (!Array.isArray(input.supportedBands) || input.supportedBands.length === 0) {
    throw new TypeError('createGroundStation: supportedBands must be a non-empty array of frequency bands.');
  }
  const validBands: FrequencyBand[] = ['S', 'X', 'Ka'];
  for (const band of input.supportedBands) {
    if (!validBands.includes(band)) {
      throw new TypeError(`createGroundStation: Unsupported frequency band '${band}'. Valid bands: ${validBands.join(', ')}`);
    }
  }

  if (typeof input.maxTransmitPowerWatts !== 'number' || !Number.isFinite(input.maxTransmitPowerWatts) || input.maxTransmitPowerWatts < 0) {
    throw new RangeError(`createGroundStation: maxTransmitPowerWatts must be non-negative. Received: ${input.maxTransmitPowerWatts}`);
  }

  if (typeof input.systemNoiseTempKelvin !== 'number' || !Number.isFinite(input.systemNoiseTempKelvin) || input.systemNoiseTempKelvin <= 0) {
    throw new RangeError(`createGroundStation: systemNoiseTempKelvin must be positive. Received: ${input.systemNoiseTempKelvin}`);
  }

  const minElevationDeg = input.minElevationDeg !== undefined ? input.minElevationDeg : DEFAULT_MIN_ELEVATION_DEG;
  if (typeof minElevationDeg !== 'number' || !Number.isFinite(minElevationDeg) || minElevationDeg < 0 || minElevationDeg >= 90) {
    throw new RangeError(`createGroundStation: minElevationDeg must be in [0, 90) degrees. Received: ${minElevationDeg}`);
  }

  const operationalAvailability = input.operationalAvailability !== undefined ? input.operationalAvailability : 1.0;
  if (typeof operationalAvailability !== 'number' || !Number.isFinite(operationalAvailability) || operationalAvailability < 0 || operationalAvailability > 1) {
    throw new RangeError(`createGroundStation: operationalAvailability must be in [0, 1]. Received: ${operationalAvailability}`);
  }

  const antennaEfficiency = input.antennaEfficiency !== undefined ? input.antennaEfficiency : DEFAULT_ANTENNA_EFFICIENCY;
  if (typeof antennaEfficiency !== 'number' || !Number.isFinite(antennaEfficiency) || antennaEfficiency <= 0 || antennaEfficiency > 1) {
    throw new RangeError(`createGroundStation: antennaEfficiency must be in (0, 1]. Received: ${antennaEfficiency}`);
  }

  let blackouts: StationBlackoutPeriod[] = [];
  if (input.blackouts) {
    if (!Array.isArray(input.blackouts)) {
      throw new TypeError('createGroundStation: blackouts must be an array.');
    }
    for (const b of input.blackouts) {
      if (typeof b.startMETSeconds !== 'number' || !Number.isFinite(b.startMETSeconds) || b.startMETSeconds < 0) {
        throw new TypeError('createGroundStation: blackout startMETSeconds must be a non-negative finite number.');
      }
      if (typeof b.endMETSeconds !== 'number' || !Number.isFinite(b.endMETSeconds) || b.endMETSeconds < b.startMETSeconds) {
        throw new RangeError('createGroundStation: blackout endMETSeconds must be greater than or equal to startMETSeconds.');
      }
      blackouts.push(Object.freeze({ ...b }));
    }
  }

  const station: GroundStation = {
    id: input.id.trim(),
    name: input.name.trim(),
    latitudeDeg: input.latitudeDeg,
    longitudeDeg: input.longitudeDeg,
    altitudeMetres: input.altitudeMetres,
    antennaDiameterMetres: input.antennaDiameterMetres,
    supportedBands: [...input.supportedBands],
    maxTransmitPowerWatts: input.maxTransmitPowerWatts,
    antennaEfficiency,
    antennaGainDbi: input.antennaGainDbi,
    systemNoiseTempKelvin: input.systemNoiseTempKelvin,
    minElevationDeg,
    operationalAvailability,
    blackouts: Object.freeze(blackouts) as unknown as StationBlackoutPeriod[],
    isIllustrative: Boolean(input.isIllustrative),
  };

  return Object.freeze(station);
}

/**
 * Checks if a ground station is currently available (not in a planned maintenance blackout).
 *
 * @param station GroundStation
 * @param metSeconds Current simulation time in MET seconds
 * @returns boolean
 */
export function isStationAvailableAtMET(station: GroundStation, metSeconds: number): boolean {
  if (typeof metSeconds !== 'number' || !Number.isFinite(metSeconds)) {
    throw new TypeError(`isStationAvailableAtMET: metSeconds must be a finite number. Received: ${metSeconds}`);
  }

  if (station.blackouts && station.blackouts.length > 0) {
    for (const b of station.blackouts) {
      if (metSeconds >= b.startMETSeconds && metSeconds <= b.endMETSeconds) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Illustrative Deep Space Network (DSN) complexes based on publicly known
 * coordinates and 70m/34m aperture dimensions.
 */
export const ILLUSTRATIVE_DSN_GOLDSTONE_70M = createGroundStation({
  id: 'DSN-GOLDSTONE-70M',
  name: 'Goldstone Deep Space Communications Complex (DSS-14 70m)',
  latitudeDeg: 35.4267, // Mojave Desert, California
  longitudeDeg: -116.89,
  altitudeMetres: 1036,
  antennaDiameterMetres: 70.0,
  supportedBands: ['S', 'X', 'Ka'],
  maxTransmitPowerWatts: 20_000, // 20 kW transmitter
  systemNoiseTempKelvin: 18.5, // Cryogenic LNA noise temp in Kelvin (illustrative)
  minElevationDeg: 10.0,
  operationalAvailability: 0.98,
  isIllustrative: true,
});

export const ILLUSTRATIVE_DSN_MADRID_70M = createGroundStation({
  id: 'DSN-MADRID-70M',
  name: 'Madrid Deep Space Communications Complex (DSS-63 70m)',
  latitudeDeg: 40.4314, // Robledo de Chavela, Spain
  longitudeDeg: -4.248,
  altitudeMetres: 835,
  antennaDiameterMetres: 70.0,
  supportedBands: ['S', 'X', 'Ka'],
  maxTransmitPowerWatts: 20_000,
  systemNoiseTempKelvin: 20.0,
  minElevationDeg: 10.0,
  operationalAvailability: 0.98,
  isIllustrative: true,
});

export const ILLUSTRATIVE_DSN_CANBERRA_70M = createGroundStation({
  id: 'DSN-CANBERRA-70M',
  name: 'Canberra Deep Space Communications Complex (DSS-43 70m)',
  latitudeDeg: -35.4014, // Tidbinbilla, Australia
  longitudeDeg: 148.9817,
  altitudeMetres: 650,
  antennaDiameterMetres: 70.0,
  supportedBands: ['S', 'X', 'Ka'],
  maxTransmitPowerWatts: 20_000,
  systemNoiseTempKelvin: 19.0,
  minElevationDeg: 10.0,
  operationalAvailability: 0.98,
  isIllustrative: true,
});

/**
 * Standard tripartite Deep Space Network constellation covering 120° longitude intervals
 */
export const DEFAULT_ILLUSTRATIVE_STATIONS: ReadonlyArray<Readonly<GroundStation>> = Object.freeze([
  ILLUSTRATIVE_DSN_GOLDSTONE_70M,
  ILLUSTRATIVE_DSN_MADRID_70M,
  ILLUSTRATIVE_DSN_CANBERRA_70M,
]);
