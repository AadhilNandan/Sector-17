import { describe, it, expect } from 'vitest';
import {
  calculateMassBudget,
  validateMassValue,
  createEmptyMassBreakdown,
} from '../src/simulation/engineering/massBudget';
import type { MassItem, MassBudgetInput } from '../src/simulation/types';

describe('Mass Budget Engine', () => {
  describe('validateMassValue utility', () => {
    it('accepts valid zero and positive finite masses', () => {
      expect(validateMassValue(0, 'zero')).toBe(0);
      expect(validateMassValue(2340.5, 'spacecraft')).toBe(2340.5);
    });

    it('rejects negative masses with RangeError', () => {
      expect(() => validateMassValue(-1, 'negative mass')).toThrow(RangeError);
      expect(() => validateMassValue(-0.0001, 'negative mass')).toThrow(RangeError);
    });

    it('rejects non-finite masses with TypeError', () => {
      expect(() => validateMassValue(NaN, 'NaN mass')).toThrow(TypeError);
      expect(() => validateMassValue(Infinity, 'Infinity mass')).toThrow(TypeError);
      expect(() => validateMassValue(-Infinity, '-Infinity mass')).toThrow(TypeError);
    });
  });

  describe('createEmptyMassBreakdown', () => {
    it('initializes all categories to zero', () => {
      const breakdown = createEmptyMassBreakdown();
      expect(breakdown.bus).toBe(0);
      expect(breakdown.propulsionDry).toBe(0);
      expect(breakdown.propellant).toBe(0);
      expect(breakdown.instruments).toBe(0);
      expect(breakdown.communication).toBe(0);
      expect(breakdown.power).toBe(0);
      expect(breakdown.thermal).toBe(0);
      expect(breakdown.lander).toBe(0);
      expect(breakdown.rover).toBe(0);
      expect(breakdown.other).toBe(0);
    });
  });

  describe('Normal Spacecraft Configuration (Reference Loadout)', () => {
    // Reference 2,340 kg dry mass configuration:
    // Structure: 680 kg, Propulsion Dry: 420 kg, Power: 380 kg,
    // Instruments: 310 kg, Comm: 290 kg, Thermal: 260 kg
    // Propellant: 5,615 kg (from Phase 1 rocket equation)
    const items: MassItem[] = [
      { id: 'struct-carbon-truss', category: 'bus', massKg: 680, name: 'Carbon Truss' },
      { id: 'prop-ion', category: 'propulsionDry', massKg: 420, name: 'Ion Engine' },
      { id: 'propellant-tank', category: 'propellant', massKg: 5615, name: 'Xenon Tank' },
      { id: 'inst-radar', category: 'instruments', massKg: 310, name: 'Radar Sounder' },
      { id: 'comm-dish', category: 'communication', massKg: 290, name: 'High Gain Dish' },
      { id: 'power-solar', category: 'power', massKg: 380, name: 'Solar Wings' },
      { id: 'thermal-pipes', category: 'thermal', massKg: 260, name: 'Heat Pipes' },
    ];

    it('calculates dry mass, propellant mass, and wet mass accurately', () => {
      const result = calculateMassBudget({
        items,
        launchMassLimitKg: 10000,
        marginThresholdPercent: 10,
      });

      expect(result.totalDryMassKg).toBe(2340);
      expect(result.totalPropellantMassKg).toBe(5615);
      expect(result.totalWetMassKg).toBe(7955);
      expect(result.categoryBreakdownKg.bus).toBe(680);
      expect(result.categoryBreakdownKg.propulsionDry).toBe(420);
      expect(result.categoryBreakdownKg.propellant).toBe(5615);
    });

    it('calculates science payload mass and payload fractions', () => {
      const result = calculateMassBudget({
        items,
        launchMassLimitKg: 10000,
      });

      // Instruments: 310 kg
      expect(result.payloadMassKg).toBe(310);
      // Payload fraction dry: 310 / 2340 ~ 13.25%
      expect(result.payloadFractionDry).toBeCloseTo(310 / 2340, 4);
      // Payload fraction wet: 310 / 7955 ~ 3.90%
      expect(result.payloadFractionWet).toBeCloseTo(310 / 7955, 4);
      // Propellant fraction: 5615 / 7955 ~ 70.58%
      expect(result.propellantFraction).toBeCloseTo(5615 / 7955, 4);
    });

    it('calculates positive mass margin and NOMINAL status', () => {
      const result = calculateMassBudget({
        items,
        launchMassLimitKg: 10000, // Falcon Heavy or heavy launcher
        marginThresholdPercent: 10,
      });

      expect(result.launchMassLimitKg).toBe(10000);
      expect(result.massMarginKg).toBe(10000 - 7955); // 2045 kg
      expect(result.massMarginPercent).toBeCloseTo(20.45, 2);
      expect(result.isWithinLaunchCapacity).toBe(true);
      expect(result.status).toBe('NOMINAL');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple Component Categories with Lander and Rover', () => {
    it('supports lander, rover, and other mass categories without double counting', () => {
      const items: MassItem[] = [
        { id: 'bus-1', category: 'bus', massKg: 1000 },
        { id: 'prop-dry', category: 'propulsionDry', massKg: 300 },
        { id: 'fuel', category: 'propellant', massKg: 1200 },
        { id: 'inst-cam', category: 'instruments', massKg: 50 },
        { id: 'lander-core', category: 'lander', massKg: 400 },
        { id: 'rover-scout', category: 'rover', massKg: 150 },
        { id: 'ballast', category: 'other', massKg: 100 },
      ];

      const result = calculateMassBudget({ items, launchMassLimitKg: 5000 });

      // Total dry: 1000 + 300 + 50 + 400 + 150 + 100 = 2000 kg
      expect(result.totalDryMassKg).toBe(2000);
      expect(result.totalPropellantMassKg).toBe(1200);
      expect(result.totalWetMassKg).toBe(3200);

      // Payload includes instruments + lander + rover = 50 + 400 + 150 = 600 kg
      expect(result.payloadMassKg).toBe(600);
      expect(result.payloadFractionDry).toBe(600 / 2000);
      expect(result.payloadFractionWet).toBe(600 / 3200);
    });

    it('supports direct category dictionary input mode', () => {
      const input: MassBudgetInput = {
        categories: {
          bus: 800,
          propulsionDry: 200,
          propellant: 1000,
          instruments: 100,
          communication: 50,
          power: 150,
          thermal: 70,
        },
        launchMassLimitKg: 3000,
      };

      const result = calculateMassBudget(input);
      // Dry: 800 + 200 + 100 + 50 + 150 + 70 = 1370 kg
      expect(result.totalDryMassKg).toBe(1370);
      expect(result.totalPropellantMassKg).toBe(1000);
      expect(result.totalWetMassKg).toBe(2370);
      expect(result.status).toBe('NOMINAL');
    });
  });

  describe('Launch Vehicle Mass Constraints and Limits', () => {
    it('detects EXCEEDED status when wet mass surpasses launch limit', () => {
      const items: MassItem[] = [
        { id: 'bus', category: 'bus', massKg: 2000 },
        { id: 'propellant', category: 'propellant', massKg: 3000 },
      ];

      const result = calculateMassBudget({
        items,
        launchMassLimitKg: 4000, // Lower than 5000 kg wet mass
      });

      expect(result.totalWetMassKg).toBe(5000);
      expect(result.massMarginKg).toBe(-1000);
      expect(result.isWithinLaunchCapacity).toBe(false);
      expect(result.status).toBe('EXCEEDED');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('detects WARNING status when mass margin is below recommended threshold', () => {
      const items: MassItem[] = [
        { id: 'bus', category: 'bus', massKg: 950 },
      ];

      const result = calculateMassBudget({
        items,
        launchMassLimitKg: 1000, // 50 kg margin = 5%
        marginThresholdPercent: 10, // Recommended: 10%
      });

      expect(result.massMarginKg).toBe(50);
      expect(result.massMarginPercent).toBe(5);
      expect(result.isWithinLaunchCapacity).toBe(true);
      expect(result.status).toBe('WARNING');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('treats absent launch mass limit as UNKNOWN, not unlimited', () => {
      const items: MassItem[] = [
        { id: 'bus', category: 'bus', massKg: 1500 },
      ];

      const result = calculateMassBudget({ items });

      expect(result.launchMassLimitKg).toBeUndefined();
      expect(result.massMarginKg).toBeUndefined();
      expect(result.massMarginPercent).toBeUndefined();
      expect(result.isWithinLaunchCapacity).toBeNull();
      expect(result.status).toBe('UNKNOWN');
      expect(result.warnings.some((w) => w.includes('capacity limit was not provided'))).toBe(true);
    });
  });

  describe('Input Validation, Edge Cases and Double-Counting Guards', () => {
    it('rejects duplicate component IDs in itemized list', () => {
      const items: MassItem[] = [
        { id: 'inst-camera', category: 'instruments', massKg: 20 },
        { id: 'inst-camera', category: 'instruments', massKg: 20 },
      ];

      expect(() => calculateMassBudget({ items })).toThrow(/Duplicate component ID/);
    });

    it('rejects simultaneous itemized items and aggregate categories to prevent double counting', () => {
      expect(() =>
        calculateMassBudget({
          items: [{ id: 'b1', category: 'bus', massKg: 500 }],
          categories: { bus: 500 },
        })
      ).toThrow(/double-counting/);
    });

    it('rejects negative component masses', () => {
      expect(() =>
        calculateMassBudget({
          items: [{ id: 'bad', category: 'bus', massKg: -100 }],
        })
      ).toThrow(RangeError);
    });

    it('rejects non-finite masses in items or categories', () => {
      expect(() =>
        calculateMassBudget({
          items: [{ id: 'bad', category: 'bus', massKg: NaN }],
        })
      ).toThrow(TypeError);

      expect(() =>
        calculateMassBudget({
          categories: { bus: Infinity },
        })
      ).toThrow(TypeError);
    });

    it('rejects spacecraft with zero dry mass', () => {
      expect(() =>
        calculateMassBudget({
          categories: { propellant: 1000 },
        })
      ).toThrow(RangeError);
    });

    it('rejects negative or zero launch mass limit', () => {
      expect(() =>
        calculateMassBudget({
          categories: { bus: 100 },
          launchMassLimitKg: -500,
        })
      ).toThrow(RangeError);

      expect(() =>
        calculateMassBudget({
          categories: { bus: 100 },
          launchMassLimitKg: 0,
        })
      ).toThrow(RangeError);
    });
  });

  describe('Rocket Equation Integration', () => {
    it('computes achieved delta-v when propellant and Isp are provided', () => {
      const result = calculateMassBudget({
        categories: {
          bus: 2340,
          propellant: 5615,
        },
        ispSeconds: 325,
        targetDeltaVMps: 3900,
        launchMassLimitKg: 10000,
      });

      // m0 = 7955 kg, mf = 2340 kg, Isp = 325 s -> deltaV ~ 3900 m/s
      expect(result.achievedDeltaVMps).toBeCloseTo(3900, 0);
    });
  });
});
