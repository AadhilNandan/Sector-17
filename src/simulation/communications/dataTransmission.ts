/**
 * SECTOR 17 — Data Transmission Module
 * Simulates bit-level packet transmission, transmission duration calculations,
 * partial transfers during time-bounded communication windows, and interrupted transfers.
 */

import type { TransmissionStepResult } from './types';

/**
 * Calculates transmission duration in seconds for a given data size and bit rate:
 * durationSeconds = (dataSizeBytes * 8 bits/byte) / dataRateBps
 *
 * @param dataSizeBytes Data volume in bytes (dataSizeBytes >= 0)
 * @param dataRateBps Effective channel transmission rate in bits per second (dataRateBps > 0)
 * @returns Transmission duration in seconds
 */
export function calculateTransmissionDuration(dataSizeBytes: number, dataRateBps: number): number {
  if (typeof dataSizeBytes !== 'number' || !Number.isFinite(dataSizeBytes) || dataSizeBytes < 0) {
    throw new RangeError(`calculateTransmissionDuration: dataSizeBytes must be a non-negative finite number. Received: ${dataSizeBytes}`);
  }
  if (typeof dataRateBps !== 'number' || !Number.isFinite(dataRateBps) || dataRateBps <= 0) {
    throw new RangeError(`calculateTransmissionDuration: dataRateBps must be a positive finite number. Received: ${dataRateBps}`);
  }

  if (dataSizeBytes === 0) {
    return 0;
  }

  return (dataSizeBytes * 8) / dataRateBps;
}

/**
 * Simulates discrete time-stepped transmission of a data payload across an available
 * communication window duration.
 *
 * @param remainingBytes Total bytes left to transfer
 * @param availableDurationSeconds Duration of active communication window in seconds
 * @param effectiveDataRateBps Channel data rate in bits per second
 * @returns TransmissionStepResult detailing transferred bytes, remaining bytes, duration used, and completion state
 */
export function simulateTransmissionStep(
  remainingBytes: number,
  availableDurationSeconds: number,
  effectiveDataRateBps: number
): TransmissionStepResult {
  if (typeof remainingBytes !== 'number' || !Number.isFinite(remainingBytes) || remainingBytes < 0) {
    throw new RangeError(`simulateTransmissionStep: remainingBytes must be non-negative. Received: ${remainingBytes}`);
  }
  if (typeof availableDurationSeconds !== 'number' || !Number.isFinite(availableDurationSeconds) || availableDurationSeconds < 0) {
    throw new RangeError(`simulateTransmissionStep: availableDurationSeconds must be non-negative. Received: ${availableDurationSeconds}`);
  }
  if (typeof effectiveDataRateBps !== 'number' || !Number.isFinite(effectiveDataRateBps) || effectiveDataRateBps <= 0) {
    throw new RangeError(`simulateTransmissionStep: effectiveDataRateBps must be positive. Received: ${effectiveDataRateBps}`);
  }

  if (remainingBytes === 0 || availableDurationSeconds === 0) {
    return {
      bytesTransferred: 0,
      remainingBytes,
      isComplete: remainingBytes === 0,
      durationUsedSeconds: 0,
      wasInterrupted: false,
    };
  }

  // Maximum complete bytes that fit in the available time
  const maxBytesCapacity = Math.floor((availableDurationSeconds * effectiveDataRateBps) / 8);
  const bytesTransferred = Math.min(remainingBytes, maxBytesCapacity);
  const newRemainingBytes = remainingBytes - bytesTransferred;
  const isComplete = newRemainingBytes === 0;

  // Actual time used to transmit these transferred bytes
  const durationUsedSeconds = bytesTransferred > 0 ? (bytesTransferred * 8) / effectiveDataRateBps : 0;
  const wasInterrupted = !isComplete && bytesTransferred < remainingBytes;

  return {
    bytesTransferred,
    remainingBytes: newRemainingBytes,
    isComplete,
    durationUsedSeconds,
    wasInterrupted,
  };
}
