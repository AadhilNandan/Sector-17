/**
 * SECTOR 17 — RF Link Budget Module
 * Physical model for deep-space radio-frequency telecommunications links.
 * Computes Free-Space Path Loss (FSPL), parabolic antenna gains, EIRP,
 * received power, carrier-to-noise spectral density (C/N0), Eb/N0,
 * operational link margin, and maximum achievable data rates.
 *
 * All equations follow ITU-R, CCSDS, and NASA DSN telecommunications handbook standards.
 * All units are standard SI internally before logarithmic conversion.
 */

import {
  SPEED_OF_LIGHT,
  BOLTZMANN_CONSTANT,
  DEFAULT_ANTENNA_EFFICIENCY,
  DEFAULT_REQUIRED_LINK_MARGIN_DB,
  DEFAULT_REQUIRED_EB_N0_DB,
} from './constants';
import type { LinkBudgetInput, LinkBudgetResult } from './types';

/**
 * Calculates radio carrier wavelength in metres:
 * lambda = c / f
 *
 * @param frequencyHz Carrier frequency in Hertz (f > 0)
 * @returns Wavelength in metres
 */
export function calculateWavelength(frequencyHz: number): number {
  if (typeof frequencyHz !== 'number' || !Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError(`calculateWavelength: Frequency must be a positive number. Received: ${frequencyHz} Hz`);
  }
  return SPEED_OF_LIGHT / frequencyHz;
}

/**
 * Calculates Free-Space Path Loss (FSPL) in decibels:
 * FSPL_linear = (4 * pi * d * f / c)^2 = (4 * pi * d / lambda)^2
 * FSPL_dB = 20 * log10(4 * pi * d * f / c)
 *
 * @param distanceMetres Propagation slant distance in metres (d > 0)
 * @param frequencyHz Carrier frequency in Hertz (f > 0)
 * @returns Path loss in positive decibels (dB)
 */
export function calculateFreeSpacePathLoss(distanceMetres: number, frequencyHz: number): number {
  if (typeof distanceMetres !== 'number' || !Number.isFinite(distanceMetres) || distanceMetres <= 0) {
    throw new RangeError(`calculateFreeSpacePathLoss: Distance must be a positive number. Received: ${distanceMetres} m`);
  }
  if (typeof frequencyHz !== 'number' || !Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError(`calculateFreeSpacePathLoss: Frequency must be a positive number. Received: ${frequencyHz} Hz`);
  }

  const factor = (4 * Math.PI * distanceMetres * frequencyHz) / SPEED_OF_LIGHT;
  return 20 * Math.log10(factor);
}

/**
 * Calculates theoretical gain of a circular parabolic dish antenna in dBi:
 * G_linear = eta * (pi * D * f / c)^2 = eta * (pi * D / lambda)^2
 * G_dBi = 10 * log10(G_linear)
 *
 * @param diameterMetres Dish reflector aperture diameter in metres (D > 0)
 * @param frequencyHz Carrier frequency in Hertz (f > 0)
 * @param efficiency Aperture illumination efficiency [0, 1] (default: 0.65)
 * @returns Antenna gain in dBi
 */
export function calculateParabolicAntennaGain(
  diameterMetres: number,
  frequencyHz: number,
  efficiency: number = DEFAULT_ANTENNA_EFFICIENCY
): number {
  if (typeof diameterMetres !== 'number' || !Number.isFinite(diameterMetres) || diameterMetres <= 0) {
    throw new RangeError(`calculateParabolicAntennaGain: Antenna diameter must be positive. Received: ${diameterMetres} m`);
  }
  if (typeof frequencyHz !== 'number' || !Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError(`calculateParabolicAntennaGain: Frequency must be positive. Received: ${frequencyHz} Hz`);
  }
  if (typeof efficiency !== 'number' || !Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1) {
    throw new RangeError(`calculateParabolicAntennaGain: Efficiency must be in (0, 1]. Received: ${efficiency}`);
  }

  const wavelength = SPEED_OF_LIGHT / frequencyHz;
  const linearGain = efficiency * Math.pow((Math.PI * diameterMetres) / wavelength, 2);
  return 10 * Math.log10(linearGain);
}

/**
 * Calculates thermal noise power spectral density (N0) in dBW/Hz:
 * N0 = k_B * T_sys [Watts / Hz]
 * N0_dBW_Hz = 10 * log10(k_B * T_sys)
 *
 * @param systemNoiseTempKelvin System noise temperature in Kelvin (T_sys > 0)
 * @returns Noise density in dBW/Hz (typically around -210 to -225 dBW/Hz for deep space cryo receivers)
 */
export function calculateNoiseSpectralDensity(systemNoiseTempKelvin: number): number {
  if (typeof systemNoiseTempKelvin !== 'number' || !Number.isFinite(systemNoiseTempKelvin) || systemNoiseTempKelvin <= 0) {
    throw new RangeError(`calculateNoiseSpectralDensity: System noise temperature must be positive. Received: ${systemNoiseTempKelvin} K`);
  }

  return 10 * Math.log10(BOLTZMANN_CONSTANT * systemNoiseTempKelvin);
}

/**
 * Computes an end-to-end RF link budget for a deep-space communications link.
 *
 * Formula Summary:
 * - EIRP (dBW) = P_tx (dBW) + G_tx (dBi) - L_tx (dB)
 * - P_rx (dBW) = EIRP (dBW) - FSPL (dB) + G_rx (dBi) - L_rx (dB) - L_atm (dB) - L_point (dB)
 * - N0 (dBW/Hz) = 10 * log10(k_B * T_sys)
 * - C/N0 (dB-Hz) = P_rx (dBW) - N0 (dBW/Hz)
 * - Eb/N0 (dB) = C/N0 (dB-Hz) - 10 * log10(R_b)
 * - Margin (dB) = Eb/N0 (dB) - Required_EbN0 (dB)
 * - Max Achievable R_b (bps) = 10^((C/N0 - Required_EbN0 - Required_Margin) / 10)
 */
export function calculateLinkBudget(input: LinkBudgetInput): LinkBudgetResult {
  if (!input || typeof input !== 'object') {
    throw new TypeError('calculateLinkBudget: Input must be an object.');
  }

  const {
    transmitPowerWatts,
    transmitAntennaDiameterMetres,
    transmitAntennaEfficiency,
    transmitAntennaGainDbi,
    receiveAntennaDiameterMetres,
    receiveAntennaEfficiency,
    receiveAntennaGainDbi,
    carrierFrequencyHz,
    distanceMetres,
    systemNoiseTempKelvin,
    dataRateBps,
    transmitLossesDb = 0,
    receiveLossesDb = 0,
    atmosphericLossesDb = 0,
    pointingLossesDb = 0,
    requiredEbN0Db = DEFAULT_REQUIRED_EB_N0_DB,
    requiredMarginDb = DEFAULT_REQUIRED_LINK_MARGIN_DB,
    bandwidthHz,
  } = input;

  // Validation
  if (typeof transmitPowerWatts !== 'number' || !Number.isFinite(transmitPowerWatts) || transmitPowerWatts <= 0) {
    throw new RangeError(`calculateLinkBudget: transmitPowerWatts must be a positive number. Received: ${transmitPowerWatts}`);
  }
  if (typeof carrierFrequencyHz !== 'number' || !Number.isFinite(carrierFrequencyHz) || carrierFrequencyHz <= 0) {
    throw new RangeError(`calculateLinkBudget: carrierFrequencyHz must be a positive number. Received: ${carrierFrequencyHz}`);
  }
  if (typeof distanceMetres !== 'number' || !Number.isFinite(distanceMetres) || distanceMetres <= 0) {
    throw new RangeError(`calculateLinkBudget: distanceMetres must be a positive number. Received: ${distanceMetres}`);
  }
  if (typeof systemNoiseTempKelvin !== 'number' || !Number.isFinite(systemNoiseTempKelvin) || systemNoiseTempKelvin <= 0) {
    throw new RangeError(`calculateLinkBudget: systemNoiseTempKelvin must be a positive number. Received: ${systemNoiseTempKelvin}`);
  }

  const warnings: string[] = [];

  // Determine Transmit Antenna Gain
  let transmitGainDbi: number;
  if (transmitAntennaGainDbi !== undefined) {
    if (typeof transmitAntennaGainDbi !== 'number' || !Number.isFinite(transmitAntennaGainDbi)) {
      throw new TypeError(`calculateLinkBudget: transmitAntennaGainDbi must be a finite number. Received: ${transmitAntennaGainDbi}`);
    }
    transmitGainDbi = transmitAntennaGainDbi;
  } else if (transmitAntennaDiameterMetres !== undefined) {
    transmitGainDbi = calculateParabolicAntennaGain(
      transmitAntennaDiameterMetres,
      carrierFrequencyHz,
      transmitAntennaEfficiency
    );
  } else {
    throw new Error('calculateLinkBudget: Either transmitAntennaGainDbi or transmitAntennaDiameterMetres must be provided.');
  }

  // Determine Receive Antenna Gain
  let receiveGainDbi: number;
  if (receiveAntennaGainDbi !== undefined) {
    if (typeof receiveAntennaGainDbi !== 'number' || !Number.isFinite(receiveAntennaGainDbi)) {
      throw new TypeError(`calculateLinkBudget: receiveAntennaGainDbi must be a finite number. Received: ${receiveAntennaGainDbi}`);
    }
    receiveGainDbi = receiveAntennaGainDbi;
  } else if (receiveAntennaDiameterMetres !== undefined) {
    receiveGainDbi = calculateParabolicAntennaGain(
      receiveAntennaDiameterMetres,
      carrierFrequencyHz,
      receiveAntennaEfficiency
    );
  } else {
    throw new Error('calculateLinkBudget: Either receiveAntennaGainDbi or receiveAntennaDiameterMetres must be provided.');
  }

  // Wavelength & Free-Space Path Loss
  const wavelengthMetres = calculateWavelength(carrierFrequencyHz);
  const freeSpacePathLossDb = calculateFreeSpacePathLoss(distanceMetres, carrierFrequencyHz);

  // Power in dBW
  const transmitPowerDbw = 10 * Math.log10(transmitPowerWatts);
  const eirpDbw = transmitPowerDbw + transmitGainDbi - transmitLossesDb;

  const totalOtherLossesDb = transmitLossesDb + receiveLossesDb + atmosphericLossesDb + pointingLossesDb;
  const totalLossesDb = freeSpacePathLossDb + totalOtherLossesDb;

  // Received Power: P_rx = EIRP - FSPL + G_rx - other_rx_losses
  const receivedPowerDbw = eirpDbw - freeSpacePathLossDb + receiveGainDbi - (receiveLossesDb + atmosphericLossesDb + pointingLossesDb);
  const receivedPowerWatts = Math.pow(10, receivedPowerDbw / 10);

  // Noise Spectral Density & C/N0
  const noiseSpectralDensityDbwHz = calculateNoiseSpectralDensity(systemNoiseTempKelvin);
  const carrierToNoiseDensityDbHz = receivedPowerDbw - noiseSpectralDensityDbwHz;

  // Eb/N0 and Link Margin if target data rate is specified
  let achievedEbN0Db: number | undefined;
  let linkMarginDb: number | undefined;
  let isFeasible = true;

  if (dataRateBps !== undefined) {
    if (typeof dataRateBps !== 'number' || !Number.isFinite(dataRateBps) || dataRateBps <= 0) {
      throw new RangeError(`calculateLinkBudget: dataRateBps must be a positive number. Received: ${dataRateBps}`);
    }
    achievedEbN0Db = carrierToNoiseDensityDbHz - 10 * Math.log10(dataRateBps);
    linkMarginDb = achievedEbN0Db - requiredEbN0Db;

    if (linkMarginDb < requiredMarginDb) {
      isFeasible = false;
      warnings.push(
        `Link margin of ${linkMarginDb.toFixed(2)} dB is below the required operational threshold of ${requiredMarginDb.toFixed(2)} dB at ${dataRateBps} bps.`
      );
    }
  }

  // Maximum Achievable Bit Rate at Required Margin
  const maxRateExponent = (carrierToNoiseDensityDbHz - requiredEbN0Db - requiredMarginDb) / 10;
  const maxAchievableDataRateBps = Math.max(0, Math.pow(10, maxRateExponent));

  // Theoretical Shannon Capacity (C = B * log2(1 + SNR))
  let shannonCapacityBps: number | undefined;
  if (bandwidthHz !== undefined) {
    if (typeof bandwidthHz !== 'number' || !Number.isFinite(bandwidthHz) || bandwidthHz <= 0) {
      throw new RangeError(`calculateLinkBudget: bandwidthHz must be a positive number. Received: ${bandwidthHz}`);
    }
    const noisePowerWatts = BOLTZMANN_CONSTANT * systemNoiseTempKelvin * bandwidthHz;
    const snrLinear = receivedPowerWatts / noisePowerWatts;
    shannonCapacityBps = bandwidthHz * (Math.log(1 + snrLinear) / Math.LN2);
  }

  return {
    carrierFrequencyHz,
    wavelengthMetres,
    distanceMetres,
    freeSpacePathLossDb,
    transmitGainDbi,
    receiveGainDbi,
    eirpDbw,
    totalLossesDb,
    receivedPowerDbw,
    receivedPowerWatts,
    noiseSpectralDensityDbwHz,
    carrierToNoiseDensityDbHz,
    achievedEbN0Db,
    requiredEbN0Db,
    linkMarginDb,
    requiredMarginDb,
    isFeasible,
    maxAchievableDataRateBps,
    shannonCapacityBps,
    warnings,
  };
}
