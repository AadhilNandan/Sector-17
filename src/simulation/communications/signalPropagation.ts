/**
 * SECTOR 17 — Signal Propagation Module
 * Computes speed-of-light delays, round-trip times, and signal propagation timelines
 * for interplanetary deep-space communication links.
 * All units are standard SI internally.
 */

import { SPEED_OF_LIGHT } from './constants';
import { auToMetres, metresToAu } from '../physics/orbitalMechanics';
import type { PropagationDelayResult, SignalTimelineInput, SignalTimelineResult } from './types';

export { auToMetres, metresToAu };

/**
 * Validates that distance is a finite, non-negative number.
 * @throws TypeError if distance is not a finite number
 * @throws RangeError if distance is negative
 */
export function validateDistance(distanceMetres: number, label: string = 'Distance'): number {
  if (typeof distanceMetres !== 'number' || !Number.isFinite(distanceMetres)) {
    throw new TypeError(`${label} must be a finite number. Received: ${distanceMetres}`);
  }
  if (distanceMetres < 0) {
    throw new RangeError(`${label} cannot be negative. Received: ${distanceMetres} m`);
  }
  return distanceMetres;
}

/**
 * Converts kilometres to metres
 */
export function kmToMetres(distanceKm: number): number {
  return validateDistance(distanceKm, 'Distance (km)') * 1000;
}

/**
 * Converts metres to kilometres
 */
export function metresToKm(distanceMetres: number): number {
  return validateDistance(distanceMetres, 'Distance (m)') / 1000;
}

/**
 * Calculates One-Way Light Time (OWLT) in seconds:
 * t = distance / c
 *
 * @param distanceMetres Distance in metres (distanceMetres >= 0)
 * @returns One-way light time in seconds
 */
export function calculateOneWayLightTime(distanceMetres: number): number {
  const d = validateDistance(distanceMetres, 'Distance (m)');
  return d / SPEED_OF_LIGHT;
}

/**
 * Calculates Round-Trip Light Time (RTT / RTLT) in seconds:
 * RTT = 2 * distance / c
 *
 * @param distanceMetres Distance in metres (distanceMetres >= 0)
 * @returns Round-trip light time in seconds
 */
export function calculateRoundTripLightTime(distanceMetres: number): number {
  return 2 * calculateOneWayLightTime(distanceMetres);
}

/**
 * Calculates comprehensive propagation delay metrics for a given distance.
 */
export function calculatePropagationDelay(distanceMetres: number): PropagationDelayResult {
  const d = validateDistance(distanceMetres, 'Distance (m)');
  const owlt = calculateOneWayLightTime(d);
  const rtlt = calculateRoundTripLightTime(d);

  return {
    distanceMetres: d,
    distanceKm: metresToKm(d),
    distanceAu: metresToAu(d),
    oneWayLightTimeSeconds: owlt,
    roundTripLightTimeSeconds: rtlt,
  };
}

/**
 * Computes an end-to-end signal propagation timeline separating transmission
 * duration from speed-of-light propagation delays.
 *
 * Timeline Stages:
 * 1. Earth transmission begins at txStartTime.
 * 2. Earth transmission ends at txEndTime = txStartTime + (bits / dataRate).
 * 3. Signal wavefront reaches AETHON at rxStartTime = txStartTime + OWLT.
 * 4. Last bit arrives at AETHON at rxEndTime = txEndTime + OWLT.
 * 5. Spacecraft processes command during processingDelaySeconds.
 * 6. Spacecraft begins acknowledgement downlink at ackTxStartTime = rxEndTime + processingDelay.
 * 7. Spacecraft finishes acknowledgement at ackTxEndTime = ackTxStartTime + ackTxDuration.
 * 8. Acknowledgement arrives at Earth at ackRxEndTime = ackTxEndTime + OWLT.
 */
export function calculateSignalTimeline(input: SignalTimelineInput): SignalTimelineResult {
  if (!input || typeof input !== 'object') {
    throw new TypeError('calculateSignalTimeline: Input must be an object.');
  }

  const {
    txStartTimeMETSeconds,
    dataSizeBytes,
    dataRateBps,
    distanceMetres,
    processingDelaySeconds = 0,
    ackSizeBytes,
    ackDataRateBps,
  } = input;

  if (typeof txStartTimeMETSeconds !== 'number' || !Number.isFinite(txStartTimeMETSeconds) || txStartTimeMETSeconds < 0) {
    throw new TypeError(`calculateSignalTimeline: txStartTimeMETSeconds must be a non-negative finite number. Received: ${txStartTimeMETSeconds}`);
  }
  if (typeof dataSizeBytes !== 'number' || !Number.isFinite(dataSizeBytes) || dataSizeBytes < 0) {
    throw new TypeError(`calculateSignalTimeline: dataSizeBytes must be a non-negative finite number. Received: ${dataSizeBytes}`);
  }
  if (typeof dataRateBps !== 'number' || !Number.isFinite(dataRateBps) || dataRateBps <= 0) {
    throw new TypeError(`calculateSignalTimeline: dataRateBps must be a positive finite number. Received: ${dataRateBps}`);
  }
  if (typeof processingDelaySeconds !== 'number' || !Number.isFinite(processingDelaySeconds) || processingDelaySeconds < 0) {
    throw new TypeError(`calculateSignalTimeline: processingDelaySeconds must be a non-negative finite number. Received: ${processingDelaySeconds}`);
  }

  const owlt = calculateOneWayLightTime(distanceMetres);
  const rtlt = calculateRoundTripLightTime(distanceMetres);

  // Transmission duration: (bytes * 8 bits/byte) / (bits/second)
  const txDurationSeconds = (dataSizeBytes * 8) / dataRateBps;
  const txEndTimeMETSeconds = txStartTimeMETSeconds + txDurationSeconds;

  const rxStartTimeMETSeconds = txStartTimeMETSeconds + owlt;
  const rxEndTimeMETSeconds = txEndTimeMETSeconds + owlt;

  let ackTxStartTimeMETSeconds: number | undefined;
  let ackTxEndTimeMETSeconds: number | undefined;
  let ackRxEndTimeMETSeconds: number | undefined;

  if (ackSizeBytes !== undefined && ackDataRateBps !== undefined) {
    if (typeof ackSizeBytes !== 'number' || !Number.isFinite(ackSizeBytes) || ackSizeBytes < 0) {
      throw new TypeError(`calculateSignalTimeline: ackSizeBytes must be a non-negative finite number. Received: ${ackSizeBytes}`);
    }
    if (typeof ackDataRateBps !== 'number' || !Number.isFinite(ackDataRateBps) || ackDataRateBps <= 0) {
      throw new TypeError(`calculateSignalTimeline: ackDataRateBps must be a positive finite number. Received: ${ackDataRateBps}`);
    }

    ackTxStartTimeMETSeconds = rxEndTimeMETSeconds + processingDelaySeconds;
    const ackTxDurationSeconds = (ackSizeBytes * 8) / ackDataRateBps;
    ackTxEndTimeMETSeconds = ackTxStartTimeMETSeconds + ackTxDurationSeconds;
    ackRxEndTimeMETSeconds = ackTxEndTimeMETSeconds + owlt;
  }

  return {
    txStartTimeMETSeconds,
    txDurationSeconds,
    txEndTimeMETSeconds,
    rxStartTimeMETSeconds,
    rxEndTimeMETSeconds,
    oneWayLightTimeSeconds: owlt,
    roundTripLightTimeSeconds: rtlt,
    processingDelaySeconds,
    ackTxStartTimeMETSeconds,
    ackTxEndTimeMETSeconds,
    ackRxEndTimeMETSeconds,
  };
}
