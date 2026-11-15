/**
 * SECTOR 17 — Mission Decision Integration Tests
 * Comprehensive end-to-end integration of MissionDecisionManager with FlightComputer,
 * ScienceProcessingManager, CommunicationManager, and MissionEventEngine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlightComputer } from '../src/simulation/flightSoftware/flightComputer';
import { CommunicationManager } from '../src/simulation/communications/communicationManager';
import { ScienceProcessingManager } from '../src/simulation/science/scienceProcessingManager';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { MissionDecisionManager } from '../src/simulation/missionDecision/missionDecisionManager';
import type { ReasonLevel2Product, MaspexLevel2Product } from '../src/simulation/science/types';

describe('Mission Decision Core Integration', () => {
  let flightComputer: FlightComputer;
  let commManager: CommunicationManager;
  let scienceManager: ScienceProcessingManager;
  let eventEngine: MissionEventEngine;
  let decisionManager: MissionDecisionManager;

  beforeEach(() => {
    flightComputer = new FlightComputer({
      initialState: 'ACTIVE',
    });

    eventEngine = new MissionEventEngine(0, true);
    commManager = new CommunicationManager({ autoExecuteCommands: false });
    scienceManager = new ScienceProcessingManager();
    decisionManager = new MissionDecisionManager();

    // Wire subsystems and managers
    flightComputer.attachEventEngine(eventEngine);
    flightComputer.attachCommunicationManager(commManager);
    flightComputer.attachScienceManager(scienceManager);
    flightComputer.attachDecisionManager(decisionManager);

    // Seed nominal engineering telemetry snapshot
    decisionManager.getEvidenceManager().ingestEngineeringSnapshot({
      currentMET: 0,
      flightState: 'ACTIVE',
      subsystemStatuses: flightComputer.getSubsystemManager().getStatuses(),
      activeFaultCount: 0,
      criticalFaultCount: 0,
      powerBudget: {
        totalGenerationWatts: 600,
        totalConsumptionWatts: 300,
        netPowerWatts: 300,
        powerMarginWatts: 300,
        powerReservePercent: 50,
        powerDeficitWatts: 0,
        reserveThresholdPercent: 20,
        loadBreakdownWatts: {} as any,
        status: 'NOMINAL',
        isGenerationKnown: true,
        isConsumptionKnown: true,
        isPropulsionFeasible: true,
        missingData: [],
        warnings: [],
        errors: [],
      },
      availablePropellantKg: 100.0,
      storageCapacityBytes: 1024 * 1024 * 100,
      storageUsedBytes: 0,
      isCommWindowActive: true,
    });
  });

  it('wires all managers correctly and initializes in active state', () => {
    expect(flightComputer.getDecisionManager()).toBe(decisionManager);
    expect(decisionManager.getEvidenceManager()).toBeDefined();
    expect(decisionManager.getObjectiveEvaluator()).toBeDefined();

    const snapshot = decisionManager.syncEngineeringSnapshot(100);
    expect(snapshot.flightState).toBe('ACTIVE');
    expect(snapshot.subsystemStatuses['SCIENCE']).toBeDefined();
  });

  it('ingests science products, progresses objectives, and generates feasible decision options', async () => {
    const met = 500;

    // 1. Ingest verified REASON Level 2 radar product
    flightComputer.getSubsystemManager().getSubsystem('SCIENCE')?.setStatus('NOMINAL');

    const mockReason: ReasonLevel2Product = {
      id: 'l2-reason-integ-01',
      level1Id: 'l1-01',
      level0PacketId: 'pkt-01',
      instrument: 'REASON',
      processingMET: met,
      acquisitionMET: met,
      algorithmVersion: '1.0',
      calibrationProfileVersion: '1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: {} as any,
      detectedReflectors: [
        {
          id: 'ref-ocean-basal',
          peakIndex: 20,
          travelTimeSeconds: 0.000035,
          echoAmplitude: 0.92,
          estimatedDepthMetres: 2950.0,
          depthUncertaintyMetres: 25.0,
          reflectionCoefficientEstimate: 0.75,
          reflectorTypeCandidate: 'OCEAN_INTERFACE_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: 'Standard disclaimer',
    };

    decisionManager.ingestScienceProduct(mockReason, met);

    // 2. Evaluate objectives: EXP-V-OBJ-01 should complete
    const reports = decisionManager.evaluateObjectives(met);
    const oceanReport = reports.find((r) => r.objectiveId === 'EXP-V-OBJ-01');
    expect(oceanReport?.newState).toBe('COMPLETED');
    expect(oceanReport?.progressPercent).toBe(100);

    // 3. Generate and validate candidate options
    const options = decisionManager.generateAndValidateOptions(met);
    expect(options.length).toBeGreaterThan(0);

    const surveyOption = options.find((o) => o.category === 'CONTINUE_INVESTIGATION');
    expect(surveyOption).toBeDefined();
    expect(surveyOption?.validationResult?.status).toBe('FEASIBLE');

    // 4. Propose decision
    const proposed = decisionManager.proposeDecision(surveyOption!, met);
    expect(proposed.status).toBe('PROPOSED');

    // 5. Authorize decision
    const authorized = decisionManager.authorizeDecision(
      proposed.decisionId,
      true,
      'Authorized by mission operations lead',
      met + 10
    );
    expect(authorized.status).toBe('APPROVED');

    // 6. Execute decision
    const execResult = await decisionManager.executeDecision(proposed.decisionId, met + 15);
    expect(execResult.success).toBe(true);
    expect(execResult.dispatchedCommandId).toBeDefined();
    expect(execResult.consequences.length).toBeGreaterThan(0);

    // Verify archived record in history
    const history = decisionManager.getHistoryTracker().getRecord(proposed.decisionId);
    expect(history?.status).toBe('EXECUTED');
    expect(history?.executionResult?.success).toBe(true);
  });

  it('strictly blocks execution of REJECTED decisions', async () => {
    const met = 600;
    const options = decisionManager.generateAndValidateOptions(met);
    const surveyOption = options.find((o) => o.category === 'CONTINUE_INVESTIGATION')!;

    const proposed = decisionManager.proposeDecision(surveyOption, met);
    decisionManager.authorizeDecision(proposed.decisionId, false, 'Rejected due to priority reallocation', met + 5);

    const execResult = await decisionManager.executeDecision(proposed.decisionId, met + 10);
    expect(execResult.success).toBe(false);
    expect(execResult.errorMessage).toContain('REJECTED');
  });

  it('aborts execution during pre-flight revalidation if spacecraft transitions to SAFE_MODE', async () => {
    flightComputer.getSubsystemManager().getSubsystem('SCIENCE')?.setStatus('NOMINAL');
    const met = 700;
    const options = decisionManager.generateAndValidateOptions(met);
    const surveyOption = options.find((o) => o.category === 'CONTINUE_INVESTIGATION')!;

    const proposed = decisionManager.proposeDecision(surveyOption, met);
    decisionManager.authorizeDecision(proposed.decisionId, true, 'Approved', met + 5);

    // Spacecraft safe-moded between approval and execution!
    flightComputer.transitionState('SAFE_MODE', 'Critical anomaly occurred');

    // Attempt execution
    const execResult = await decisionManager.executeDecision(proposed.decisionId, met + 15);
    expect(execResult.success).toBe(false);
    expect(execResult.errorMessage).toContain('Pre-flight revalidation failed');

    const history = decisionManager.getHistoryTracker().getRecord(proposed.decisionId);
    expect(history?.status).toBe('FAILED');
  });

  it('executes mission suspension (ABORT_OR_SUSPEND) and safely triggers SAFE_MODE', async () => {
    const met = 800;
    const options = decisionManager.generateAndValidateOptions(met);
    const abortOption = options.find((o) => o.category === 'ABORT_OR_SUSPEND')!;

    const proposed = decisionManager.proposeDecision(abortOption, met);
    decisionManager.authorizeDecision(proposed.decisionId, true, 'Safety suspension', met + 5);

    const execResult = await decisionManager.executeDecision(proposed.decisionId, met + 10);
    expect(execResult.success).toBe(true);

    expect(flightComputer.getExecutionController().getState()).toBe('SAFE_MODE');
  });

  it('steps through simulation time, expiring un-authorized time-limited options', async () => {
    // Advance simulation time to MET 900
    await flightComputer.step(900);
    const met = flightComputer.getCurrentMETSeconds();

    const timedOption = {
      ...decisionManager.generateAndValidateOptions(met)[0],
      id: 'opt-timed-exp',
      expirationMET: 950,
    };

    const record = decisionManager.proposeDecision(timedOption, met);
    expect(record.status).toBe('PROPOSED');

    // Step to MET 920 (before expiration: 900 + 20 = 920 < 950)
    await flightComputer.step(20);
    expect(decisionManager.getHistoryTracker().getRecord(record.decisionId)?.status).toBe('PROPOSED');

    // Step to MET 960 (past expiration: 920 + 40 = 960 > 950)
    await flightComputer.step(40);
    expect(decisionManager.getHistoryTracker().getRecord(record.decisionId)?.status).toBe('EXPIRED');
  });

  describe('C-01 Science Evidence Acquisition Timestamp & Ingestion Metadata', () => {
    it('preserves acquisitionMET as timestampMET and separately records ingestionMET', () => {
      const mockMaspex: MaspexLevel2Product = {
        id: 'l2-maspex-c01-01',
        level1Id: 'l1-maspex-01',
        level0PacketId: 'pkt-maspex-01',
        instrument: 'MASPEX',
        processingMET: 490,
        acquisitionMET: 350, // Physical acquisition happened at MET 350
        algorithmVersion: '1.0',
        calibrationProfileVersion: '1.0',
        sizeBytes: 4096,
        totalIonCount: 150000,
        baselineNoiseLevel: 12.5,
        massResolutionMOverDeltaM: 25000,
        calibratedPeaks: [],
        candidateSpecies: [
          {
            species: {
              formula: 'CH4',
              name: 'Methane',
              nominalMassDa: 16.031,
              exactMassDa: 16.0313,
              chargeState: 1,
              category: 'ORGANIC',
              provenance: 'VERIFIED',
            },
            observedMz: 16.0315,
            massAccuracyPpm: 12.4,
            intensityCounts: 45000,
            confidenceScore: 0.95,
          },
        ],
        unidentifiedPeaks: [],
        qualityFlags: ['NOMINAL'],
        limitationsDisclaimer: 'Standard disclaimer',
      };

      const currentMET = 500;
      const evidence = decisionManager.ingestScienceProduct(mockMaspex, currentMET);

      // Invariant: Physical acquisition MET is preserved as timestampMET
      expect(evidence.timestampMET).toBe(350);
      // Invariant: Telemetry ingestion time is separately recorded
      expect(evidence.ingestionMET).toBe(500);
      expect(evidence.sourceType).toBe('SCIENCE_PRODUCT');
      expect(evidence.provenance).toBe('VERIFIED');
    });

    it('strictly rejects science products with invalid or missing acquisitionMET', () => {
      const invalidProduct = {
        id: 'l2-invalid-acq',
        instrument: 'REASON',
        sizeBytes: 1024,
      } as any;

      expect(() => {
        decisionManager.ingestScienceProduct(invalidProduct, 500);
      }).toThrow(TypeError);

      const negativeProduct = {
        ...invalidProduct,
        acquisitionMET: -10,
      };

      expect(() => {
        decisionManager.ingestScienceProduct(negativeProduct, 500);
      }).toThrow(TypeError);
    });
  });

  describe('C-05 Flight Computer Built-in Command Handlers', () => {
    it('executes built-in command handlers without custom mock registrations', async () => {
      const cmdQueue = commManager.getCommandQueue();

      // 1. START_SCIENCE_SURVEY
      flightComputer.getSubsystemManager().getSubsystem('SCIENCE')?.setStatus('NOMINAL');
      const startCmd = cmdQueue.enqueueCommand({
        id: 'cmd-start-sci-01',
        type: 'START_SCIENCE_SURVEY',
        payload: { mode: 'SURVEY' },
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1e9,
        priority: 100,
        sizeBytes: 64,
      });

      // 2. RECONFIGURE_SCIENCE_PAYLOAD
      const reconfigCmd = cmdQueue.enqueueCommand({
        id: 'cmd-reconfig-sci-01',
        type: 'RECONFIGURE_SCIENCE_PAYLOAD',
        payload: { mode: 'HIGH_RESOLUTION', targetAnomalyId: 'anom-europa-01' },
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1e9,
        priority: 100,
        sizeBytes: 64,
      });

      // 3. SET_SUBSYSTEM_POWER_STATE
      const powerCmd = cmdQueue.enqueueCommand({
        id: 'cmd-power-tcs-01',
        type: 'SET_SUBSYSTEM_POWER_STATE',
        payload: { subsystem: 'TCS', state: 'SAFE' },
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1e9,
        priority: 100,
        sizeBytes: 64,
      });

      // Advance simulation past command arrival (OWLT ~ 3.3s + tx ~ 0.5s)
      await flightComputer.step(20);

      // Verify command executions
      expect(cmdQueue.getCommand(startCmd.id)?.status).toBe('EXECUTED');
      expect(cmdQueue.getCommand(reconfigCmd.id)?.status).toBe('EXECUTED');
      expect(cmdQueue.getCommand(powerCmd.id)?.status).toBe('EXECUTED');
      expect(flightComputer.getSubsystemManager().getSubsystem('TCS')?.getStatus()).toBe('SAFE');
    });

    it('rejects payload commanding in SAFE_MODE but permits safe-mode commanding', async () => {
      flightComputer.transitionState('SAFE_MODE', 'Emergency triggered');
      const cmdQueue = commManager.getCommandQueue();

      const sciCmd = cmdQueue.enqueueCommand({
        id: 'cmd-sci-safe-fail',
        type: 'START_SCIENCE_SURVEY',
        payload: { mode: 'SURVEY' },
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1e9,
        priority: 100,
        sizeBytes: 64,
      });

      const powerCmd = cmdQueue.enqueueCommand({
        id: 'cmd-power-safe-ok',
        type: 'SET_SUBSYSTEM_POWER_STATE',
        payload: { mode: 'CONSERVATION' },
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1e9,
        priority: 100,
        sizeBytes: 64,
      });

      await flightComputer.step(10);

      expect(cmdQueue.getCommand(sciCmd.id)?.status).toBe('FAILED');
      expect(cmdQueue.getCommand(powerCmd.id)?.status).toBe('EXECUTED');
    });

    it('rejects DEPLOY_SURFACE_LANDER explicitly if LANDER_ROVER subsystem is absent', async () => {
      // Remove LANDER_ROVER subsystem
      flightComputer.getSubsystemManager().unregisterSubsystem('LANDER_ROVER');

      const cmdQueue = commManager.getCommandQueue();
      const landerCmd = cmdQueue.enqueueCommand({
        id: 'cmd-lander-missing-rover',
        type: 'DEPLOY_SURFACE_LANDER',
        payload: { siteTarget: 'EUROPA-CONAMARA-CHAOS' },
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1e9,
        priority: 100,
        sizeBytes: 64,
      });

      await flightComputer.step(10);

      expect(cmdQueue.getCommand(landerCmd.id)?.status).toBe('FAILED');
      expect(cmdQueue.getCommand(landerCmd.id)?.executionError).toContain('LANDER_ROVER');
      const ack = commManager.getTelemetryQueue().getAllPackets().find((p) => p.category === 'critical');
      expect(ack).toBeDefined();
      expect((ack?.payload as any)?.errorMessage).toContain('LANDER_ROVER');
    });
  });

  describe('C-06 Authoritative Resource Accounting (Propellant & Storage)', () => {
    it('authoritatively consumes propellant on PropulsionSubsystem and synchronizes snapshot', async () => {
      const propSub = flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as any;
      expect(propSub.getPropellantRemainingKg()).toBe(2450.0);

      // Power on LANDER_ROVER to allow viable deployment
      flightComputer.getSubsystemManager().getSubsystem('LANDER_ROVER')?.setStatus('NOMINAL');

      // Satisfy prerequisite EXP-V-OBJ-01
      decisionManager.getEvidenceManager().addEvidence({
        id: 'evi-radar-c06',
        sourceType: 'SCIENCE_PRODUCT',
        sourceId: 'prod-radar-01',
        provenance: 'VERIFIED',
        confidenceScore: 0.9,
        timestampMET: 100,
        summary: 'Radar sounding complete',
        isFictionalConstruct: false,
      });
      decisionManager.evaluateObjectives(100);

      const met = 200;
      decisionManager.syncEngineeringSnapshot(met);
      const options = decisionManager.generateAndValidateOptions(met);
      const landerOpt = options.find((o) => o.category === 'DEPLOY_LANDER');
      expect(landerOpt).toBeDefined();
      expect(landerOpt?.validationResult?.status).toBe('FEASIBLE');

      const proposed = decisionManager.proposeDecision(landerOpt!, met);
      decisionManager.authorizeDecision(proposed.decisionId, true, 'Approved lander deployment', met + 5);

      const execResult = await decisionManager.executeDecision(proposed.decisionId, met + 10);
      expect(execResult.success).toBe(true);

      // Authoritative propellant must have decreased by 25.0 kg
      expect(propSub.getPropellantRemainingKg()).toBe(2425.0);

      // Subsequent snapshot query must immediately reflect updated propellant
      const snap = decisionManager.syncEngineeringSnapshot(met + 15);
      expect(snap.availablePropellantKg).toBe(2425.0);
    });

    it('rejects decisions requiring more propellant than available before any mutation occurs', async () => {
      const propSub = flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as any;
      const initialPropellant = propSub.getPropellantRemainingKg();

      const excessivePropOption = {
        ...decisionManager.generateAndValidateOptions(500)[0],
        id: 'opt-excessive-prop',
        category: 'DEPLOY_LANDER' as const,
        resourceRequirements: {
          estimatedPropellantKg: initialPropellant + 1000.0, // Exceeds reserves
        },
      };

      const proposed = decisionManager.proposeDecision(excessivePropOption, 500);
      decisionManager.authorizeDecision(proposed.decisionId, true, 'Approved', 505, {
        bypassFeasibilityCheck: true,
      });

      const execResult = await decisionManager.executeDecision(proposed.decisionId, 510);
      expect(execResult.success).toBe(false);
      expect(execResult.errorMessage).toMatch(/Propellant shortage|Insufficient propellant/i);

      // Authoritative propellant remains completely untouched
      expect(propSub.getPropellantRemainingKg()).toBe(initialPropellant);
    });

    it('authoritatively allocates storage in OnboardStorage and synchronizes snapshot', async () => {
      const storage = commManager.getStorage();
      const initialUsed = storage.getUsedStorageBytes();
      const initialAvailable = storage.getAvailableStorageBytes();

      flightComputer.getSubsystemManager().getSubsystem('SCIENCE')?.setStatus('NOMINAL');

      const met = 600;
      decisionManager.syncEngineeringSnapshot(met);
      const options = decisionManager.generateAndValidateOptions(met);
      const surveyOpt = options.find((o) => o.category === 'CONTINUE_INVESTIGATION')!;
      expect(surveyOpt.resourceRequirements.estimatedStorageBytes).toBe(65536);

      const proposed = decisionManager.proposeDecision(surveyOpt, met);
      decisionManager.authorizeDecision(proposed.decisionId, true, 'Approved survey', met + 5);

      const execResult = await decisionManager.executeDecision(proposed.decisionId, met + 10);
      expect(execResult.success).toBe(true);

      // Storage used increased by at least 65536 bytes (plus command ack if queued)
      expect(storage.getUsedStorageBytes()).toBeGreaterThanOrEqual(initialUsed + 65536);
      expect(storage.getAvailableStorageBytes()).toBeLessThanOrEqual(initialAvailable - 65536);

      // Subsequent snapshot query reflects updated storage
      const snap = decisionManager.syncEngineeringSnapshot(met + 15);
      expect(snap.storageUsedBytes).toBeGreaterThanOrEqual(initialUsed + 65536);
    });

    it('rejects decisions exceeding storage capacity before allocating data', async () => {
      const storage = commManager.getStorage();
      const initialUsed = storage.getUsedStorageBytes();

      const excessiveStorageOpt = {
        ...decisionManager.generateAndValidateOptions(700)[0],
        id: 'opt-excessive-storage',
        resourceRequirements: {
          estimatedStorageBytes: storage.getAvailableStorageBytes() + 10_000_000,
        },
      };

      const proposed = decisionManager.proposeDecision(excessiveStorageOpt, 700);
      decisionManager.authorizeDecision(proposed.decisionId, true, 'Approved', 705, {
        bypassFeasibilityCheck: true,
      });

      const execResult = await decisionManager.executeDecision(proposed.decisionId, 710);
      expect(execResult.success).toBe(false);
      expect(execResult.errorMessage).toMatch(/Storage shortage|Insufficient onboard storage capacity/i);

      // Storage remains completely unchanged
      expect(storage.getUsedStorageBytes()).toBe(initialUsed);
    });
  });
});
