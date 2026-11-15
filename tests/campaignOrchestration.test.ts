// @vitest-environment happy-dom
/**
 * SECTOR 17 — Campaign Progression & Mission Orchestration Test Suite
 * Comprehensive verification of the 18-stage expedition state machine,
 * requirement evaluators, event bridge, persistence, route gating, and React UI.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationProvider } from '../src/runtime/SimulationContext';
import {
  CampaignManager,
  CampaignStateMachine,
  CampaignTransitionError,
  CampaignRequirementsEvaluator,
  CampaignEventBridge,
  CampaignPersistenceEngine,
  CURRENT_SAVE_SCHEMA_VERSION,
  CAMPAIGN_STAGES_SEQUENCE,
  CAMPAIGN_STAGE_CONFIGS,
} from '../src/campaign';
import { CampaignOverviewScreen } from '../src/features/screens/campaign/CampaignOverviewScreen';
import { CampaignContinueButton } from '../src/features/screens/campaign/CampaignContinueButton';
import { CampaignRouteGuard } from '../src/router/CampaignRouteGuard';
import type { ReasonLevel2Product } from '../src/simulation/science/types';
import type { PropulsionSubsystem } from '../src/simulation/flightSoftware/subsystemManager';

describe('Campaign Progression & Mission Orchestration', () => {
  const testCampaignId = 'test-campaign-orchestration';
  let runtime: SimulationRuntime;
  let manager: CampaignManager;
  let persistence: CampaignPersistenceEngine;

  beforeEach(() => {
    persistence = new CampaignPersistenceEngine();
    runtime = SimulationRuntime.getOrCreate(testCampaignId, {
      initialState: 'ACTIVE',
      propellantCapacityKg: 2450.0,
    });
    manager = runtime.getCampaignManager();
  });

  afterEach(() => {
    cleanup();
    runtime.dispose();
    persistence.clearMemoryStore();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Campaign Initialization                                                 */
  /* -------------------------------------------------------------------------- */
  it('1. initializes campaign in CAMPAIGN_INTRO with active status and meaningful progress', () => {
    expect(manager.getCurrentStageId()).toBe('CAMPAIGN_INTRO');
    expect(manager.getStatus()).toBe('ACTIVE');
    expect(manager.getCompletedStages()).toEqual([]);

    const history = manager.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].stageId).toBe('CAMPAIGN_INTRO');
    expect(history[0].status).toBe('ACTIVE');
    expect(history[0].enteredAtMET).toBe(0);

    const snapshot = manager.getSnapshot();
    expect(snapshot.campaignId).toBe(testCampaignId);
    expect(snapshot.overallProgressPercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);

    // Verify all 18 stages exist in sequence
    expect(CAMPAIGN_STAGES_SEQUENCE.length).toBe(18);
    expect(CAMPAIGN_STAGES_SEQUENCE[0]).toBe('CAMPAIGN_INTRO');
    expect(CAMPAIGN_STAGES_SEQUENCE[17]).toBe('CAMPAIGN_COMPLETED');
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Valid Stage Transitions                                                 */
  /* -------------------------------------------------------------------------- */
  it('2. executes valid sequential stage transitions and allowable redesign rollbacks', () => {
    // CAMPAIGN_INTRO -> MISSION_SELECTION
    const canProgress1 = manager.canProgressTo('MISSION_SELECTION');
    expect(canProgress1.canProgress).toBe(true);

    const res1 = manager.advanceToStage('MISSION_SELECTION');
    expect(res1.success).toBe(true);
    expect(res1.fromStage).toBe('CAMPAIGN_INTRO');
    expect(res1.toStage).toBe('MISSION_SELECTION');
    expect(manager.getCurrentStageId()).toBe('MISSION_SELECTION');
    expect(manager.getCompletedStages()).toContain('CAMPAIGN_INTRO');

    // Advance to SPACECRAFT_DESIGN
    const res2 = manager.advanceToStage('SPACECRAFT_DESIGN');
    expect(res2.success).toBe(true);
    expect(manager.getCurrentStageId()).toBe('SPACECRAFT_DESIGN');

    // Advance to ENGINEERING_VALIDATION
    const res3 = manager.advanceToStage('ENGINEERING_VALIDATION');
    expect(res3.success).toBe(true);
    expect(manager.getCurrentStageId()).toBe('ENGINEERING_VALIDATION');

    // Pre-launch redesign rollback: ENGINEERING_VALIDATION -> SPACECRAFT_DESIGN is permitted
    const stateMachine = manager.getStateMachine();
    expect(stateMachine.isValidTransition('SPACECRAFT_DESIGN').valid).toBe(true);
    const rollback = stateMachine.transitionTo('SPACECRAFT_DESIGN', 50, { note: 'Redesign required' });
    expect(rollback.success).toBe(true);
    expect(stateMachine.getCurrentStageId()).toBe('SPACECRAFT_DESIGN');
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Invalid Transition Rejection                                            */
  /* -------------------------------------------------------------------------- */
  it('3. strictly rejects out-of-order stage skips and unrecognized stage IDs', () => {
    const sm = new CampaignStateMachine('CAMPAIGN_INTRO');

    // Attempting to skip from CAMPAIGN_INTRO directly to EUROPA_RECONNAISSANCE
    const validity = sm.isValidTransition('EUROPA_RECONNAISSANCE');
    expect(validity.valid).toBe(false);
    expect(validity.reason).toContain('Direct transition');

    expect(() => {
      sm.transitionTo('EUROPA_RECONNAISSANCE', 10);
    }).toThrow(CampaignTransitionError);

    // Attempting to transition to an unrecognized stage ID
    expect(() => {
      sm.transitionTo('NON_EXISTENT_STAGE' as any, 10);
    }).toThrow(CampaignTransitionError);

    // Stage remains CAMPAIGN_INTRO
    expect(sm.getCurrentStageId()).toBe('CAMPAIGN_INTRO');
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Stage Entry Requirements                                                */
  /* -------------------------------------------------------------------------- */
  it('4. enforces stage entry gates and reports human-readable blockers', () => {
    const evaluator = new CampaignRequirementsEvaluator();
    const ctx = manager.getEvaluationContext(0);

    const introEval = evaluator.evaluateStage('CAMPAIGN_INTRO', ctx);
    expect(introEval.canEnter).toBe(true);

    const selectionEval = evaluator.evaluateStage('MISSION_SELECTION', ctx);
    expect(selectionEval.canEnter).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Stage Completion Requirements                                           */
  /* -------------------------------------------------------------------------- */
  it('5. blocks stage completion when authoritative simulation criteria fail', () => {
    const evaluator = new CampaignRequirementsEvaluator();

    // In ENGINEERING_VALIDATION with low propellant (< 500 kg)
    const lowPropContext = {
      ...manager.getEvaluationContext(0),
      snapshot: {
        ...runtime.getSnapshot(),
        propellantRemainingKg: 200.0, // Insufficient margin!
        criticalFaultCount: 0,
      } as any,
    };

    const evalResult = evaluator.evaluateStage('ENGINEERING_VALIDATION', lowPropContext);
    expect(evalResult.isComplete).toBe(false);
    expect(evalResult.completionReasons.some((b) => b.includes('Propellant mass below minimum cruise margin'))).toBe(true);

    // With nominal propellant (2450 kg)
    const nominalContext = {
      ...manager.getEvaluationContext(0),
      snapshot: {
        ...runtime.getSnapshot(),
        propellantRemainingKg: 2450.0,
        criticalFaultCount: 0,
      } as any,
    };

    const nominalEval = evaluator.evaluateStage('ENGINEERING_VALIDATION', nominalContext);
    expect(nominalEval.isComplete).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Objective-Driven Progression                                            */
  /* -------------------------------------------------------------------------- */
  it('6. advances EUROPA_RECONNAISSANCE upon authoritative scientific product ingestion', () => {
    // Advance to EUROPA_RECONNAISSANCE
    const sm = manager.getStateMachine();
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);
    sm.transitionTo('INTERPLANETARY_CRUISE', 70);
    sm.transitionTo('JUPITER_ARRIVAL', 80);
    sm.transitionTo('EUROPA_RECONNAISSANCE', 90);

    expect(manager.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');

    // Before ingesting science, completion requirements are unsatisfied
    const ctxBefore = manager.getEvaluationContext(90);
    const evalBefore = new CampaignRequirementsEvaluator().evaluateStage('EUROPA_RECONNAISSANCE', ctxBefore);
    expect(evalBefore.isComplete).toBe(false);

    // Ingest authoritative REASON Level 2 radar product
    runtime.getFlightComputer().getSubsystemManager().getSubsystem('SCIENCE')?.setStatus('NOMINAL');
    const mockReason: ReasonLevel2Product = {
      id: 'l2-reason-campaign-01',
      level1Id: 'l1-01',
      level0PacketId: 'pkt-01',
      instrument: 'REASON',
      processingMET: 95,
      acquisitionMET: 95,
      algorithmVersion: '1.0',
      calibrationProfileVersion: '1.0',
      sizeBytes: 4096,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: {} as any,
      detectedReflectors: [
        {
          id: 'ref-basal-ocean',
          peakIndex: 12,
          travelTimeSeconds: 0.00003,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 3100.0,
          depthUncertaintyMetres: 20.0,
          reflectionCoefficientEstimate: 0.8,
          reflectorTypeCandidate: 'OCEAN_INTERFACE_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: 'Nominal radar detection',
    };

    runtime.ingestScienceProduct(mockReason);

    // Verify completion requirements now satisfied
    const ctxAfter = manager.getEvaluationContext(100);
    const evalAfter = new CampaignRequirementsEvaluator().evaluateStage('EUROPA_RECONNAISSANCE', ctxAfter);
    expect(evalAfter.isComplete).toBe(true);

    const advanceResult = manager.advanceToStage('SURFACE_MISSION_PREPARATION');
    expect(advanceResult.success).toBe(true);
    expect(manager.getCurrentStageId()).toBe('SURFACE_MISSION_PREPARATION');
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Event-Driven Progression                                                */
  /* -------------------------------------------------------------------------- */
  it('7. deterministically advances campaign stages when scheduled mission events execute', async () => {
    // Setup state machine at LAUNCH
    const sm = manager.getStateMachine();
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);

    expect(manager.getCurrentStageId()).toBe('LAUNCH');

    // Trigger LAUNCH_COMPLETE event via event bridge
    const bridge = manager.getEventBridge();
    const eventResult = bridge.processEvent(
      {
        id: 'evt-launch-complete-01',
        type: 'LAUNCH_COMPLETE',
        scheduledTimeSeconds: 70,
        payload: { vehicle: 'SLS-BLOCK-1B', orbit: 'HELIOCENTRIC_INJECTION' },
      },
      70
    );

    expect(eventResult.processed).toBe(true);
    expect(eventResult.advancedStage).toBe('INTERPLANETARY_CRUISE');
    expect(manager.getCurrentStageId()).toBe('INTERPLANETARY_CRUISE');
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Duplicate Event Protection                                              */
  /* -------------------------------------------------------------------------- */
  it('8. protects against duplicate event dispatch and prevents multiple transitions', () => {
    const bridge = manager.getEventBridge();
    const testEvent = {
      id: 'evt-unique-joi-01',
      type: 'ORBIT_INSERTION_COMPLETE',
      scheduledTimeSeconds: 100,
      payload: {},
    };

    // First execution
    const firstDispatch = bridge.processEvent(testEvent, 100);
    expect(firstDispatch.processed).toBe(true);
    expect(firstDispatch.duplicate).toBe(false);

    // Second execution with identical event ID
    const secondDispatch = bridge.processEvent(testEvent, 105);
    expect(secondDispatch.processed).toBe(false);
    expect(secondDispatch.duplicate).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 9. Event Failure Handling                                                  */
  /* -------------------------------------------------------------------------- */
  it('9. intercepts failure events and halts progression with authoritative failure state', () => {
    const bridge = manager.getEventBridge();

    const descentFailEvent = {
      id: 'evt-lander-crash-01',
      type: 'LANDER_DESCENT_FAILURE',
      scheduledTimeSeconds: 250,
      payload: { reason: 'Altimeter radar signal loss during terminal descent' },
    };

    const result = bridge.processEvent(descentFailEvent, 250);
    expect(result.processed).toBe(true);
    expect(result.failureReason).toContain('Altimeter radar signal loss');

    expect(manager.getStatus()).toBe('FAILED');
    const snapshot = manager.getSnapshot();
    expect(snapshot.isCampaignFailed).toBe(true);
    expect(snapshot.failureReason).toContain('Altimeter radar signal loss');

    // Subsequent advancement is rejected
    const advanceAttempt = manager.advanceToStage();
    expect(advanceAttempt.success).toBe(false);
  });

  /* -------------------------------------------------------------------------- */
  /* 10. Mission Abort Handling                                                 */
  /* -------------------------------------------------------------------------- */
  it('10. handles critical MISSION_ABORT events deterministically', () => {
    const bridge = manager.getEventBridge();

    const abortEvent = {
      id: 'evt-abort-fsw-01',
      type: 'MISSION_ABORT',
      scheduledTimeSeconds: 300,
      payload: { reason: 'Flight director commanded mission termination' },
    };

    bridge.processEvent(abortEvent, 300);

    expect(manager.getStatus()).toBe('FAILED');
    expect(manager.getSnapshot().failureReason).toBe('Flight director commanded mission termination');
    expect(manager.getSnapshot().failureMET).toBe(300);
  });

  /* -------------------------------------------------------------------------- */
  /* 11. Campaign History Logging                                               */
  /* -------------------------------------------------------------------------- */
  it('11. records immutable chronological history with entry/completion MET', () => {
    manager.advanceToStage('MISSION_SELECTION', { note: 'Directive approved' });
    manager.advanceToStage('SPACECRAFT_DESIGN', { note: 'Hardware configured' });

    const history = manager.getHistory();
    expect(history.length).toBe(3);

    expect(history[0].stageId).toBe('CAMPAIGN_INTRO');
    expect(history[0].status).toBe('COMPLETED');

    expect(history[1].stageId).toBe('MISSION_SELECTION');
    expect(history[1].status).toBe('COMPLETED');
    expect(history[1].notes).toContain('Directive approved');

    expect(history[2].stageId).toBe('SPACECRAFT_DESIGN');
    expect(history[2].status).toBe('ACTIVE');
  });

  /* -------------------------------------------------------------------------- */
  /* 12. Save and Restore Persistence                                           */
  /* -------------------------------------------------------------------------- */
  it('12. persists campaign state to storage and faithfully restores progress', async () => {
    manager.advanceToStage('MISSION_SELECTION');
    manager.advanceToStage('SPACECRAFT_DESIGN');

    // Save checkpoint
    const saved = await manager.save();
    expect(saved).toBe(true);

    // Instantiate a separate manager instance representing a fresh browser session
    const restoredManager = new CampaignManager({
      campaignId: testCampaignId,
      persistence: manager.getPersistence(),
    });

    const loaded = await restoredManager.load();
    expect(loaded).toBe(true);

    expect(restoredManager.getCurrentStageId()).toBe('SPACECRAFT_DESIGN');
    expect(restoredManager.getStatus()).toBe('ACTIVE');
    expect(restoredManager.getCompletedStages()).toContain('CAMPAIGN_INTRO');
    expect(restoredManager.getCompletedStages()).toContain('MISSION_SELECTION');
    expect(restoredManager.getHistory().length).toBe(3);
  });

  /* -------------------------------------------------------------------------- */
  /* 13. Corrupted Save Handling                                                */
  /* -------------------------------------------------------------------------- */
  it('13. detects and rejects corrupted save payloads safely without crashing', async () => {
    const customPersistence = new CampaignPersistenceEngine('test_corrupt_');

    // 1. Non-object payload
    const res1 = customPersistence.validateSaveData('malformed string');
    expect(res1.isValid).toBe(false);

    // 2. Missing mandatory fields
    const res2 = customPersistence.validateSaveData({ schemaVersion: 1 });
    expect(res2.isValid).toBe(false);
    expect(res2.errors.some((e) => e.includes('campaignId'))).toBe(true);

    // 3. Unrecognized stage ID
    const res3 = customPersistence.validateSaveData({
      schemaVersion: 1,
      campaignId: 'bad-campaign',
      savedAtMET: 10,
      currentStageId: 'INVALID_STAGE_ID',
      completedStageIds: [],
      stageHistory: [],
      processedEventIds: [],
    });
    expect(res3.isValid).toBe(false);
    expect(res3.errors.some((e) => e.includes('currentStageId'))).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 14. Schema Version Validation                                              */
  /* -------------------------------------------------------------------------- */
  it('14. validates schema versions and rejects incompatible future schemas', () => {
    const customPersistence = new CampaignPersistenceEngine('test_version_');

    const futurePayload = {
      schemaVersion: 999, // Incompatible future schema
      campaignId: 'future-campaign',
      savedAtMET: 0,
      currentStageId: 'CAMPAIGN_INTRO',
      completedStageIds: [],
      stageHistory: [],
      processedEventIds: [],
    };

    const validation = customPersistence.validateSaveData(futurePayload);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Incompatible future schema version 999'))).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 15. Duplicate Event Prevention After Restoration                           */
  /* -------------------------------------------------------------------------- */
  it('15. ensures restored processedEventIds prevent re-execution of historical events', async () => {
    const bridge = manager.getEventBridge();
    const testEvt = {
      id: 'evt-checkpointed-01',
      type: 'CRUISE_PHASE_ENTERED',
      scheduledTimeSeconds: 150,
      payload: {},
    };

    bridge.processEvent(testEvt, 150);
    expect(bridge.hasProcessed('evt-checkpointed-01')).toBe(true);

    await manager.save();

    // Restore into a fresh manager
    const restoredManager = new CampaignManager({
      campaignId: testCampaignId,
      persistence: manager.getPersistence(),
    });
    await restoredManager.load();

    const restoredBridge = restoredManager.getEventBridge();
    expect(restoredBridge.hasProcessed('evt-checkpointed-01')).toBe(true);

    // Re-dispatching the event on restored manager must be flagged as duplicate
    const reDispatch = restoredBridge.processEvent(testEvt, 160);
    expect(reDispatch.processed).toBe(false);
    expect(reDispatch.duplicate).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 16. Route Navigation Gating                                                */
  /* -------------------------------------------------------------------------- */
  it('16. enforces route stage gating while keeping universal screens accessible', () => {
    // Universal screens are always permitted at Stage 0 (CAMPAIGN_INTRO)
    expect(manager.canAccessRoute('/').allowed).toBe(true);
    expect(manager.canAccessRoute('/campaign').allowed).toBe(true);

    // Stage-restricted routes are blocked prior to their required phase
    expect(manager.canAccessRoute('/missions').allowed).toBe(false);
    expect(manager.canAccessRoute('/missions').reason).toContain('acknowledging the expedition briefing directive');

    expect(manager.canAccessRoute('/workshop').allowed).toBe(false);
    expect(manager.canAccessRoute('/workshop').reason).toContain('Spacecraft workshop requires selecting');

    expect(manager.canAccessRoute('/trajectory').allowed).toBe(false);
    expect(manager.canAccessRoute('/trajectory').reason).toContain('Trajectory planning requires completing');

    expect(manager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(manager.canAccessRoute('/decisions').reason).toContain('Mission decision console requires completing');

    expect(manager.canAccessRoute('/operations').allowed).toBe(false);
    expect(manager.canAccessRoute('/operations').reason).toContain('Mission operations telemetry is locked');

    expect(manager.canAccessRoute('/surface').allowed).toBe(false);
    expect(manager.canAccessRoute('/surface').reason).toContain('Surface exploration telemetry is unavailable');

    expect(manager.canAccessRoute('/anomaly').allowed).toBe(false);
    expect(manager.canAccessRoute('/anomaly').reason).toContain('Subsurface anomaly workspace requires');

    expect(manager.canAccessRoute('/debrief').allowed).toBe(false);
    expect(manager.canAccessRoute('/debrief').reason).toContain('Mission debrief is locked');
  });

  /* -------------------------------------------------------------------------- */
  /* 17. React StrictMode Rendering & UI Interaction                            */
  /* -------------------------------------------------------------------------- */
  it('17. renders CampaignOverviewScreen cleanly under React.StrictMode and triggers save/load', async () => {
    await act(async () => {
      render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/campaign'] },
            React.createElement(
              SimulationProvider,
              { runtime },
              React.createElement(CampaignOverviewScreen)
            )
          )
        )
      );
    });

    // Verify main components rendered
    expect(screen.getByText(/EXPEDITION-V \/\/ EUROPA SURVEY/i)).toBeDefined();
    expect(screen.getByText(/Expedition Flight Sequence/i)).toBeDefined();
    expect(screen.getByText(/Expedition Flight Log/i)).toBeDefined();
    expect(screen.getByTestId('campaign-save-button')).toBeDefined();
    expect(screen.getByTestId('campaign-load-button')).toBeDefined();

    // Verify stage card rendered
    expect(screen.getByTestId('campaign-stage-card-CAMPAIGN_INTRO')).toBeDefined();

    // Click Save Button inside act()
    const saveButton = screen.getByTestId('campaign-save-button');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/CAMPAIGN CHECKPOINT SAVED/i)).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 18. Regression Against Existing Simulation Systems                         */
  /* -------------------------------------------------------------------------- */
  it('18. verifies runtime time advancement and flight computer changes synchronize with campaign', async () => {
    expect(manager.getSnapshot().missionElapsedTime).toBe(0);

    // Advance simulation time by 50 seconds
    await runtime.advanceTime(50);

    const snapshot = manager.getSnapshot();
    expect(snapshot.missionElapsedTime).toBe(50);
  });

  /* -------------------------------------------------------------------------- */
  /* 19. Authoritative Simulation Save, Mutate, and Restore (CRIT-01)           */
  /* -------------------------------------------------------------------------- */
  it('19. captures complete authoritative simulation runtime state and faithfully restores it', async () => {
    // 1. Advance to MET 100, consume propellant, add science product and decision
    await runtime.advanceTime(100);
    const propSub = runtime.getFlightComputer().getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
    propSub.consumePropellant(300); // 2450 - 300 = 2150 kg
    runtime.getFlightComputer().getSubsystemManager().getSubsystem('COMMUNICATIONS')?.setStatus('DEGRADED');

    // Add storage packet
    runtime.getCommunicationManager().getStorage().storeData({
      id: 'pkt-save-test-01',
      category: 'science',
      sizeBytes: 8192,
      priority: 2,
      createdAtMETSeconds: 100,
    });

    // Add science product
    const testScience: ReasonLevel2Product = {
      id: 'l2-save-test-reason',
      level1Id: 'l1-01',
      level0PacketId: 'pkt-save-test-01',
      instrument: 'REASON',
      processingMET: 100,
      acquisitionMET: 100,
      algorithmVersion: '1.0',
      calibrationProfileVersion: '1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0002,
      dielectricModelUsed: {} as any,
      detectedReflectors: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: 'Save test product',
    };
    runtime.ingestScienceProduct(testScience);

    // Save checkpoint at MET 100
    const saveSuccess = await manager.save();
    expect(saveSuccess).toBe(true);

    const snapshotAtSave = runtime.getSnapshot();
    expect(snapshotAtSave.metSeconds).toBe(100);
    expect(snapshotAtSave.propellantRemainingKg).toBeCloseTo(2150.0, 1);
    expect(snapshotAtSave.subsystems.COMMUNICATIONS).toBe('DEGRADED');
    expect(snapshotAtSave.storage.usedBytes).toBe(8192);

    // 2. Mutate runtime further: advance time, burn more propellant, add more data
    propSub.consumePropellant(500); // 2150 - 500 = 1650 kg
    runtime.getFlightComputer().getSubsystemManager().getSubsystem('COMMUNICATIONS')?.setStatus('FAULT');
    await runtime.advanceTime(150); // MET = 250, recomputes snapshot with new state!

    const snapshotMutated = runtime.getSnapshot();
    expect(snapshotMutated.metSeconds).toBe(250);
    expect(snapshotMutated.propellantRemainingKg).toBeCloseTo(1650.0, 1);
    expect(snapshotMutated.subsystems.COMMUNICATIONS).toBe('FAULT');

    // 3. Load saved checkpoint
    const loadSuccess = await manager.load();
    expect(loadSuccess).toBe(true);

    // 4. Verify authoritative state restored exactly to MET 100
    const snapshotRestored = runtime.getSnapshot();
    expect(snapshotRestored.metSeconds).toBe(100);
    expect(snapshotRestored.propellantRemainingKg).toBeCloseTo(2150.0, 1);
    expect(snapshotRestored.subsystems.COMMUNICATIONS).toBe('DEGRADED');
    expect(snapshotRestored.storage.usedBytes).toBe(8192);
    expect(runtime.getFlightComputer().getCurrentMETSeconds()).toBe(100);
  });

  /* -------------------------------------------------------------------------- */
  /* 20. Deterministic Re-advancement After Restore                             */
  /* -------------------------------------------------------------------------- */
  it('20. advances deterministically after restoring authoritative checkpoint', async () => {
    await runtime.advanceTime(50);
    await manager.save();

    // Advance 50 more seconds to MET 100
    await runtime.advanceTime(50);
    expect(runtime.getSnapshot().metSeconds).toBe(100);

    // Restore back to MET 50
    await manager.load();
    expect(runtime.getSnapshot().metSeconds).toBe(50);

    // Advance 50 seconds again
    await runtime.advanceTime(50);
    expect(runtime.getSnapshot().metSeconds).toBe(100);
  });

  /* -------------------------------------------------------------------------- */
  /* 21. Event Type Tracking vs Instance ID Tracking (CRIT-02)                  */
  /* -------------------------------------------------------------------------- */
  it('21. satisfies stage completion using event type even with arbitrary dynamic event IDs', () => {
    // Advance to LAUNCH stage
    const sm = manager.getStateMachine();
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);

    // Dispatch event with randomized dynamic ID
    const dynamicId = 'evt-launch-uuid-98723-special';
    const bridge = manager.getEventBridge();
    const result = bridge.processEvent(
      {
        id: dynamicId,
        type: 'LAUNCH_COMPLETE',
        scheduledTimeSeconds: 65,
        payload: {},
      },
      65
    );

    expect(result.processed).toBe(true);
    expect(bridge.hasProcessed(dynamicId)).toBe(true);
    expect(bridge.hasProcessedType('LAUNCH_COMPLETE')).toBe(true);

    // Context contains both ID and Type
    const ctx = manager.getEvaluationContext(65);
    expect(ctx.processedEventIds.has(dynamicId)).toBe(true);
    expect(ctx.processedEventTypes.has('LAUNCH_COMPLETE')).toBe(true);

    // Transition occurred because event type satisfied the requirement
    expect(manager.getCurrentStageId()).toBe('INTERPLANETARY_CRUISE');
  });

  /* -------------------------------------------------------------------------- */
  /* 22. Event Before Prerequisites Does Not Cause Illegal Skip                 */
  /* -------------------------------------------------------------------------- */
  it('22. prevents premature stage skips when event arrives before prerequisites are met', () => {
    // Campaign is at CAMPAIGN_INTRO
    expect(manager.getCurrentStageId()).toBe('CAMPAIGN_INTRO');

    const bridge = manager.getEventBridge();
    // Premature JUPITER_ARRIVAL event
    const prematureResult = bridge.processEvent(
      {
        id: 'evt-premature-joi',
        type: 'JUPITER_ARRIVAL',
        scheduledTimeSeconds: 10,
        payload: {},
      },
      10
    );

    // The event is processed by bridge, but stage cannot skip directly from CAMPAIGN_INTRO to JUPITER_ARRIVAL
    expect(prematureResult.processed).toBe(true);
    expect(prematureResult.advancedStage).toBeUndefined();
    expect(manager.getCurrentStageId()).toBe('CAMPAIGN_INTRO');
  });

  /* -------------------------------------------------------------------------- */
  /* 23. Duplicate Event Delivery Suppression                                   */
  /* -------------------------------------------------------------------------- */
  it('23. suppresses duplicate event execution for repeated instance IDs', () => {
    const bridge = manager.getEventBridge();
    const evt = {
      id: 'evt-single-delivery-01',
      type: 'LAUNCH_INITIATED',
      scheduledTimeSeconds: 100,
      payload: {},
    };

    const first = bridge.processEvent(evt, 100);
    expect(first.processed).toBe(true);
    expect(first.duplicate).toBe(false);

    const second = bridge.processEvent(evt, 105);
    expect(second.processed).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 24. Route Guard Redirect on Direct Navigation (MAJ-02)                     */
  /* -------------------------------------------------------------------------- */
  it('24. redirects to /campaign when navigating directly to a locked route', () => {
    // Manager is at CAMPAIGN_INTRO, so /surface is locked
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/surface'] },
        React.createElement(
          SimulationProvider,
          { runtime },
          React.createElement(
            Routes,
            null,
            React.createElement(
              Route,
              {
                path: '/surface',
                element: React.createElement(
                  CampaignRouteGuard,
                  null,
                  React.createElement('div', { 'data-testid': 'surface-screen' }, 'SURFACE CONTENT')
                ),
              }
            ),
            React.createElement(
              Route,
              {
                path: '/campaign',
                element: React.createElement('div', { 'data-testid': 'campaign-overview-screen' }, 'CAMPAIGN OVERVIEW'),
              }
            )
          )
        )
      )
    );

    // Route guard should redirect to /campaign
    expect(screen.queryByTestId('surface-screen')).toBeNull();
    expect(screen.getByTestId('campaign-overview-screen')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 25. Route Guard Allows Access When Prerequisites Met                       */
  /* -------------------------------------------------------------------------- */
  it('25. allows access to protected route when campaign stage permits it', () => {
    // Advance to SURFACE_OPERATIONS
    const sm = manager.getStateMachine();
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);
    sm.transitionTo('INTERPLANETARY_CRUISE', 70);
    sm.transitionTo('JUPITER_ARRIVAL', 80);
    sm.transitionTo('EUROPA_RECONNAISSANCE', 90);
    sm.transitionTo('SURFACE_MISSION_PREPARATION', 100);
    sm.transitionTo('LANDER_DEPLOYMENT', 110);
    sm.transitionTo('SURFACE_OPERATIONS', 120);

    expect(manager.canAccessRoute('/surface').allowed).toBe(true);

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/surface'] },
        React.createElement(
          SimulationProvider,
          { runtime },
          React.createElement(
            Routes,
            null,
            React.createElement(
              Route,
              {
                path: '/surface',
                element: React.createElement(
                  CampaignRouteGuard,
                  null,
                  React.createElement('div', { 'data-testid': 'surface-screen' }, 'SURFACE CONTENT')
                ),
              }
            ),
            React.createElement(
              Route,
              {
                path: '/campaign',
                element: React.createElement('div', { 'data-testid': 'campaign-overview-screen' }, 'CAMPAIGN OVERVIEW'),
              }
            )
          )
        )
      )
    );

    // Surface screen should render without redirection
    expect(screen.getByTestId('surface-screen')).toBeDefined();
    expect(screen.queryByTestId('campaign-overview-screen')).toBeNull();
  });

  /* -------------------------------------------------------------------------- */
  /* 26. Campaign Continue Button in Incomplete State (MAJ-01)                  */
  /* -------------------------------------------------------------------------- */
  it('26. displays open workspace when current stage completion requirements are not satisfied', () => {
    // Advance to ENGINEERING_VALIDATION with low propellant (< 10% reserve)
    const sm = manager.getStateMachine();
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);

    const propSub = runtime.getFlightComputer().getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
    propSub.consumePropellant(2400); // Only 50 kg remaining (< 245 kg min reserve)

    const advanceCheck = manager.canAdvanceToNextStage();
    expect(advanceCheck.canAdvance).toBe(false);

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(CampaignContinueButton, {
          currentStage: CAMPAIGN_STAGE_CONFIGS['ENGINEERING_VALIDATION'],
          status: 'ACTIVE',
          canAdvance: advanceCheck.canAdvance,
          blockers: advanceCheck.reasons,
          isCompleted: false,
          isFailed: false,
          onAdvanceStage: () => {},
        })
      )
    );

    // Incomplete stage must not display the advance button
    expect(screen.queryByTestId('campaign-advance-button')).toBeNull();
    expect(screen.getByTestId('campaign-continue-button')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 27. Campaign Continue Button in Complete State                             */
  /* -------------------------------------------------------------------------- */
  it('27. displays advance button when stage requirements are satisfied', () => {
    // At CAMPAIGN_INTRO, directive acknowledged evaluator returns satisfied: true
    const advanceCheck = manager.canAdvanceToNextStage();
    expect(advanceCheck.canAdvance).toBe(true);

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(CampaignContinueButton, {
          currentStage: CAMPAIGN_STAGE_CONFIGS['CAMPAIGN_INTRO'],
          status: 'ACTIVE',
          canAdvance: advanceCheck.canAdvance,
          blockers: [],
          isCompleted: false,
          isFailed: false,
          onAdvanceStage: () => {},
        })
      )
    );

    expect(screen.getByTestId('campaign-advance-button')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 28. Campaign Continue Button in BLOCKED State                              */
  /* -------------------------------------------------------------------------- */
  it('28. displays STAGE BLOCKED with blocker count when stage is blocked', () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(CampaignContinueButton, {
          currentStage: CAMPAIGN_STAGE_CONFIGS['ENGINEERING_VALIDATION'],
          status: 'BLOCKED',
          canAdvance: false,
          blockers: ['Propellant reserve low', 'Power budget negative'],
          isCompleted: false,
          isFailed: false,
          onAdvanceStage: () => {},
        })
      )
    );

    expect(screen.getByText(/STAGE BLOCKED \(2 Unresolved Conditions\)/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 29. Recovery from BLOCKED Status                                           */
  /* -------------------------------------------------------------------------- */
  it('29. recovers from BLOCKED status when critical fault or condition is resolved', () => {
    // Advance to ENGINEERING_VALIDATION
    const sm = manager.getStateMachine();
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);

    // Raise critical fault
    runtime.getFlightComputer().getFaultManager().raiseFault({
      id: 'fault-crit-eps-01',
      code: 'EPS_BUS_UNDERVOLTAGE',
      subsystemType: 'EPS',
      severity: 'CRITICAL',
      description: 'Main bus voltage dropped below 24V threshold',
      detectedAtMETSeconds: 35,
    });

    manager.evaluateCurrentStage(35);
    expect(manager.getStatus()).toBe('BLOCKED');
    expect(manager.getActiveBlockers().length).toBeGreaterThan(0);

    // Resolve fault
    runtime.getFlightComputer().getFaultManager().resolveFault('fault-crit-eps-01', 40, 'Bus voltage restored');
    manager.evaluateCurrentStage(40);
    expect(manager.getStatus()).toBe('ACTIVE');
    expect(manager.getActiveBlockers().length).toBe(0);
  });

  /* -------------------------------------------------------------------------- */
  /* 30. Campaign Continue Button in FAILED and COMPLETED Terminal States       */
  /* -------------------------------------------------------------------------- */
  it('30. renders distinct terminal banners for FAILED and COMPLETED states', () => {
    // Failed state
    const { unmount } = render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(CampaignContinueButton, {
          currentStage: CAMPAIGN_STAGE_CONFIGS['LAUNCH'],
          status: 'FAILED',
          canAdvance: false,
          blockers: [],
          isCompleted: false,
          isFailed: true,
          onAdvanceStage: () => {},
        })
      )
    );

    expect(screen.getByText(/EXPEDITION TERMINATED — MISSION FAILED/i)).toBeDefined();
    unmount();

    // Completed state
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(CampaignContinueButton, {
          currentStage: CAMPAIGN_STAGE_CONFIGS['CAMPAIGN_COMPLETED'],
          status: 'COMPLETED',
          canAdvance: false,
          blockers: [],
          isCompleted: true,
          isFailed: false,
          onAdvanceStage: () => {},
        })
      )
    );

    expect(screen.getByText(/VIEW FINAL DEBRIEF ARCHIVE/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 31. Parameterized Propellant Requirement in ENGINEERING_VALIDATION (MIN-01)*/
  /* -------------------------------------------------------------------------- */
  it('31. derives propellant threshold from capacity margin rather than hardcoded 500kg', () => {
    const evaluator = new CampaignRequirementsEvaluator();

    // With capacity = 1000kg and prop = 150kg (15% reserve >= 10% min): satisfied
    const ctxSufficient = {
      ...manager.getEvaluationContext(0),
      snapshot: {
        ...runtime.getSnapshot(),
        propellantCapacityKg: 1000.0,
        propellantRemainingKg: 150.0,
        faults: { criticalCount: 0 },
      } as any,
    };
    const resSufficient = evaluator.evaluateStage('ENGINEERING_VALIDATION', ctxSufficient);
    expect(resSufficient.isComplete).toBe(true);

    // With capacity = 1000kg and prop = 50kg (5% reserve < 10% min): blocked
    const ctxInsufficient = {
      ...manager.getEvaluationContext(0),
      snapshot: {
        ...runtime.getSnapshot(),
        propellantCapacityKg: 1000.0,
        propellantRemainingKg: 50.0,
        faults: { criticalCount: 0 },
      } as any,
    };
    const resInsufficient = evaluator.evaluateStage('ENGINEERING_VALIDATION', ctxInsufficient);
    expect(resInsufficient.isComplete).toBe(false);
    expect(resInsufficient.completionReasons.some((r) => r.includes('Propellant mass below minimum cruise margin'))).toBe(true);
  });
});
