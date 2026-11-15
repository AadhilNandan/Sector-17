/**
 * SECTOR 17 — Decision Lifecycle & Validation Unit Tests
 * Verifies option generation, validation gates (FEASIBLE, INFEASIBLE, INCOMPLETE, EXPIRED),
 * commander authorization, and immutable history tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionOptionGenerator } from '../src/simulation/missionDecision/decisionOptionGenerator';
import { DecisionValidator } from '../src/simulation/missionDecision/decisionValidator';
import { DecisionAuthorizationEngine } from '../src/simulation/missionDecision/decisionAuthorization';
import { DecisionEvidenceManager } from '../src/simulation/missionDecision/decisionEvidence';
import { MissionObjectiveEvaluator } from '../src/simulation/missionDecision/missionObjectiveEvaluator';
import { RiskAssessmentEngine } from '../src/simulation/missionDecision/riskAssessment';
import { DecisionHistoryTracker } from '../src/simulation/missionDecision/decisionHistory';
import type { SpacecraftEngineeringSnapshot, DecisionOption } from '../src/simulation/missionDecision/types';

describe('Decision Lifecycle and Validation', () => {
  let riskEngine: RiskAssessmentEngine;
  let optionGenerator: DecisionOptionGenerator;
  let validator: DecisionValidator;
  let authEngine: DecisionAuthorizationEngine;
  let evidenceManager: DecisionEvidenceManager;
  let objectiveEvaluator: MissionObjectiveEvaluator;
  let historyTracker: DecisionHistoryTracker;

  const baseSnapshot: SpacecraftEngineeringSnapshot = {
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
    availablePropellantKg: 50.0,
    storageCapacityBytes: 1024 * 1024 * 50,
    storageUsedBytes: 1024 * 1024 * 5,
    isCommWindowActive: true,
  };

  beforeEach(() => {
    riskEngine = new RiskAssessmentEngine();
    optionGenerator = new DecisionOptionGenerator(riskEngine);
    validator = new DecisionValidator();
    authEngine = new DecisionAuthorizationEngine();
    evidenceManager = new DecisionEvidenceManager();
    objectiveEvaluator = new MissionObjectiveEvaluator();
    historyTracker = new DecisionHistoryTracker();

    evidenceManager.ingestEngineeringSnapshot(baseSnapshot);
  });

  /* -------------------------------------------------------------------------- */
  /* Option Generation                                                          */
  /* -------------------------------------------------------------------------- */

  it('generates contextual options supported by spacecraft architecture', () => {
    const options = optionGenerator.generateOptions(evidenceManager, 1000);
    const categories = options.map((o) => o.category);

    expect(categories).toContain('CONTINUE_INVESTIGATION');
    expect(categories).toContain('PRESERVE_SPACECRAFT');
    expect(categories).toContain('DEPLOY_LANDER'); // Subsystem present
    expect(categories).toContain('ABORT_OR_SUSPEND');
    expect(categories).not.toContain('PRIORITIZE_ANOMALY'); // No anomalies in evidence yet
  });

  it('generates PRIORITIZE_ANOMALY only when anomaly evidence exists', () => {
    evidenceManager.addEvidence({
      id: 'evi-anom-vent',
      sourceType: 'ANOMALY_REPORT',
      sourceId: 'anom-vent-42',
      provenance: 'VERIFIED',
      confidenceScore: 0.9,
      timestampMET: 1000,
      summary: 'Hydrothermal vent signal',
      isFictionalConstruct: false,
    });

    const options = optionGenerator.generateOptions(evidenceManager, 1000);
    const anomOption = options.find((o) => o.category === 'PRIORITIZE_ANOMALY');
    expect(anomOption).toBeDefined();
    expect(anomOption?.title).toContain('anom-vent-42');
  });

  it('strictly omits DEPLOY_LANDER when spacecraft lacks LANDER_ROVER architecture', () => {
    const orbiterOnlySnapshot: SpacecraftEngineeringSnapshot = {
      ...baseSnapshot,
      subsystemStatuses: {
        EPS: 'NOMINAL',
        PROPULSION: 'NOMINAL',
        TCS: 'NOMINAL',
        GNC: 'NOMINAL',
        COMMUNICATIONS: 'NOMINAL',
        SCIENCE: 'NOMINAL',
        STORAGE: 'NOMINAL',
        // No LANDER_ROVER
      } as any,
    };
    evidenceManager.ingestEngineeringSnapshot(orbiterOnlySnapshot);

    const options = optionGenerator.generateOptions(evidenceManager, 1000);
    expect(options.some((o) => o.category === 'DEPLOY_LANDER')).toBe(false);
  });

  /* -------------------------------------------------------------------------- */
  /* Validation Gates                                                           */
  /* -------------------------------------------------------------------------- */

  it('distinguishes missing resource telemetry (INCOMPLETE) from shortage (INFEASIBLE)', () => {
    const optionWithPropellant: DecisionOption = {
      id: 'opt-burn-01',
      category: 'CONTINUE_INVESTIGATION',
      title: 'Orbit Correction Burn',
      description: 'Burn 10kg propellant',
      evidenceReferences: [],
      prerequisites: [],
      resourceRequirements: {
        estimatedPropellantKg: 10.0,
      },
      riskAssessment: {
        compositeRiskScore: 10,
        highestSeverity: 'NEGLIGIBLE',
        hasHardConstraintViolation: false,
        risks: [],
        isAcceptableForExecution: true,
        evaluationMET: 1000,
      },
    };

    // 1. Missing telemetry -> INCOMPLETE (NEVER FEASIBLE)
    const incompleteSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseSnapshot,
      availablePropellantKg: undefined, // Missing measurement!
    };

    const resIncomplete = validator.validate(optionWithPropellant, incompleteSnapshot, objectiveEvaluator, 1000);
    expect(resIncomplete.status).toBe('INCOMPLETE');
    expect(resIncomplete.missingResourceMetrics).toContain('availablePropellantKg');

    // 2. Telemetry present but insufficient -> INFEASIBLE
    const shortageSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseSnapshot,
      availablePropellantKg: 5.0, // Shortage (requires 10kg)
    };

    const resInfeasible = validator.validate(optionWithPropellant, shortageSnapshot, objectiveEvaluator, 1000);
    expect(resInfeasible.status).toBe('INFEASIBLE');
    expect(resInfeasible.constraintViolations.some((v) => v.includes('Propellant shortage'))).toBe(true);

    // 3. Telemetry present and sufficient -> FEASIBLE
    const sufficientSnapshot: SpacecraftEngineeringSnapshot = {
      ...baseSnapshot,
      availablePropellantKg: 50.0,
    };

    const resFeasible = validator.validate(optionWithPropellant, sufficientSnapshot, objectiveEvaluator, 1000);
    expect(resFeasible.status).toBe('FEASIBLE');
  });

  it('validates expired options as EXPIRED', () => {
    const expiredOption: DecisionOption = {
      id: 'opt-exp-01',
      category: 'CONTINUE_INVESTIGATION',
      title: 'Flyby Sounding Window',
      description: 'Sounding window during periapsis',
      evidenceReferences: [],
      prerequisites: [],
      resourceRequirements: {},
      riskAssessment: {
        compositeRiskScore: 10,
        highestSeverity: 'NEGLIGIBLE',
        hasHardConstraintViolation: false,
        risks: [],
        isAcceptableForExecution: true,
        evaluationMET: 1000,
      },
      expirationMET: 1500,
    };

    // Before expiration
    const res1 = validator.validate(expiredOption, baseSnapshot, objectiveEvaluator, 1400);
    expect(res1.status).toBe('FEASIBLE');

    // After expiration
    const res2 = validator.validate(expiredOption, baseSnapshot, objectiveEvaluator, 1501);
    expect(res2.status).toBe('EXPIRED');
  });

  it('validates options with unmet prerequisites as INFEASIBLE', () => {
    const prereqOption: DecisionOption = {
      id: 'opt-lander-01',
      category: 'DEPLOY_LANDER',
      title: 'Deploy Lander',
      description: 'Deploy to ice surface',
      evidenceReferences: [],
      prerequisites: ['EXP-V-OBJ-01'], // Requires radar characterization
      resourceRequirements: {},
      riskAssessment: {
        compositeRiskScore: 10,
        highestSeverity: 'NEGLIGIBLE',
        hasHardConstraintViolation: false,
        risks: [],
        isAcceptableForExecution: true,
        evaluationMET: 1000,
      },
    };

    // EXP-V-OBJ-01 is NOT_STARTED
    const res = validator.validate(prereqOption, baseSnapshot, objectiveEvaluator, 1000);
    expect(res.status).toBe('INFEASIBLE');
    expect(res.constraintViolations.some((v) => v.includes('EXP-V-OBJ-01'))).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* Authorization Lifecycle                                                    */
  /* -------------------------------------------------------------------------- */

  it('manages decision lifecycle (PROPOSED -> APPROVED / REJECTED)', () => {
    const option: DecisionOption = {
      id: 'opt-survey-01',
      category: 'CONTINUE_INVESTIGATION',
      title: 'Radar Survey',
      description: 'Chirp radar sounding',
      evidenceReferences: [],
      prerequisites: [],
      resourceRequirements: {},
      riskAssessment: {
        compositeRiskScore: 10,
        highestSeverity: 'NEGLIGIBLE',
        hasHardConstraintViolation: false,
        risks: [],
        isAcceptableForExecution: true,
        evaluationMET: 1000,
      },
    };

    // Propose
    const record = authEngine.propose(option, 1000);
    expect(record.status).toBe('PROPOSED');

    // Authorize (Approve)
    const approved = authEngine.authorize(option.id, true, 'Approved by mission commander', 1010);
    expect(approved.status).toBe('APPROVED');
    expect(approved.authorizedAtMET).toBe(1010);
    expect(approved.authorizationReason).toBe('Approved by mission commander');

    // Cannot authorize twice
    expect(() => {
      authEngine.authorize(option.id, false, 'Reject after approve', 1020);
    }).toThrow(Error);
  });

  it('strictly prevents duplicate decision proposals with identical IDs', () => {
    const opt: DecisionOption = {
      id: 'opt-duplicate',
      category: 'PRESERVE_SPACECRAFT',
      title: 'Duplicate Test',
      description: '',
      evidenceReferences: [],
      prerequisites: [],
      resourceRequirements: {},
      riskAssessment: {} as any,
    };

    authEngine.propose(opt, 1000);
    expect(() => {
      authEngine.propose(opt, 1005);
    }).toThrow(Error);
  });

  it('strictly rejects authorization approval of INFEASIBLE or INCOMPLETE decisions at engine level', () => {
    const infeasibleOpt: DecisionOption = {
      id: 'opt-infeasible-engine-test',
      category: 'DEPLOY_LANDER',
      title: 'Infeasible Lander Descent',
      description: 'Lander not equipped',
      evidenceReferences: [],
      prerequisites: [],
      resourceRequirements: {},
      riskAssessment: {
        compositeRiskScore: 90,
        highestSeverity: 'CRITICAL',
        hasHardConstraintViolation: true,
        risks: [],
        isAcceptableForExecution: false,
        evaluationMET: 1000,
      },
      validationResult: {
        status: 'INFEASIBLE',
        reasons: ['Hardware not equipped'],
        missingResourceMetrics: [],
        constraintViolations: ['HARD_CONSTRAINT'],
        validatedAtMET: 1000,
      },
    };

    authEngine.propose(infeasibleOpt, 1000);

    // Attempting to approve an infeasible decision throws error
    expect(() => {
      authEngine.authorize(infeasibleOpt.id, true, 'Approved by lead', 1005);
    }).toThrow(/Cannot approve decision .* with validation status 'INFEASIBLE'/);

    // Rejection of an infeasible decision is permitted
    const rejected = authEngine.authorize(infeasibleOpt.id, false, 'Rejected due to infeasibility', 1006);
    expect(rejected.status).toBe('REJECTED');
  });

  it('archives immutable, frozen decision snapshots into history', () => {
    const opt: DecisionOption = {
      id: 'opt-archive-test',
      category: 'CONTINUE_INVESTIGATION',
      title: 'Archive Test',
      description: 'Test immutable snapshot',
      evidenceReferences: ['evi-1'],
      prerequisites: [],
      resourceRequirements: { estimatedPowerWatts: 100 },
      riskAssessment: {
        compositeRiskScore: 15,
        highestSeverity: 'LOW',
        hasHardConstraintViolation: false,
        risks: [],
        isAcceptableForExecution: true,
        evaluationMET: 1000,
      },
    };

    const record = authEngine.propose(opt, 1000);
    historyTracker.archiveRecord(record);

    const archived = historyTracker.getRecord(opt.id);
    expect(archived).toBeDefined();
    expect(archived?.status).toBe('PROPOSED');

    // Verify immutability: attempting to mutate frozen history throws error in strict mode
    expect(() => {
      (archived as any).status = 'EXECUTED';
    }).toThrow();
  });

  describe('C-04 Decision Authorization Expiration Boundary', () => {
    it('permits authorization at the exact expiration MET boundary (currentMET <= expirationMET)', () => {
      const option: DecisionOption = {
        id: 'opt-boundary-valid',
        category: 'CONTINUE_INVESTIGATION',
        title: 'Boundary Authorization Valid',
        description: 'Test boundary authorization',
        evidenceReferences: [],
        prerequisites: [],
        resourceRequirements: {},
        riskAssessment: {
          compositeRiskScore: 10,
          highestSeverity: 'NEGLIGIBLE',
          hasHardConstraintViolation: false,
          risks: [],
          isAcceptableForExecution: true,
          evaluationMET: 1000,
        },
        expirationMET: 1200,
      };

      authEngine.propose(option, 1000);

      // Authorize exactly at expirationMET = 1200
      const authorized = authEngine.authorize(option.id, true, 'Authorized on deadline boundary', 1200);
      expect(authorized.status).toBe('APPROVED');
      expect(authorized.authorizedAtMET).toBe(1200);
    });

    it('strictly rejects authorization after expiration MET (currentMET > expirationMET) and marks EXPIRED', () => {
      const option: DecisionOption = {
        id: 'opt-boundary-expired',
        category: 'CONTINUE_INVESTIGATION',
        title: 'Boundary Authorization Expired',
        description: 'Test expired authorization rejection',
        evidenceReferences: [],
        prerequisites: [],
        resourceRequirements: {},
        riskAssessment: {
          compositeRiskScore: 10,
          highestSeverity: 'NEGLIGIBLE',
          hasHardConstraintViolation: false,
          risks: [],
          isAcceptableForExecution: true,
          evaluationMET: 1000,
        },
        expirationMET: 1200,
      };

      authEngine.propose(option, 1000);

      // Attempt authorization at MET 1201 (strictly after expiration)
      expect(() => {
        authEngine.authorize(option.id, true, 'Late authorization attempt', 1201);
      }).toThrow(/Cannot authorize expired decision.*Expired at MET 1200/);

      const record = authEngine.getRecord(option.id);
      expect(record?.status).toBe('EXPIRED');
    });
  });
});

