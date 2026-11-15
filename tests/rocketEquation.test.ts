import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveExhaustVelocity,
  calculateMassRatio,
  calculatePropellantMass,
  calculateFinalMass,
  calculateDeltaV,
  calculatePropellantFraction,
  calculateRocketPerformance,
} from '../src/simulation/physics/rocketEquation';
import { G0 } from '../src/simulation/constants';

describe('Tsiolkovsky Rocket Equation Engine', () => {
  describe('Required Numerical Validation Reference Case', () => {
    // Reference Case Parameters:
    // Dry mass = 2,340 kg
    // Delta-v = 3,900 m/s
    // Specific impulse = 325 seconds
    const dryMassKg = 2340;
    const deltaVMps = 3900;
    const ispSeconds = 325;

    // Independent analytical solution:
    // ve = 325 * 9.80665 = 3187.16125 m/s
    // exponent = 3900 / 3187.16125 = 1.2236594241697228
    // expectedMassRatio = exp(1.2236594241697228) = 3.399587441589146
    // expectedInitialMass = 2340 * 3.399587441589146 = 7955.034613318602 kg
    // expectedPropellantMass = 7955.034613318602 - 2340 = 5615.034613318602 kg
    // expectedPropellantFraction = 5615.034613318602 / 7955.034613318602 = 0.7058466580459384 (~70.58%)
    const expectedVe = 325 * 9.80665;
    const expectedMassRatio = Math.exp(deltaVMps / expectedVe);
    const expectedPropellantMass = dryMassKg * (expectedMassRatio - 1);
    const expectedInitialMass = dryMassKg + expectedPropellantMass;
    const expectedPropellantFraction = expectedPropellantMass / expectedInitialMass;

    it('calculates mass ratio within 0.1% of analytical solution', () => {
      const massRatio = calculateMassRatio(deltaVMps, ispSeconds);
      expect(massRatio).toBeCloseTo(expectedMassRatio, 5);
      expect(Math.abs(massRatio - expectedMassRatio) / expectedMassRatio).toBeLessThan(0.001);
      expect(massRatio).toBeCloseTo(3.39959, 4);
    });

    it('calculates propellant mass within 0.1% of analytical solution', () => {
      const propellantMass = calculatePropellantMass(dryMassKg, deltaVMps, ispSeconds);
      expect(propellantMass).toBeCloseTo(expectedPropellantMass, 3);
      expect(Math.abs(propellantMass - expectedPropellantMass) / expectedPropellantMass).toBeLessThan(0.001);
      expect(propellantMass).toBeCloseTo(5615.035, 1);
    });

    it('calculates initial wet mass within 0.1% of analytical solution', () => {
      const perf = calculateRocketPerformance(dryMassKg, deltaVMps, ispSeconds);
      expect(perf.initialMassKg).toBeCloseTo(expectedInitialMass, 3);
      expect(Math.abs(perf.initialMassKg - expectedInitialMass) / expectedInitialMass).toBeLessThan(0.001);
      expect(perf.initialMassKg).toBeCloseTo(7955.035, 1);
    });

    it('calculates propellant mass fraction within 0.1% of analytical solution', () => {
      const propMass = calculatePropellantMass(dryMassKg, deltaVMps, ispSeconds);
      const wetMass = dryMassKg + propMass;
      const propFraction = calculatePropellantFraction(propMass, wetMass);

      expect(propFraction).toBeCloseTo(expectedPropellantFraction, 5);
      expect(Math.abs(propFraction - expectedPropellantFraction) / expectedPropellantFraction).toBeLessThan(0.001);
      expect(propFraction).toBeCloseTo(0.70585, 4);
    });

    it('recovers exact Delta-V from computed initial and final mass', () => {
      const perf = calculateRocketPerformance(dryMassKg, deltaVMps, ispSeconds);
      const recoveredDeltaV = calculateDeltaV(perf.initialMassKg, perf.dryMassKg, ispSeconds);
      expect(recoveredDeltaV).toBeCloseTo(deltaVMps, 5);
    });
  });

  describe('Effective Exhaust Velocity', () => {
    it('calculates exhaust velocity for known chemical engines', () => {
      // RL10C-1 (Isp = 449.7 s): ve = 449.7 * 9.80665 = 4,410.05 m/s
      expect(calculateEffectiveExhaustVelocity(449.7)).toBeCloseTo(449.7 * G0, 4);

      // Hypergolic MMH/NTO (Isp = 325 s): ve = 3,187.16 m/s
      expect(calculateEffectiveExhaustVelocity(325)).toBeCloseTo(3187.16125, 4);

      // NEXT-C Xenon Ion Thruster (Isp = 4,190 s): ve = 4190 * 9.80665 = 41,089.86 m/s
      expect(calculateEffectiveExhaustVelocity(4190)).toBeCloseTo(41_089.8635, 4);
    });

    it('rejects non-positive specific impulse', () => {
      expect(() => calculateEffectiveExhaustVelocity(0)).toThrow(RangeError);
      expect(() => calculateEffectiveExhaustVelocity(-100)).toThrow(RangeError);
      expect(() => calculateEffectiveExhaustVelocity(NaN)).toThrow(RangeError);
    });
  });

  describe('Boundary Conditions and Edge Cases', () => {
    it('handles zero Delta-V correctly', () => {
      expect(calculateMassRatio(0, 325)).toBe(1.0);
      expect(calculatePropellantMass(2000, 0, 325)).toBe(0.0);
      expect(calculateDeltaV(2000, 2000, 325)).toBe(0.0);
    });

    it('handles calculateFinalMass correctly', () => {
      const initialMass = 8000;
      const propellantMass = 5000;
      const finalMass = calculateFinalMass(initialMass, propellantMass);
      expect(finalMass).toBe(3000);
    });

    it('rejects propellant mass equal to or exceeding initial mass', () => {
      expect(() => calculateFinalMass(5000, 5000)).toThrow(RangeError);
      expect(() => calculateFinalMass(5000, 6000)).toThrow(RangeError);
      expect(() => calculatePropellantFraction(5000, 5000)).toThrow(RangeError);
      expect(() => calculatePropellantFraction(6000, 5000)).toThrow(RangeError);
    });

    it('rejects final mass exceeding initial mass in calculateDeltaV', () => {
      expect(() => calculateDeltaV(2000, 3000, 300)).toThrow(RangeError);
    });

    it('rejects negative or zero mass inputs', () => {
      expect(() => calculatePropellantMass(-500, 1000, 300)).toThrow(RangeError);
      expect(() => calculatePropellantMass(0, 1000, 300)).toThrow(RangeError);
      expect(() => calculateFinalMass(-1000, 200)).toThrow(RangeError);
      expect(() => calculateFinalMass(1000, -200)).toThrow(RangeError);
      expect(() => calculateDeltaV(-1000, 500, 300)).toThrow(RangeError);
      expect(() => calculateDeltaV(1000, -500, 300)).toThrow(RangeError);
    });

    it('rejects negative Delta-V', () => {
      expect(() => calculateMassRatio(-100, 300)).toThrow(RangeError);
      expect(() => calculatePropellantMass(1000, -100, 300)).toThrow(RangeError);
    });
  });
});
