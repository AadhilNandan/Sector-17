import { describe, it, expect } from 'vitest';
import {
  calculatePowerBudget,
  calculateSolarArrayGeneration,
  calculateRadioisotopeGeneration,
  validateEfficiencyFactor,
  createEmptyLoadBreakdown,
} from '../src/simulation/engineering/powerBudget';
import type {
  SolarArrayConfig,
  RadioisotopeSourceConfig,
  PowerBudgetInput,
  PowerLoadItem,
} from '../src/simulation/types';

describe('Power Budget Engine', () => {
  describe('Efficiency Factor Validation', () => {
    it('accepts valid unit interval values [0.0, 1.0]', () => {
      expect(validateEfficiencyFactor(0.0, 'test')).toBe(0.0);
      expect(validateEfficiencyFactor(0.5, 'test')).toBe(0.5);
      expect(validateEfficiencyFactor(1.0, 'test')).toBe(1.0);
    });

    it('rejects values outside [0.0, 1.0]', () => {
      expect(() => validateEfficiencyFactor(-0.01, 'negative')).toThrow(RangeError);
      expect(() => validateEfficiencyFactor(1.01, 'excess')).toThrow(RangeError);
    });

    it('rejects non-finite values', () => {
      expect(() => validateEfficiencyFactor(NaN, 'NaN')).toThrow(TypeError);
      expect(() => validateEfficiencyFactor(Infinity, 'Infinity')).toThrow(TypeError);
    });
  });

  describe('Solar Array Generation Model', () => {
    it('computes nominal solar output at 1 AU', () => {
      const config: SolarArrayConfig = {
        type: 'solar',
        ratedPower1AuWatts: 3800, // 3.8 kW at 1 AU
        distanceAu: 1.0,
      };

      const power = calculateSolarArrayGeneration(config);
      expect(power).toBe(3800);
    });

    it('models inverse-square degradation at 5.2 AU (Jupiter distance)', () => {
      // At 5.2 AU, solar flux drops by (1 / 5.2)^2 = 1 / 27.04 ~ 0.036982 (3.7% of 1 AU flux)
      // For a 3800 W (1 AU) array, output at 5.2 AU without oversized wings is:
      // 3800 / 27.04 ~ 140.53 W
      const config: SolarArrayConfig = {
        type: 'solar',
        ratedPower1AuWatts: 3800,
        distanceAu: 5.2,
      };

      const power52 = calculateSolarArrayGeneration(config);
      const expected = 3800 / (5.2 * 5.2);
      expect(power52).toBeCloseTo(expected, 2);
      expect(power52).toBeCloseTo(140.53, 1);
    });

    it('applies degradation, pointing, and operational efficiencies', () => {
      const config: SolarArrayConfig = {
        type: 'solar',
        ratedPower1AuWatts: 10000,
        distanceAu: 2.0, // (1/2)^2 = 0.25 -> 2500 W
        degradationFactor: 0.9, // radiation aging: 0.9 -> 2250 W
        pointingEfficiency: 0.8, // off-pointing cosine loss: 0.8 -> 1800 W
        operationalEfficiency: 0.95, // temperature derating: 0.95 -> 1710 W
      };

      const power = calculateSolarArrayGeneration(config);
      expect(power).toBeCloseTo(10000 * 0.25 * 0.9 * 0.8 * 0.95, 2);
      expect(power).toBe(1710);
    });

    it('rejects negative power rating or negative distance', () => {
      expect(() =>
        calculateSolarArrayGeneration({ type: 'solar', ratedPower1AuWatts: -500, distanceAu: 1.0 })
      ).toThrow(RangeError);

      expect(() =>
        calculateSolarArrayGeneration({ type: 'solar', ratedPower1AuWatts: 500, distanceAu: -2.0 })
      ).toThrow(RangeError);
    });
  });

  describe('Radioisotope Power Source (RTG / MMRTG)', () => {
    it('computes electrical output for explicitly specified power', () => {
      const rtg: RadioisotopeSourceConfig = {
        type: 'radioisotope',
        ratedPowerWatts: 2600, // 2.6 kW
        degradationFactor: 0.95, // 5% radioactive decay over cruise
      };

      const power = calculateRadioisotopeGeneration(rtg);
      expect(power).toBe(2600 * 0.95);
      expect(power).toBe(2470);
    });

    it('rejects negative rated power', () => {
      expect(() =>
        calculateRadioisotopeGeneration({ type: 'radioisotope', ratedPowerWatts: -100 })
      ).toThrow(RangeError);
    });
  });

  describe('Integrated Power Budget & Loads', () => {
    const loads: PowerLoadItem[] = [
      { category: 'bus', powerWatts: 200, isSpecified: true, name: 'Core Avionics' },
      { category: 'communication', powerWatts: 500, isSpecified: true, name: 'Ka Dish' },
      { category: 'instruments', powerWatts: 800, isSpecified: true, name: 'Radar' },
      { category: 'thermal', powerWatts: 200, isSpecified: true, name: 'Heat Pipes' },
    ];

    it('calculates positive power margin and NOMINAL status', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 2500 }],
        loads,
        reserveThresholdPercent: 20,
      };

      const result = calculatePowerBudget(input);

      // Generation: 2500 W
      // Consumption: 200 + 500 + 800 + 200 = 1700 W
      // Net: 2500 - 1700 = 800 W
      // Reserve: 800 / 1700 ~ 47.06% (> 20%)
      expect(result.totalGenerationWatts).toBe(2500);
      expect(result.totalConsumptionWatts).toBe(1700);
      expect(result.netPowerWatts).toBe(800);
      expect(result.powerMarginWatts).toBe(800);
      expect(result.powerDeficitWatts).toBe(0);
      expect(result.powerReservePercent).toBeCloseTo((800 / 1700) * 100, 2);
      expect(result.status).toBe('NOMINAL');
    });

    it('detects electrical deficit (DEFICIT status) when consumption exceeds generation', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 1500 }],
        loads, // 1700 W
      };

      const result = calculatePowerBudget(input);

      expect(result.netPowerWatts).toBe(-200);
      expect(result.powerDeficitWatts).toBe(200);
      expect(result.status).toBe('DEFICIT');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/Electrical power deficit/);
    });

    it('detects WARNING status when power reserve is below configured threshold', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 1800 }], // Net: 100 W (5.88% reserve)
        loads, // 1700 W
        reserveThresholdPercent: 20, // Threshold 20%
      };

      const result = calculatePowerBudget(input);

      expect(result.netPowerWatts).toBe(100);
      expect(result.powerReservePercent).toBeCloseTo((100 / 1700) * 100, 1);
      expect(result.status).toBe('WARNING');
      expect(result.warnings.some((w) => w.includes('below the configured margin threshold'))).toBe(true);
    });
  });

  describe('Missing Data & Incompleteness Handling', () => {
    it('marks budget as INCOMPLETE when solar array rating is missing', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'solar' }], // Missing ratedPower1AuWatts
        loads: [{ category: 'bus', powerWatts: 200, isSpecified: true }],
      };

      const result = calculatePowerBudget(input);
      expect(result.status).toBe('INCOMPLETE');
      expect(result.isGenerationKnown).toBe(false);
      expect(result.missingData.some((m) => m.includes('lacks verified 1 AU power rating'))).toBe(true);
    });

    it('marks budget as INCOMPLETE when radioisotope output is missing', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope' }], // Missing ratedPowerWatts
        loads: [{ category: 'bus', powerWatts: 200, isSpecified: true }],
      };

      const result = calculatePowerBudget(input);
      expect(result.status).toBe('INCOMPLETE');
      expect(result.isGenerationKnown).toBe(false);
      expect(result.missingData.some((m) => m.includes('lacks verified electrical output rating'))).toBe(true);
    });

    it('marks budget as INCOMPLETE when an instrument load is unspecified', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 2000 }],
        loads: [
          { category: 'bus', powerWatts: 200, isSpecified: true },
          { category: 'instruments', isSpecified: false }, // Missing power
        ],
      };

      const result = calculatePowerBudget(input);
      expect(result.status).toBe('INCOMPLETE');
      expect(result.isConsumptionKnown).toBe(false);
      expect(result.missingData.some((m) => m.includes('instruments'))).toBe(true);
    });

    it('does NOT infer electric thruster input power from specific impulse alone', () => {
      // Thruster configured as electric, but without electrical input power
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 2000 }],
        loads: [{ category: 'bus', powerWatts: 200, isSpecified: true }],
        isElectricPropulsion: true,
        // propulsionElectricalInputPowerWatts is undefined!
      };

      const result = calculatePowerBudget(input);
      expect(result.isPropulsionFeasible).toBe(false);
      expect(result.status).toBe('INCOMPLETE');
      expect(result.missingData.some((m) => m.includes('Electric propulsion thruster is configured'))).toBe(true);
    });

    it('considers electric propulsion feasible when explicit electrical input power is supplied', () => {
      const input: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 3000 }],
        loads: [{ category: 'bus', powerWatts: 200, isSpecified: true }],
        isElectricPropulsion: true,
        propulsionElectricalInputPowerWatts: 1800, // Explicit 1.8 kW input power
      };

      const result = calculatePowerBudget(input);
      expect(result.isPropulsionFeasible).toBe(true);
      expect(result.totalConsumptionWatts).toBe(2000); // 200 + 1800
      expect(result.netPowerWatts).toBe(1000);
      expect(result.status).toBe('NOMINAL');
    });
  });
});
