/**
 * SECTOR 17 — Risk Assessment Engine Unit Tests
 * Verifies aerospace risk evaluation across flight software states, active faults,
 * electrical power deficits, thermal limits, propellant margins, and storage capacity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskAssessmentEngine } from '../src/simulation/missionDecision/riskAssessment';
import type { SpacecraftEngineeringSnapshot, DecisionResourceRequirements } from '../src/simulation/missionDecision/types';
import type { PowerBudgetResult, ThermalModelResult } from '../src/simulation/types';

describe('RiskAssessmentEngine', () => {
  let riskEngine: RiskAssessmentEngine;

  beforeEach(() => {
    riskEngine = new RiskAssessmentEngine();
  });

  const baseNominalSnapshot: SpacecraftEngineeringSnapshot = {
    currentMET: 1000,
    flightState: 'ACTIVE',
    subsystemStatuses: {
      EPS: 'NOMINAL',
      PROPULSION: 'NOMINAL',
      TCS: 'NOMINAL',
      GNC: 'NOMINAL',
      COMMUNICATIONS: 'NOMINAL',
      SCIENCE: 'NOMINAL',
      STORAGE: 'NOMINAL',
      LANDER_ROVER: 'NOMINAL',
    },
    activeFaultCount: 0,
    criticalFaultCount: 0,
    availablePropellantKg: 100.0,
    storageCapacityBytes: 1024 * 1024 * 100, // 100 MB
    storageUsedBytes: 1024 * 1024 * 10,     // 10 MB used
    isCommWindowActive: true,
  };

  it('evaluates nominal spacecraft state as NEGLIGIBLE risk with no hard constraint violations', () => {
    const req: DecisionResourceRequirements = {
      estimatedPowerWatts: 50.0,
      estimatedDurationSeconds: 600,
      requiredSubsystems: ['SCIENCE', 'EPS'],
    };

    const report = riskEngine.evaluateRisk(req, baseNominalSnapshot, 1000);
    expect(report.highestSeverity).toBe('NEGLIGIBLE');
    expect(report.hasHardConstraintViolation).toBe(false);
    expect(report.isAcceptableForExecution).toBe(true);
    expect(report.compositeRiskScore).toBeLessThanOrEqual(20.0);
  });

  it('flags restricted flight state (SAFE_MODE) as CRITICAL hard constraint', () => {
    const safeModeSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      flightState: 'SAFE_MODE',
    };

    const req: DecisionResourceRequirements = {
      estimatedPowerWatts: 150.0,
      requiredSubsystems: ['SCIENCE'],
    };

    const report = riskEngine.evaluateRisk(req, safeModeSnapshot, 1000);
    expect(report.highestSeverity).toBe('CRITICAL');
    expect(report.hasHardConstraintViolation).toBe(true);
    expect(report.isAcceptableForExecution).toBe(false);
    expect(report.risks.some((r) => r.category === 'SAFETY' && r.isHardConstraint)).toBe(true);
  });

  it('flags active critical faults as CRITICAL hard constraint', () => {
    const faultedSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      criticalFaultCount: 2,
    };

    const req: DecisionResourceRequirements = {
      requiredSubsystems: ['SCIENCE'],
    };

    const report = riskEngine.evaluateRisk(req, faultedSnapshot, 1000);
    expect(report.highestSeverity).toBe('CRITICAL');
    expect(report.hasHardConstraintViolation).toBe(true);
    expect(report.isAcceptableForExecution).toBe(false);
  });

  it('flags non-operational required subsystems as CRITICAL hard constraint', () => {
    const faultedSubsysSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      subsystemStatuses: {
        ...baseNominalSnapshot.subsystemStatuses,
        SCIENCE: 'FAULT',
      },
    };

    const req: DecisionResourceRequirements = {
      requiredSubsystems: ['SCIENCE'],
    };

    const report = riskEngine.evaluateRisk(req, faultedSubsysSnapshot, 1000);
    expect(report.highestSeverity).toBe('CRITICAL');
    expect(report.hasHardConstraintViolation).toBe(true);
    expect(report.risks.some((r) => r.category === 'SUBSYSTEM' && r.isHardConstraint)).toBe(true);
  });

  it('distinguishes between electrical power deficit (CRITICAL) and low reserve (HIGH)', () => {
    // 1. Critical Power Deficit (< 0%)
    const deficitPower: PowerBudgetResult = {
      totalGenerationWatts: 400,
      totalConsumptionWatts: 450,
      netPowerWatts: -50,
      powerMarginWatts: -50,
      powerReservePercent: -12.5,
      powerDeficitWatts: 50,
      reserveThresholdPercent: 20,
      loadBreakdownWatts: {} as any,
      status: 'DEFICIT',
      isGenerationKnown: true,
      isConsumptionKnown: true,
      isPropulsionFeasible: false,
      missingData: [],
      warnings: [],
      errors: ['Power deficit'],
    };

    const deficitSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      powerBudget: deficitPower,
    };

    const deficitReport = riskEngine.evaluateRisk({}, deficitSnapshot, 1000);
    expect(deficitReport.highestSeverity).toBe('CRITICAL');
    expect(deficitReport.hasHardConstraintViolation).toBe(true);

    // 2. Low Power Margin (< 10%, but >= 0%)
    const lowPower: PowerBudgetResult = {
      ...deficitPower,
      totalConsumptionWatts: 380,
      netPowerWatts: 20,
      powerMarginWatts: 20,
      powerReservePercent: 5.0,
      powerDeficitWatts: 0,
      status: 'WARNING',
      errors: [],
    };

    const lowPowerSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      powerBudget: lowPower,
    };

    const lowPowerReport = riskEngine.evaluateRisk({}, lowPowerSnapshot, 1000);
    expect(lowPowerReport.highestSeverity).toBe('HIGH');
    expect(lowPowerReport.hasHardConstraintViolation).toBe(false); // Manageable risk, not hard constraint
  });

  it('flags thermal breaches as CRITICAL hard constraint and narrow buffers as MODERATE', () => {
    const thermalBreach: ThermalModelResult = {
      solarFluxWattsPerM2: 50,
      solarAbsorbedPowerWatts: 100,
      internalHeatWatts: 200,
      totalThermalInWatts: 300,
      radiatedPowerWatts: 300,
      equilibriumTemperatureKelvin: 120, // Freezing: below min 173 K
      equilibriumTemperatureCelsius: -153.15,
      iterations: 5,
      converged: true,
      status: 'UNDERCOOLING',
      isWithinOperatingLimits: false,
      minOperatingTempKelvin: 173,
      maxOperatingTempKelvin: 323,
      warnings: [],
      errors: ['Thermal breach'],
    };

    const breachSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      thermalModel: thermalBreach,
    };

    const breachReport = riskEngine.evaluateRisk({}, breachSnapshot, 1000);
    expect(breachReport.highestSeverity).toBe('CRITICAL');
    expect(breachReport.hasHardConstraintViolation).toBe(true);
  });

  it('flags propellant exhaustion as CRITICAL hard constraint', () => {
    const req: DecisionResourceRequirements = {
      estimatedPropellantKg: 150.0, // Exceeds 100 kg reserve
    };

    const report = riskEngine.evaluateRisk(req, baseNominalSnapshot, 1000);
    expect(report.highestSeverity).toBe('CRITICAL');
    expect(report.hasHardConstraintViolation).toBe(true);
    expect(report.risks.some((r) => r.category === 'PROPELLANT' && r.isHardConstraint)).toBe(true);
  });

  it('flags storage overflow as CRITICAL hard constraint', () => {
    const req: DecisionResourceRequirements = {
      estimatedStorageBytes: 1024 * 1024 * 150, // 150 MB exceeds 90 MB available
    };

    const report = riskEngine.evaluateRisk(req, baseNominalSnapshot, 1000);
    expect(report.highestSeverity).toBe('CRITICAL');
    expect(report.hasHardConstraintViolation).toBe(true);
    expect(report.risks.some((r) => r.category === 'STORAGE' && r.isHardConstraint)).toBe(true);
  });

  it('flags communication unavailability as HIGH manageable risk when comm window is required', () => {
    const noCommSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseNominalSnapshot,
      isCommWindowActive: false,
    };

    const req: DecisionResourceRequirements = {
      requiresActiveCommWindow: true,
    };

    const report = riskEngine.evaluateRisk(req, noCommSnapshot, 1000);
    expect(report.highestSeverity).toBe('HIGH');
    expect(report.hasHardConstraintViolation).toBe(false); // Manageable risk, data can be held in storage
    expect(report.risks.some((r) => r.category === 'COMMUNICATIONS')).toBe(true);
  });

  describe('C-03 Defensive Numeric Input Validation', () => {
    it('rejects invalid or negative currentMET', () => {
      expect(() => riskEngine.evaluateRisk({}, baseNominalSnapshot, NaN)).toThrow(TypeError);
      expect(() => riskEngine.evaluateRisk({}, baseNominalSnapshot, -1)).toThrow(TypeError);
      expect(() => riskEngine.evaluateRisk({}, baseNominalSnapshot, Infinity)).toThrow(TypeError);
      expect(() => riskEngine.evaluateRisk({}, baseNominalSnapshot, '100' as any)).toThrow(TypeError);
    });

    it('rejects non-object requirements', () => {
      expect(() => riskEngine.evaluateRisk(null as any, baseNominalSnapshot, 1000)).toThrow(TypeError);
      expect(() => riskEngine.evaluateRisk(undefined as any, baseNominalSnapshot, 1000)).toThrow(TypeError);
      expect(() => riskEngine.evaluateRisk('invalid' as any, baseNominalSnapshot, 1000)).toThrow(TypeError);
    });

    it('rejects invalid or negative estimatedPropellantKg', () => {
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPropellantKg: NaN }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPropellantKg: Infinity }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPropellantKg: -5.0 }, baseNominalSnapshot, 1000)
      ).toThrow(RangeError);
    });

    it('rejects non-finite estimatedPowerWatts', () => {
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPowerWatts: NaN }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPowerWatts: Infinity }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPowerWatts: -Infinity }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      // Valid negative power (load shedding / power conservation) is accepted
      expect(() =>
        riskEngine.evaluateRisk({ estimatedPowerWatts: -80.0 }, baseNominalSnapshot, 1000)
      ).not.toThrow();
    });

    it('rejects invalid or negative estimatedStorageBytes', () => {
      expect(() =>
        riskEngine.evaluateRisk({ estimatedStorageBytes: NaN }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedStorageBytes: Infinity }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedStorageBytes: -1024 }, baseNominalSnapshot, 1000)
      ).toThrow(RangeError);
    });

    it('rejects invalid or negative estimatedDurationSeconds', () => {
      expect(() =>
        riskEngine.evaluateRisk({ estimatedDurationSeconds: NaN }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedDurationSeconds: Infinity }, baseNominalSnapshot, 1000)
      ).toThrow(TypeError);
      expect(() =>
        riskEngine.evaluateRisk({ estimatedDurationSeconds: -60 }, baseNominalSnapshot, 1000)
      ).toThrow(RangeError);
    });
  });
});

