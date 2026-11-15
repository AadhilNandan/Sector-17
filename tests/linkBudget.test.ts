import { describe, it, expect } from 'vitest';
import {
  calculateWavelength,
  calculateFreeSpacePathLoss,
  calculateParabolicAntennaGain,
  calculateNoiseSpectralDensity,
  calculateLinkBudget,
} from '../src/simulation/communications/linkBudget';
import {
  FREQUENCY_X_BAND_DOWNLINK_HZ,
  FREQUENCY_KA_BAND_DOWNLINK_HZ,
  ASTRONOMICAL_UNIT_METRES,
  SPEED_OF_LIGHT,
} from '../src/simulation/communications/constants';

describe('RF Link Budget Module', () => {
  describe('Fundamental Physical Formulations', () => {
    it('calculates carrier wavelength correctly across deep space bands', () => {
      // X-band downlink: 8.425 GHz
      const wavelengthX = calculateWavelength(FREQUENCY_X_BAND_DOWNLINK_HZ);
      expect(wavelengthX).toBeCloseTo(SPEED_OF_LIGHT / 8.425e9, 6);
      expect(wavelengthX * 100).toBeCloseTo(3.558, 2); // ~3.56 cm

      // Ka-band downlink: 32.05 GHz
      const wavelengthKa = calculateWavelength(FREQUENCY_KA_BAND_DOWNLINK_HZ);
      expect(wavelengthKa * 100).toBeCloseTo(0.935, 2); // ~9.35 mm
    });

    it('validates Free-Space Path Loss (FSPL) against standard theoretical values', () => {
      // 1 AU at 8.425 GHz
      const fspl1Au = calculateFreeSpacePathLoss(ASTRONOMICAL_UNIT_METRES, FREQUENCY_X_BAND_DOWNLINK_HZ);
      // Theoretical ~ 274.46 dB
      expect(fspl1Au).toBeCloseTo(274.46, 1);

      // 5.2 AU (Earth-Jupiter) at 8.425 GHz
      const distanceJupiter = 5.2 * ASTRONOMICAL_UNIT_METRES;
      const fsplJupiter = calculateFreeSpacePathLoss(distanceJupiter, FREQUENCY_X_BAND_DOWNLINK_HZ);
      // Expected: fspl1Au + 20*log10(5.2) = 274.46 + 14.32 = 288.78 dB
      expect(fsplJupiter).toBeCloseTo(288.78, 1);
      expect(fsplJupiter - fspl1Au).toBeCloseTo(20 * Math.log10(5.2), 3);
    });

    it('calculates parabolic antenna gain for spacecraft HGA and ground station dishes', () => {
      // 3.0-metre spacecraft dish at 8.425 GHz (eta = 0.65)
      const hgaGain = calculateParabolicAntennaGain(3.0, FREQUENCY_X_BAND_DOWNLINK_HZ, 0.65);
      // Theoretical ~ 46.58 dBi
      expect(hgaGain).toBeCloseTo(46.58, 1);

      // 70-metre DSN ground station dish at 8.425 GHz (eta = 0.65)
      const dsn70mGain = calculateParabolicAntennaGain(70.0, FREQUENCY_X_BAND_DOWNLINK_HZ, 0.65);
      // Gain scales as 20*log10(D2/D1) = 20*log10(70/3) ~ 27.36 dB higher -> ~ 73.94 dBi
      expect(dsn70mGain).toBeCloseTo(73.94, 1);
      expect(dsn70mGain - hgaGain).toBeCloseTo(20 * Math.log10(70 / 3), 2);
    });

    it('calculates cryogenic receiver noise spectral density N0 in dBW/Hz', () => {
      // Cryogenic LNA at 20 K
      const n0 = calculateNoiseSpectralDensity(20.0);
      // N0 = kB * T = 1.380649e-23 * 20 = 2.7613e-22 W/Hz -> 10*log10(N0) ~ -215.59 dBW/Hz
      expect(n0).toBeCloseTo(-215.59, 2);
    });
  });

  describe('Comprehensive End-to-End Link Budget Integration', () => {
    it('computes feasible deep-space downlink budget for AETHON at 5.2 AU with 20 W transmitter', () => {
      const distance = 5.2 * ASTRONOMICAL_UNIT_METRES;

      const link = calculateLinkBudget({
        transmitPowerWatts: 20.0, // 20 W TWTA
        transmitAntennaDiameterMetres: 3.0, // 3m onboard HGA dish
        receiveAntennaDiameterMetres: 70.0, // 70m DSN dish
        carrierFrequencyHz: FREQUENCY_X_BAND_DOWNLINK_HZ,
        distanceMetres: distance,
        systemNoiseTempKelvin: 18.5,
        dataRateBps: 10_000, // 10 kbps scientific telemetry stream
        transmitLossesDb: 1.0,
        receiveLossesDb: 0.5,
        pointingLossesDb: 0.5,
        requiredEbN0Db: 2.5,
        requiredMarginDb: 3.0,
      });

      expect(link.freeSpacePathLossDb).toBeCloseTo(288.78, 1);
      expect(link.transmitGainDbi).toBeCloseTo(46.58, 1);
      expect(link.receiveGainDbi).toBeCloseTo(73.94, 1);

      // EIRP = 10*log10(20) + 46.58 - 1.0 = 13.01 + 46.58 - 1.0 = 58.59 dBW
      expect(link.eirpDbw).toBeCloseTo(58.59, 1);

      // Received power
      expect(link.receivedPowerDbw).toBeLessThan(-150);
      expect(link.receivedPowerWatts).toBeGreaterThan(0);

      // C/N0 should be > 50 dB-Hz
      expect(link.carrierToNoiseDensityDbHz).toBeGreaterThan(50);

      // At 10 kbps, achieved Eb/N0 should provide comfortable link margin > 3 dB
      expect(link.linkMarginDb).toBeDefined();
      expect(link.linkMarginDb!).toBeGreaterThan(3.0);
      expect(link.isFeasible).toBe(true);
      expect(link.warnings).toHaveLength(0);

      // Max achievable data rate should exceed 10 kbps
      expect(link.maxAchievableDataRateBps).toBeGreaterThan(10_000);
    });

    it('correctly flags insufficient link margin and sets isFeasible to false when data rate is too high', () => {
      const distance = 5.2 * ASTRONOMICAL_UNIT_METRES;

      // Attempting 10 Mbps at 5.2 AU with 20 W transmitter
      const link = calculateLinkBudget({
        transmitPowerWatts: 20.0,
        transmitAntennaDiameterMetres: 3.0,
        receiveAntennaDiameterMetres: 70.0,
        carrierFrequencyHz: FREQUENCY_X_BAND_DOWNLINK_HZ,
        distanceMetres: distance,
        systemNoiseTempKelvin: 18.5,
        dataRateBps: 10_000_000, // 10 Mbps (unrealistic for 20W X-band at Jupiter)
        requiredEbN0Db: 2.5,
        requiredMarginDb: 3.0,
      });

      expect(link.isFeasible).toBe(false);
      expect(link.linkMarginDb).toBeDefined();
      expect(link.linkMarginDb!).toBeLessThan(3.0);
      expect(link.warnings).toHaveLength(1);
      expect(link.warnings[0]).toContain('below the required operational threshold');
    });

    it('calculates Shannon theoretical channel capacity bound', () => {
      const distance = 1.0 * ASTRONOMICAL_UNIT_METRES;
      const bandwidthHz = 100_000; // 100 kHz channel

      const link = calculateLinkBudget({
        transmitPowerWatts: 20.0,
        transmitAntennaGainDbi: 40.0,
        receiveAntennaGainDbi: 60.0,
        carrierFrequencyHz: FREQUENCY_X_BAND_DOWNLINK_HZ,
        distanceMetres: distance,
        systemNoiseTempKelvin: 20.0,
        bandwidthHz,
        requiredMarginDb: 3.0,
      });

      expect(link.shannonCapacityBps).toBeDefined();
      expect(link.shannonCapacityBps!).toBeGreaterThan(0);
      // Realistic practical data rate must not exceed Shannon theoretical upper limit
      expect(link.maxAchievableDataRateBps).toBeLessThan(link.shannonCapacityBps!);
    });

    it('rejects invalid or non-physical link budget parameters', () => {
      const valid = {
        transmitPowerWatts: 20,
        transmitAntennaGainDbi: 30,
        receiveAntennaGainDbi: 60,
        carrierFrequencyHz: 8e9,
        distanceMetres: 1e9,
        systemNoiseTempKelvin: 20,
      };

      // Non-positive power
      expect(() => calculateLinkBudget({ ...valid, transmitPowerWatts: 0 })).toThrow(RangeError);
      expect(() => calculateLinkBudget({ ...valid, transmitPowerWatts: -10 })).toThrow(RangeError);

      // Non-positive distance
      expect(() => calculateLinkBudget({ ...valid, distanceMetres: -100 })).toThrow(RangeError);

      // Missing antenna specs
      expect(() =>
        calculateLinkBudget({
          transmitPowerWatts: 20,
          carrierFrequencyHz: 8e9,
          distanceMetres: 1e9,
          systemNoiseTempKelvin: 20,
        } as any)
      ).toThrow(/Either transmitAntennaGainDbi or transmitAntennaDiameterMetres/);
    });
  });
});
