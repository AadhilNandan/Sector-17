import { describe, it, expect } from 'vitest';
import { validateSpacecraft } from '../src/simulation/engineering/spacecraftValidator';
import type {
  SpacecraftValidationInput,
  MassBudgetInput,
  PowerBudgetInput,
  ThermalModelInput,
} from '../src/simulation/types';

describe('Spacecraft Validation Engine', () => {
  // Baseline nominal inputs
  const nominalMassInput: MassBudgetInput = {
    categories: {
      bus: 1200,
      propulsionDry: 400,
      propellant: 1500,
      instruments: 300,
      communication: 200,
      power: 300,
      thermal: 200,
    },
    launchMassLimitKg: 6000, // Total wet: 4100 kg, well within 6000 kg (31.7% margin)
    marginThresholdPercent: 10,
  };

  const nominalPowerInput: PowerBudgetInput = {
    sources: [{ type: 'radioisotope', ratedPowerWatts: 3000 }],
    loads: [
      { category: 'bus', powerWatts: 300, isSpecified: true },
      { category: 'communication', powerWatts: 500, isSpecified: true },
      { category: 'instruments', powerWatts: 800, isSpecified: true },
      { category: 'thermal', powerWatts: 200, isSpecified: true },
    ],
    reserveThresholdPercent: 20, // Consumption: 1800 W, Generation: 3000 W (66.7% reserve)
  };

  const nominalThermalInput: ThermalModelInput = {
    solarAbsorptivity: 0.3,
    projectedAreaM2: 2.0,
    surfaceEmissivity: 0.8,
    radiatingAreaM2: 8.0,
    distanceAu: 1.0,
    internalHeatDissipationWatts: 500,
    minOperatingTempKelvin: 200,
    maxOperatingTempKelvin: 350,
  };

  describe('Fully Feasible Spacecraft (PASS)', () => {
    it('returns overall PASS when all subsystems satisfy engineering constraints', () => {
      const input: SpacecraftValidationInput = {
        massBudget: nominalMassInput,
        powerBudget: nominalPowerInput,
        thermalModel: nominalThermalInput,
        componentCompleteness: {
          missingComponentSpecs: [],
          unverifiedComponents: [],
        },
      };

      const report = validateSpacecraft(input);

      expect(report.overallStatus).toBe('PASS');
      expect(report.subsystems.mass.status).toBe('PASS');
      expect(report.subsystems.power.status).toBe('PASS');
      expect(report.subsystems.thermal.status).toBe('PASS');
      expect(report.subsystems.completeness.status).toBe('PASS');
      expect(report.failures).toHaveLength(0);
      expect(report.missingData).toHaveLength(0);

      // Verify metrics
      expect(report.metrics.totalWetMassKg).toBe(4100);
      expect(report.metrics.launchMassLimitKg).toBe(6000);
      expect(report.metrics.netPowerWatts).toBe(1200);
      expect(report.metrics.equilibriumTemperatureKelvin).toBeDefined();
    });
  });

  describe('Subsystem Failures (FAIL)', () => {
    it('fails overall validation when mass exceeds launch capacity', () => {
      const heavyMass: MassBudgetInput = {
        ...nominalMassInput,
        launchMassLimitKg: 3000, // Wet mass is 4100 kg, exceeding limit!
      };

      const report = validateSpacecraft({
        massBudget: heavyMass,
        powerBudget: nominalPowerInput,
        thermalModel: nominalThermalInput,
      });

      expect(report.overallStatus).toBe('FAIL');
      expect(report.subsystems.mass.status).toBe('FAIL');
      expect(report.failures.some((f) => f.includes('exceeds launch vehicle capacity'))).toBe(true);
    });

    it('fails overall validation when power is in deficit', () => {
      const deficitPower: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 1000 }], // 1000 W gen vs 1800 W load
        loads: nominalPowerInput.loads,
      };

      const report = validateSpacecraft({
        massBudget: nominalMassInput,
        powerBudget: deficitPower,
        thermalModel: nominalThermalInput,
      });

      expect(report.overallStatus).toBe('FAIL');
      expect(report.subsystems.power.status).toBe('FAIL');
      expect(report.failures.some((f) => f.includes('Electrical power deficit'))).toBe(true);
    });

    it('fails overall validation when thermal operating limits are breached', () => {
      const overheatingThermal: ThermalModelInput = {
        ...nominalThermalInput,
        solarAbsorptivity: 0.95,
        surfaceEmissivity: 0.1,
        maxOperatingTempKelvin: 280, // Very low limit, will overheat
      };

      const report = validateSpacecraft({
        massBudget: nominalMassInput,
        powerBudget: nominalPowerInput,
        thermalModel: overheatingThermal,
      });

      expect(report.overallStatus).toBe('FAIL');
      expect(report.subsystems.thermal.status).toBe('FAIL');
      expect(report.failures.some((f) => f.includes('exceeds maximum operating limit'))).toBe(true);
    });
  });

  describe('Missing Data & Incompleteness Invariants (INCOMPLETE)', () => {
    it('guarantees that missing data NEVER becomes PASS', () => {
      // Missing power source ratings and missing launch limit
      const incompleteInput: SpacecraftValidationInput = {
        massBudget: {
          categories: { bus: 1000 },
          // No launchMassLimitKg
        },
        powerBudget: {
          sources: [{ type: 'solar' }], // Missing ratedPower1AuWatts
          loads: [{ category: 'bus', powerWatts: 200, isSpecified: true }],
        },
      };

      const report = validateSpacecraft(incompleteInput);

      expect(report.overallStatus).toBe('INCOMPLETE');
      expect(report.subsystems.power.status).toBe('INCOMPLETE');
      expect(report.subsystems.mass.status).toBe('INCOMPLETE');
      expect(report.missingData.length).toBeGreaterThan(0);
    });

    it('marks overall status as INCOMPLETE when electric thruster lacks electrical input power', () => {
      const input: SpacecraftValidationInput = {
        massBudget: nominalMassInput,
        powerBudget: {
          sources: [{ type: 'radioisotope', ratedPowerWatts: 3000 }],
          loads: [{ category: 'bus', powerWatts: 300, isSpecified: true }],
          isElectricPropulsion: true,
          // Missing propulsionElectricalInputPowerWatts!
        },
        thermalModel: nominalThermalInput,
      };

      const report = validateSpacecraft(input);

      expect(report.overallStatus).toBe('INCOMPLETE');
      expect(report.subsystems.power.status).toBe('INCOMPLETE');
      expect(report.missingData.some((m) => m.includes('Electric propulsion thruster'))).toBe(true);
    });

    it('marks overall status as INCOMPLETE when component specifications are missing', () => {
      const input: SpacecraftValidationInput = {
        massBudget: nominalMassInput,
        powerBudget: nominalPowerInput,
        thermalModel: nominalThermalInput,
        componentCompleteness: {
          missingComponentSpecs: ['Antenna Gain dBi', 'Transmitter RF Power'],
          unverifiedComponents: ['Xenon Feed System'],
        },
      };

      const report = validateSpacecraft(input);

      expect(report.overallStatus).toBe('INCOMPLETE');
      expect(report.subsystems.completeness.status).toBe('INCOMPLETE');
      expect(report.missingData.some((m) => m.includes('Antenna Gain dBi'))).toBe(true);
    });
  });

  describe('Mixed Warning and Pass Conditions (WARNING)', () => {
    it('returns overall WARNING when feasible but safety margins are tight', () => {
      const lowMarginMass: MassBudgetInput = {
        categories: { bus: 1900 },
        launchMassLimitKg: 2000, // Margin is 100 kg = 5% (< 10% threshold)
        marginThresholdPercent: 10,
      };

      const lowReservePower: PowerBudgetInput = {
        sources: [{ type: 'radioisotope', ratedPowerWatts: 1050 }],
        loads: [{ category: 'bus', powerWatts: 1000, isSpecified: true }],
        reserveThresholdPercent: 20, // Net: 50 W = 5% (< 20% threshold)
      };

      const report = validateSpacecraft({
        massBudget: lowMarginMass,
        powerBudget: lowReservePower,
        thermalModel: nominalThermalInput,
      });

      expect(report.overallStatus).toBe('WARNING');
      expect(report.subsystems.mass.status).toBe('WARNING');
      expect(report.subsystems.power.status).toBe('WARNING');
      expect(report.failures).toHaveLength(0);
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it('prioritizes FAIL over INCOMPLETE and WARNING', () => {
      // Hard failure in mass, but missing data in power
      const report = validateSpacecraft({
        massBudget: {
          categories: { bus: 5000 },
          launchMassLimitKg: 2000, // EXCEEDED -> FAIL
        },
        powerBudget: {
          sources: [{ type: 'solar' }], // Missing rated power -> INCOMPLETE
          loads: [{ category: 'bus', powerWatts: 200, isSpecified: true }],
        },
        thermalModel: nominalThermalInput,
      });

      expect(report.overallStatus).toBe('FAIL');
      expect(report.subsystems.mass.status).toBe('FAIL');
      expect(report.subsystems.power.status).toBe('INCOMPLETE');
    });
  });
});
