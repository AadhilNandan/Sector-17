/**
 * SECTOR 17 — Mission Objective Evaluator Unit Tests
 * Verifies objective lifecycle states, prerequisite gating, deadline enforcement,
 * evidence satisfaction, and rejection of fictional scenario constructs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MissionObjectiveEvaluator } from '../src/simulation/missionDecision/missionObjectiveEvaluator';
import { DecisionEvidenceManager } from '../src/simulation/missionDecision/decisionEvidence';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { DECISION_EVENT_TYPES } from '../src/simulation/missionDecision/constants';
import type { MissionDecisionObjective } from '../src/simulation/missionDecision/types';

describe('MissionObjectiveEvaluator', () => {
  let evaluator: MissionObjectiveEvaluator;
  let evidenceManager: DecisionEvidenceManager;
  let eventEngine: MissionEventEngine;

  beforeEach(() => {
    evaluator = new MissionObjectiveEvaluator();
    evidenceManager = new DecisionEvidenceManager();
    eventEngine = new MissionEventEngine(0, true);
    evaluator.attachEventEngine(eventEngine);
  });

  it('initializes with Expedition-V default objectives in NOT_STARTED state', () => {
    const objectives = evaluator.getAllObjectives();
    expect(objectives.length).toBeGreaterThanOrEqual(5);

    const oceanObj = evaluator.getObjective('EXP-V-OBJ-01');
    expect(oceanObj).toBeDefined();
    expect(oceanObj?.state).toBe('NOT_STARTED');
    expect(oceanObj?.progressPercent).toBe(0);
  });

  it('evaluates objective as COMPLETED when all evidence requirements are met', () => {
    evidenceManager.addEvidence({
      id: 'evi-reason-reflector-01',
      sourceType: 'SCIENCE_PRODUCT',
      sourceId: 'prod-reason-01',
      provenance: 'VERIFIED',
      confidenceScore: 0.92,
      timestampMET: 1200,
      summary: 'Deep basal ice reflector detected at 2800m',
      isFictionalConstruct: false,
    });

    const report = evaluator.evaluateObjective('EXP-V-OBJ-01', evidenceManager, 1250);
    expect(report.newState).toBe('COMPLETED');
    expect(report.progressPercent).toBe(100);
    expect(report.isCompleted).toBe(true);

    const updated = evaluator.getObjective('EXP-V-OBJ-01');
    expect(updated?.state).toBe('COMPLETED');
    expect(updated?.completedAtMET).toBe(1250);
    expect(updated?.supportingEvidenceIds).toContain('evi-reason-reflector-01');
  });

  it('leaves objective as NOT_STARTED or IN_PROGRESS when evidence is missing', () => {
    const report = evaluator.evaluateObjective('EXP-V-OBJ-01', evidenceManager, 500);
    expect(report.newState).toBe('NOT_STARTED');
    expect(report.progressPercent).toBe(0);
    expect(report.isCompleted).toBe(false);
    expect(report.missingEvidenceDescriptions.length).toBeGreaterThan(0);
  });

  it('strictly blocks progression if prerequisites are not completed (BLOCKED)', () => {
    // EXP-V-OBJ-03 requires EXP-V-OBJ-01 and EXP-V-OBJ-02
    evidenceManager.addEvidence({
      id: 'evi-anomaly-01',
      sourceType: 'ANOMALY_REPORT',
      sourceId: 'anom-hydrothermal-01',
      provenance: 'VERIFIED',
      confidenceScore: 0.95,
      timestampMET: 2000,
      summary: 'Hydrothermal vent correlation confirmed',
      isFictionalConstruct: false,
    });

    const report = evaluator.evaluateObjective('EXP-V-OBJ-03', evidenceManager, 2050);
    expect(report.newState).toBe('BLOCKED');
    expect(report.satisfiesPrerequisites).toBe(false);
    expect(report.unsatisfiedPrerequisites).toContain('EXP-V-OBJ-01');
    expect(report.unsatisfiedPrerequisites).toContain('EXP-V-OBJ-02');
  });

  it('transitions to COMPLETED once all prerequisites are satisfied', () => {
    // Satisfy EXP-V-OBJ-01
    evidenceManager.addEvidence({
      id: 'evi-reason-01',
      sourceType: 'SCIENCE_PRODUCT',
      sourceId: 'prod-reason-01',
      provenance: 'VERIFIED',
      confidenceScore: 0.85,
      timestampMET: 1000,
      summary: 'Ocean interface detected',
      isFictionalConstruct: false,
    });
    evaluator.evaluateObjective('EXP-V-OBJ-01', evidenceManager, 1050);

    // Satisfy EXP-V-OBJ-02
    evidenceManager.addEvidence({
      id: 'evi-maspex-01',
      sourceType: 'SCIENCE_PRODUCT',
      sourceId: 'prod-maspex-01',
      provenance: 'VERIFIED',
      confidenceScore: 0.88,
      timestampMET: 1100,
      summary: 'Methane and organics confirmed',
      isFictionalConstruct: false,
    });
    evaluator.evaluateObjective('EXP-V-OBJ-02', evidenceManager, 1150);

    // Satisfy EXP-V-OBJ-03 evidence
    evidenceManager.addEvidence({
      id: 'evi-anom-01',
      sourceType: 'ANOMALY_REPORT',
      sourceId: 'anom-vent-01',
      provenance: 'VERIFIED',
      confidenceScore: 0.9,
      timestampMET: 1200,
      summary: 'Co-located plume and radar vent anomaly',
      isFictionalConstruct: false,
    });

    const report = evaluator.evaluateObjective('EXP-V-OBJ-03', evidenceManager, 1250);
    expect(report.newState).toBe('COMPLETED');
    expect(report.satisfiesPrerequisites).toBe(true);
  });

  it('marks objective as FAILED when MET deadline is exceeded', () => {
    const deadlineObj: MissionDecisionObjective = {
      id: 'OBJ-TIMED-01',
      title: 'Time-Critical Plume Encounter',
      description: 'Acquire plume sample before spacecraft flyby periapsis exit',
      priority: 'CRITICAL',
      prerequisites: [],
      evidenceRequirements: [
        {
          requiredSourceType: 'SCIENCE_PRODUCT',
          minConfidenceScore: 0.7,
          allowedProvenances: ['VERIFIED'],
          description: 'Plume mass spectrum',
          rejectFictional: true,
        },
      ],
      deadlineMET: 3600, // 1 hour deadline
      state: 'NOT_STARTED',
      progressPercent: 0,
      supportingEvidenceIds: [],
    };

    evaluator.registerObjective(deadlineObj);

    // Before deadline: NOT_STARTED
    const report1 = evaluator.evaluateObjective('OBJ-TIMED-01', evidenceManager, 3500);
    expect(report1.newState).toBe('NOT_STARTED');

    // After deadline: FAILED
    const report2 = evaluator.evaluateObjective('OBJ-TIMED-01', evidenceManager, 3601);
    expect(report2.newState).toBe('FAILED');
    expect(report2.isFailed).toBe(true);
    expect(report2.failureReason).toContain('Deadline exceeded');
  });

  it('strictly rejects fictional scenario constructs (Relic-Omega) from fulfilling physical science objectives', () => {
    evidenceManager.addEvidence({
      id: 'evi-relic-omega-01',
      sourceType: 'SCIENCE_PRODUCT',
      sourceId: 'prod-relic-omega',
      provenance: 'FICTIONAL',
      confidenceScore: 0.99,
      timestampMET: 1000,
      summary: 'Anomalous alien transmission pattern',
      isFictionalConstruct: true, // Fictional construct!
    });

    const report = evaluator.evaluateObjective('EXP-V-OBJ-01', evidenceManager, 1050);
    expect(report.newState).toBe('NOT_STARTED');
    expect(report.progressPercent).toBe(0);
    expect(report.isCompleted).toBe(false);
  });

  it('throws TypeError when registering invalid objective definitions', () => {
    expect(() => {
      evaluator.registerObjective(null as any);
    }).toThrow(TypeError);

    expect(() => {
      evaluator.registerObjective({ id: '' } as any);
    }).toThrow(TypeError);
  });

  it('detects and rejects self-referential prerequisite cycles (C-02)', () => {
    const selfPrereqObj: MissionDecisionObjective = {
      id: 'OBJ-CYCLE-SELF',
      title: 'Self-Referencing Objective',
      description: 'Invalid self-loop',
      priority: 'HIGH',
      prerequisites: ['OBJ-CYCLE-SELF'],
      evidenceRequirements: [],
      state: 'NOT_STARTED',
      progressPercent: 0,
      supportingEvidenceIds: [],
    };

    expect(() => {
      evaluator.registerObjective(selfPrereqObj);
    }).toThrow(/Circular dependency detected.*cannot list itself/);
  });

  it('detects and rejects transitive circular prerequisite chains (C-02)', () => {
    const objA: MissionDecisionObjective = {
      id: 'OBJ-CHAIN-A',
      title: 'Chain A',
      description: 'First node in cycle',
      priority: 'MEDIUM',
      prerequisites: [],
      evidenceRequirements: [],
      state: 'NOT_STARTED',
      progressPercent: 0,
      supportingEvidenceIds: [],
    };

    const objB: MissionDecisionObjective = {
      id: 'OBJ-CHAIN-B',
      title: 'Chain B',
      description: 'Second node in cycle',
      priority: 'MEDIUM',
      prerequisites: ['OBJ-CHAIN-A'],
      evidenceRequirements: [],
      state: 'NOT_STARTED',
      progressPercent: 0,
      supportingEvidenceIds: [],
    };

    evaluator.registerObjective(objA);
    evaluator.registerObjective(objB);

    // Registering an update or new objective that loops back: A depending on B
    const cyclicObjA: MissionDecisionObjective = {
      ...objA,
      prerequisites: ['OBJ-CHAIN-B'],
    };

    expect(() => {
      evaluator.registerObjective(cyclicObjA);
    }).toThrow(/Circular dependency detected.*creates a prerequisite cycle/);
  });

  it('emits MISSION_OBJECTIVE_UPDATED when progressPercent changes without a state transition (C-02)', () => {
    const multiRequirementObj: MissionDecisionObjective = {
      id: 'OBJ-MULTI-EVI',
      title: 'Multi-Evidence Survey',
      description: 'Requires two evidence pieces',
      priority: 'HIGH',
      prerequisites: [],
      evidenceRequirements: [
        {
          requiredSourceType: 'SCIENCE_PRODUCT',
          minConfidenceScore: 0.5,
          allowedProvenances: ['VERIFIED'],
          description: 'Radar sounding 1',
          rejectFictional: true,
        },
        {
          requiredSourceType: 'ANOMALY_REPORT',
          minConfidenceScore: 0.5,
          allowedProvenances: ['VERIFIED'],
          description: 'Anomaly report 2',
          rejectFictional: true,
        },
      ],
      state: 'IN_PROGRESS',
      progressPercent: 0,
      supportingEvidenceIds: [],
    };

    evaluator.registerObjective(multiRequirementObj);

    // Ingest first requirement: state remains IN_PROGRESS, but progress jumps from 0 to 50%
    evidenceManager.addEvidence({
      id: 'evi-part-1',
      sourceType: 'SCIENCE_PRODUCT',
      sourceId: 'prod-01',
      provenance: 'VERIFIED',
      confidenceScore: 0.8,
      timestampMET: 100,
      summary: 'Partial evidence 1',
      isFictionalConstruct: false,
    });

    evaluator.evaluateObjective('OBJ-MULTI-EVI', evidenceManager, 100);

    const events = eventEngine.getScheduler().getAllEvents();
    const updateEvent = events.find(
      (e) => e.type === DECISION_EVENT_TYPES.MISSION_OBJECTIVE_UPDATED && (e.payload as any)?.objectiveId === 'OBJ-MULTI-EVI'
    );
    expect(updateEvent).toBeDefined();
    expect((updateEvent?.payload as any)?.previousProgressPercent).toBe(0);
    expect((updateEvent?.payload as any)?.progressPercent).toBe(50);
  });
});

