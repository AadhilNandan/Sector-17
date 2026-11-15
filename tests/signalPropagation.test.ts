import { describe, it, expect } from 'vitest';
import {
  calculateOneWayLightTime,
  calculateRoundTripLightTime,
  calculatePropagationDelay,
  calculateSignalTimeline,
  kmToMetres,
  metresToKm,
  auToMetres,
  metresToAu,
} from '../src/simulation/communications/signalPropagation';
import { SPEED_OF_LIGHT, ASTRONOMICAL_UNIT_METRES } from '../src/simulation/constants';

describe('Signal Propagation Module', () => {
  describe('Speed of Light Propagation Calculations', () => {
    it('calculates One-Way Light Time (OWLT) and Round-Trip Light Time (RTT) accurately', () => {
      // 300,000 km = 300,000,000 m
      const distance = 300_000_000;
      const expectedOwlt = distance / SPEED_OF_LIGHT; // ~1.00069 s
      const expectedRtt = 2 * expectedOwlt;

      const owlt = calculateOneWayLightTime(distance);
      const rtt = calculateRoundTripLightTime(distance);

      expect(owlt).toBeCloseTo(expectedOwlt, 6);
      expect(rtt).toBeCloseTo(expectedRtt, 6);
      expect(rtt).toBeCloseTo(2 * owlt, 10);
    });

    it('validates Earth-to-Jupiter 5.2 AU deep-space reference case', () => {
      const distanceMetres = 5.2 * ASTRONOMICAL_UNIT_METRES; // 777,908,927,640 m
      const result = calculatePropagationDelay(distanceMetres);

      expect(result.distanceMetres).toBe(777_908_927_640);
      expect(result.distanceAu).toBeCloseTo(5.2, 5);
      expect(result.distanceKm).toBeCloseTo(777_908_927.64, 2);

      // OWLT ~ 2,594.825 seconds (approx 43.25 minutes)
      expect(result.oneWayLightTimeSeconds).toBeCloseTo(2594.825, 2);
      expect(result.oneWayLightTimeSeconds / 60).toBeCloseTo(43.247, 2);

      // Round trip ~ 5,189.649 seconds (approx 86.49 minutes)
      expect(result.roundTripLightTimeSeconds).toBeCloseTo(5189.649, 2);
      expect(result.roundTripLightTimeSeconds / 60).toBeCloseTo(86.494, 2);
    });

    it('validates Earth-to-Moon cislunar reference distance (384,400 km)', () => {
      const distanceMoon = kmToMetres(384_400); // 384,400,000 m
      const owlt = calculateOneWayLightTime(distanceMoon);
      const rtt = calculateRoundTripLightTime(distanceMoon);

      // Standard lunar light delay: ~1.282 s one-way, ~2.564 s round-trip
      expect(owlt).toBeCloseTo(1.2822, 3);
      expect(rtt).toBeCloseTo(2.5644, 3);
    });

    it('returns zero propagation delay for zero distance', () => {
      expect(calculateOneWayLightTime(0)).toBe(0);
      expect(calculateRoundTripLightTime(0)).toBe(0);
    });

    it('rejects negative, NaN, and Infinite distances', () => {
      expect(() => calculateOneWayLightTime(-100)).toThrow(RangeError);
      expect(() => calculateOneWayLightTime(NaN)).toThrow(TypeError);
      expect(() => calculateOneWayLightTime(Infinity)).toThrow(TypeError);

      expect(() => calculateRoundTripLightTime(-500)).toThrow(RangeError);
      expect(() => calculateRoundTripLightTime(NaN)).toThrow(TypeError);
    });
  });

  describe('Unit Conversions', () => {
    it('converts between AU, km, and metres bidirectionally', () => {
      const au = 1.5;
      const metres = auToMetres(au);
      expect(metres).toBe(1.5 * ASTRONOMICAL_UNIT_METRES);
      expect(metresToAu(metres)).toBeCloseTo(au, 10);

      const km = 10_000;
      const kmInMetres = kmToMetres(km);
      expect(kmInMetres).toBe(10_000_000);
      expect(metresToKm(kmInMetres)).toBe(km);
    });
  });

  describe('Signal Propagation Timeline (Emission vs Propagation vs Reception)', () => {
    it('accurately models complete timeline separating transmission duration from OWLT', () => {
      // 1000 bytes transmitted at 1000 bps = 8000 bits / 1000 bps = 8.0 seconds transmission time
      // Slant distance: 1 AU (~499.005 s OWLT)
      const distance = ASTRONOMICAL_UNIT_METRES;
      const expectedOwlt = distance / SPEED_OF_LIGHT; // ~499.005 s

      const timeline = calculateSignalTimeline({
        txStartTimeMETSeconds: 1000,
        dataSizeBytes: 1000,
        dataRateBps: 1000,
        distanceMetres: distance,
        processingDelaySeconds: 5.0,
        ackSizeBytes: 50, // 400 bits
        ackDataRateBps: 200, // 2.0 s transmission duration
      });

      // 1. Earth TX: Starts at 1000 s, lasts 8.0 s, ends at 1008 s
      expect(timeline.txStartTimeMETSeconds).toBe(1000);
      expect(timeline.txDurationSeconds).toBe(8.0);
      expect(timeline.txEndTimeMETSeconds).toBe(1008.0);

      // 2. Wavefront Arrival: Starts at txStart + OWLT = 1000 + 499.005 = 1499.005 s
      expect(timeline.rxStartTimeMETSeconds).toBeCloseTo(1000 + expectedOwlt, 4);

      // 3. Final Bit Arrival: Completes at txEnd + OWLT = 1008 + 499.005 = 1507.005 s
      expect(timeline.rxEndTimeMETSeconds).toBeCloseTo(1008 + expectedOwlt, 4);

      // 4. Processing Delay: 5 s after full arrival -> 1008 + OWLT + 5.0 s
      expect(timeline.ackTxStartTimeMETSeconds).toBeCloseTo(1008 + expectedOwlt + 5.0, 4);
      expect(timeline.ackTxStartTimeMETSeconds).toBeCloseTo(timeline.rxEndTimeMETSeconds + 5.0, 6);

      // 5. ACK TX Duration: (50 * 8) / 200 = 2.0 s -> ACK TX ends at 1514.005 s
      expect(timeline.ackTxEndTimeMETSeconds).toBeCloseTo(timeline.ackTxStartTimeMETSeconds! + 2.0, 4);

      // 6. Earth ACK Arrival: ackTxEnd + OWLT = ackTxEnd + 499.005 s -> Total round trip delay
      expect(timeline.ackRxEndTimeMETSeconds).toBeCloseTo(timeline.ackTxEndTimeMETSeconds! + expectedOwlt, 4);
    });

    it('rejects invalid timeline parameters', () => {
      const valid = {
        txStartTimeMETSeconds: 0,
        dataSizeBytes: 100,
        dataRateBps: 100,
        distanceMetres: 1000,
      };

      expect(() => calculateSignalTimeline({ ...valid, txStartTimeMETSeconds: -10 })).toThrow(TypeError);
      expect(() => calculateSignalTimeline({ ...valid, dataRateBps: 0 })).toThrow(TypeError);
      expect(() => calculateSignalTimeline({ ...valid, dataSizeBytes: -5 })).toThrow(TypeError);
    });
  });
});
