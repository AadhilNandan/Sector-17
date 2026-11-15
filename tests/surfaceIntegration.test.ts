/**
 * SECTOR 17 — Surface Exploration & Simulation Runtime Integration Tests (Phase 6.6)
 * Verifies end-to-end integration between SurfaceMissionManager, SimulationRuntime,
 * FlightComputer, SubsystemManager, NavigationManager, EventEngine, ScienceDataRegistry,
 * Onboard SSDR Storage, Campaign Progression, and Authoritative Save/Restore.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SurfaceMissionManager } from '../src/simulation/surface/surfaceMissionManager';
import { CAMPAIGN_STAGES_SEQUENCE } from '../src/campaign/campaignStages';
import type { CampaignStageId } from '../src/campaign/campaignTypes';
import { DecisionOptionGenerator } from '../src/simulation/missionDecision/decisionOptionGenerator';
import { DecisionEvidenceManager } from '../src/simulation/missionDecision/decisionEvidence';
import { RiskAssessmentEngine } from '../src/simulation/missionDecision/riskAssessment';
import type { SpacecraftEngineeringSnapshot } from '../src/simulation/missionDecision/types';

function advanceCampaignToReconnaissance(runtime: SimulationRuntime): void {
  const campaign = runtime.getCampaignManager();
  if (campaign) {
    const sm = campaign.getStateMachine();
    const stages: CampaignStageId[] = [
      'MISSION_SELECTION',
      'SPACECRAFT_DESIGN',
      'ENGINEERING_VALIDATION',
      'MISSION_READINESS',
      'LAUNCH_AUTHORIZATION',
      'LAUNCH',
      'INTERPLANETARY_CRUISE',
      'JUPITER_ARRIVAL',
      'EUROPA_RECONNAISSANCE',
    ];
    for (const st of stages) {
      if (CAMPAIGN_STAGES_SEQUENCE.indexOf(sm.getCurrentStageId()) < CAMPAIGN_STAGES_SEQUENCE.indexOf(st)) {
        sm.transitionTo(st, 0);
      }
    }
  }
}

async function authorizeParkingOrbitViaDecision(runtime: SimulationRuntime): Promise<void> {
  // Advance campaign to Europa Reconnaissance stage
  advanceCampaignToReconnaissance(runtime);

  // Set navigation phase to reconnaissance and execute genuine science scan
  runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });
  const scanResult = runtime.triggerReconnaissanceScan();
  if (!scanResult.success) {
    throw new Error(`Failed to trigger reconnaissance scan: ${scanResult.reason}`);
  }

  const opt = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
  if (!opt) {
    throw new Error('opt-authorize-parking-orbit not generated in available decisions');
  }
  runtime.proposeDecision(opt.id);
  runtime.authorizeDecision(opt.id, true);
  const authRes = await runtime.executeDecision(opt.id);
  if (!authRes.success) {
    throw new Error(`Failed to execute parking orbit decision: ${authRes.errorMessage}`);
  }
}

describe('Surface Exploration & Simulation Runtime Integration', () => {
  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    SimulationRuntime.resetAll();
    vi.clearAllMocks();
  });

  /* ------------------------------------------------------------------------ */
  /* 1. Runtime Initialization & Snapshot Exposure                            */
  /* ------------------------------------------------------------------------ */
  it('initializes SurfaceMissionManager and exposes surface state in SimulationSnapshot', () => {
    const runtime = SimulationRuntime.getOrCreate('surf-init-test');
    const snap = runtime.getSnapshot();

    expect(snap.surface).toBeDefined();
    expect(snap.surface?.landingSite).toBe('Pelagon Chaos');
    expect(snap.surface?.parkingOrbitPrerequisiteMet).toBe(false);
    expect(snap.surface?.rover).toBeDefined();
    expect(snap.surface?.rover.deploymentState).toBe('STOWED');
    expect(snap.surface?.terrainGrid.length).toBe(10);
    expect(snap.surface?.objectives.length).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Lander Touchdown Gating & Rover Deployment Sequence                   */
  /* ------------------------------------------------------------------------ */
  it('blocks rover deployment before lander touchdown, and deploys successfully once landed', async () => {
    const runtime = SimulationRuntime.getOrCreate('surf-deploy-gate-test');

    // 1. Attempt deploy while lander is still STOWED aboard carrier
    const blockedDeploy = runtime.deploySurfaceRover();
    expect(blockedDeploy.success).toBe(false);
    expect(blockedDeploy.message).toContain('Lander flight state is STOWED');
    expect(runtime.getSnapshot().surface?.rover.deploymentState).toBe('STOWED');

    // 2. Advance navigation through TJI, JOI, and Lander Touchdown
    await runtime.executeNavigationManeuver('mnv-tji-01');
    await runtime.executeNavigationManeuver('mnv-joi-01');
    await runtime.executeNavigationManeuver('mnv-lander-deploy');

    // Attempt descent without prerequisite authorization -> rejected!
    const unauthDescent = await runtime.executeNavigationManeuver('mnv-lander-descent');
    expect(unauthDescent.success).toBe(false);

    // Authorize parking-orbit prerequisite via formal decision pipeline (CRIT-01 & MAJ-04)
    await authorizeParkingOrbitViaDecision(runtime);
    await runtime.executeNavigationManeuver('mnv-lander-descent');

    expect(runtime.getSnapshot().navigation?.lander.flightState).toBe('TOUCHDOWN');

    // 3. Now execute rover deployment
    const successDeploy = runtime.deploySurfaceRover();
    expect(successDeploy.success).toBe(true);

    const snapAfter = runtime.getSnapshot();
    expect(snapAfter.surface?.rover.deploymentState).toBe('DEPLOYED');
    expect(snapAfter.surface?.rover.mobilityState).toBe('READY');

    // Verify LANDER_ROVER subsystem marked NOMINAL in flight computer
    const fswSub = runtime.getFlightComputer().getSubsystemManager().getSubsystem('LANDER_ROVER');
    expect(fswSub?.getStatus()).toBe('NOMINAL');

    // Verify events were emitted
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'ROVER_DEPLOYMENT_COMPLETE')).toBe(true);
    expect(events.some((e) => e.eventType === 'ROVER_SYSTEMS_INITIALIZED')).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Rover Traverse & Topological Navigation via Runtime                   */
  /* ------------------------------------------------------------------------ */
  it('executes rover traverse, updates coordinates, consumes energy, and emits events', async () => {
    const runtime = SimulationRuntime.getOrCreate('surf-traverse-test');

    // Touchdown and deploy
    await runtime.executeNavigationManeuver('mnv-lander-deploy');
    await authorizeParkingOrbitViaDecision(runtime);
    await runtime.executeNavigationManeuver('mnv-lander-descent');
    runtime.deploySurfaceRover();

    const energyBefore = runtime.getSnapshot().surface?.rover.batteryEnergyJoules ?? 0;

    // Traverse from [4, 4] to [4, 5] (adjacent south)
    const result = runtime.executeRoverTraverse(4, 5);
    expect(result.success).toBe(true);
    expect(result.distanceTraveledMetres).toBe(20.0);

    const snap = runtime.getSnapshot();
    expect(snap.surface?.rover.currentCoords).toEqual([4, 5]);
    expect(snap.surface?.rover.distanceTraveledMetres).toBe(20.0);
    expect(snap.surface?.rover.batteryEnergyJoules).toBeLessThan(energyBefore);

    // Verify events
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'SURFACE_TRAVERSE_STARTED')).toBe(true);
    expect(events.some((e) => e.eventType === 'SURFACE_TRAVERSE_COMPLETED')).toBe(true);
  });

  it('detects anomaly feature and emits ANOMALY_DETECTED when traversing into anomaly cell', async () => {
    const runtime = SimulationRuntime.getOrCreate('surf-anomaly-test');

    // Land and deploy
    await runtime.executeNavigationManeuver('mnv-lander-deploy');
    await authorizeParkingOrbitViaDecision(runtime);
    await runtime.executeNavigationManeuver('mnv-lander-descent');
    runtime.deploySurfaceRover();

    // Move rover step-by-step from [4, 4] toward anomaly at [6, 7]:
    // Step 1: [4, 4] -> [5, 5] (diagonal)
    const s1 = runtime.executeRoverTraverse(5, 5);
    expect(s1.success).toBe(true);

    // Step 2: [5, 5] -> [6, 6] (diagonal)
    const s2 = runtime.executeRoverTraverse(6, 6);
    expect(s2.success).toBe(true);

    // Step 3: [6, 6] -> [6, 7] (anomaly cell)
    const s3 = runtime.executeRoverTraverse(6, 7);
    expect(s3.success).toBe(true);

    const snap = runtime.getSnapshot();
    expect(snap.surface?.rover.currentCoords).toEqual([6, 7]);

    // Anomaly event emitted
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'ANOMALY_DETECTED')).toBe(true);

    // Anomaly objective completed
    const anomalyObj = snap.surface?.objectives.find((o) => o.id === 'obj-rover-anomaly');
    expect(anomalyObj?.isCompleted).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 4. In-Situ Surface Science & Central Registry Ingestion                  */
  /* ------------------------------------------------------------------------ */
  it('acquires cryogenic science observation, ingests Level 0 product into ScienceDataRegistry', async () => {
    const runtime = SimulationRuntime.getOrCreate('surf-science-test');

    // Land and deploy
    await runtime.executeNavigationManeuver('mnv-lander-deploy');
    await authorizeParkingOrbitViaDecision(runtime);
    await runtime.executeNavigationManeuver('mnv-lander-descent');
    runtime.deploySurfaceRover();

    const registry = runtime.getScienceManager().getDataRegistry();
    const l0Before = registry.getAllLevel0().length;

    // Execute Cryo-Drill sampling
    const result = runtime.executeSurfaceScience('CRYO_DRILL');
    expect(result.success).toBe(true);
    expect(result.observation?.instrumentId).toBe('CRYO_DRILL');

    // Verify Level 0 product registered in central ScienceDataRegistry
    const l0Products = registry.getAllLevel0();
    expect(l0Products.length).toBe(l0Before + 1);
    expect(l0Products.some((p) => p.instrument === 'CRYO_DRILL')).toBe(true);

    // Verify rover flash storage was used
    const snap = runtime.getSnapshot();
    expect(snap.surface?.rover.onboardStorageUsedBytes).toBeGreaterThan(0);
    expect(snap.surface?.rover.observations.length).toBe(1);

    // Verify event
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'SURFACE_OBSERVATION_ACQUIRED')).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 5. Surface-to-Carrier Relay & Store-and-Forward Ingestion                */
  /* ------------------------------------------------------------------------ */
  it('relays surface observations to AETHON SSDR storage and clears rover flash memory', async () => {
    const runtime = SimulationRuntime.getOrCreate('surf-relay-test');

    // Land, deploy, and take 2 science observations
    await runtime.executeNavigationManeuver('mnv-lander-deploy');
    await authorizeParkingOrbitViaDecision(runtime);
    await runtime.executeNavigationManeuver('mnv-lander-descent');
    runtime.deploySurfaceRover();

    runtime.executeSurfaceScience('CRYO_DRILL');
    runtime.executeSurfaceScience('SURFACE_CAM');

    const roverStorageBefore = runtime.getSnapshot().surface?.rover.onboardStorageUsedBytes ?? 0;
    expect(roverStorageBefore).toBeGreaterThan(0);

    const aethonStorageBefore = runtime.getSnapshot().storage.usedBytes;

    // Transmit to relay
    const relayResult = runtime.transmitSurfaceDataToRelay();
    expect(relayResult.success).toBe(true);
    expect(relayResult.bytesUploaded).toBe(roverStorageBefore);

    const snapAfter = runtime.getSnapshot();
    // Rover storage cleared (store-and-forward)
    expect(snapAfter.surface?.rover.onboardStorageUsedBytes).toBe(0);

    // Observations marked as transmitted
    expect(snapAfter.surface?.rover.observations.every((o) => o.isTransmittedToRelay)).toBe(true);

    // AETHON carrier storage received the packets
    expect(snapAfter.storage.usedBytes).toBeGreaterThan(aethonStorageBefore);

    // Relay event emitted & objective completed
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'SURFACE_DATA_TRANSMITTED')).toBe(true);
    const relayObj = snapAfter.surface?.objectives.find((o) => o.id === 'obj-rover-relay');
    expect(relayObj?.isCompleted).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Campaign Stage 12 (SURFACE_OPERATIONS) Integration                    */
  /* ------------------------------------------------------------------------ */
  it('satisfies Campaign Stage 12 requirements upon rover deployment and science acquisition', async () => {
    const runtime = SimulationRuntime.getOrCreate('surf-campaign-test');
    const campaign = runtime.getCampaignManager();
    const sm = campaign.getStateMachine();

    // Advance campaign sequentially to SURFACE_OPERATIONS
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

    // Land and deploy rover
    await runtime.executeNavigationManeuver('mnv-lander-deploy');
    await authorizeParkingOrbitViaDecision(runtime);
    await runtime.executeNavigationManeuver('mnv-lander-descent');

    if (campaign.getCurrentStageId() !== 'SURFACE_OPERATIONS') {
      sm.transitionTo('SURFACE_OPERATIONS', 120);
    }

    expect(campaign.getCurrentStageId()).toBe('SURFACE_OPERATIONS');
    runtime.deploySurfaceRover();

    // Acquire surface sample
    runtime.executeSurfaceScience('CRYO_DRILL');

    // Verify stage completion evaluation
    const canAdvance = campaign.canAdvanceToNextStage();
    expect(canAdvance.canAdvance).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 7. Authoritative Save / Restore & Deterministic Continuity               */
  /* ------------------------------------------------------------------------ */
  it('serializes complete surface mission state and restores it without divergence', async () => {
    const runtimeA = SimulationRuntime.getOrCreate('surf-save-a');

    // Land, deploy, move, and acquire observation on runtimeA
    await runtimeA.executeNavigationManeuver('mnv-lander-deploy');
    await authorizeParkingOrbitViaDecision(runtimeA);
    await runtimeA.executeNavigationManeuver('mnv-lander-descent');
    runtimeA.deploySurfaceRover();
    runtimeA.executeRoverTraverse(4, 5);
    runtimeA.executeSurfaceScience('THERMAL_PROBE');

    const snapshotA = runtimeA.exportSaveSnapshot();
    expect(snapshotA.surface).toBeDefined();
    expect(snapshotA.surface?.isInitialized).toBe(true);
    expect(snapshotA.surface?.rover.currentCoords).toEqual([4, 5]);
    expect(snapshotA.surface?.rover.distanceTraveledMetres).toBe(20.0);
    expect(snapshotA.surface?.rover.observations.length).toBe(1);

    // Create fresh runtimeB and restore snapshotA
    const runtimeB = SimulationRuntime.getOrCreate('surf-save-b');
    runtimeB.restoreSaveSnapshot(snapshotA);

    const snapshotB = runtimeB.getSnapshot();
    expect(snapshotB.surface?.isInitialized).toBe(true);
    expect(snapshotB.surface?.rover.currentCoords).toEqual([4, 5]);
    expect(snapshotB.surface?.rover.distanceTraveledMetres).toBe(20.0);
    expect(snapshotB.surface?.rover.observations.length).toBe(1);
    expect(snapshotB.surface?.rover.observations[0].instrumentId).toBe('THERMAL_PROBE');

    // Verify further actions continue deterministically from restored state
    const nextMove = runtimeB.executeRoverTraverse(4, 6);
    expect(nextMove.success).toBe(true);
    expect(runtimeB.getSnapshot().surface?.rover.currentCoords).toEqual([4, 6]);
    expect(runtimeB.getSnapshot().surface?.rover.distanceTraveledMetres).toBe(40.0);
  });

  it('supports backward-compatible restoration when surface is absent from legacy save', () => {
    const runtime = SimulationRuntime.getOrCreate('surf-legacy-test');
    const fullSnapshot = runtime.exportSaveSnapshot();

    // Strip surface state as if from Phase 6.5
    const { surface, ...legacySnapshot } = fullSnapshot;
    expect((legacySnapshot as any).surface).toBeUndefined();

    // Restoring legacy snapshot should succeed cleanly without crashing
    expect(() => runtime.restoreSaveSnapshot(legacySnapshot as any)).not.toThrow();
    const snap = runtime.getSnapshot();
    expect(snap.surface).toBeDefined();
    expect(snap.surface?.rover.deploymentState).toBe('STOWED');
    expect(snap.surface?.parkingOrbitPrerequisiteMet).toBe(false);
  });

  /* ------------------------------------------------------------------------ */
  /* 8. Phase 6.6.1 Hardening Regression Verifications                       */
  /* ------------------------------------------------------------------------ */
  describe('Phase 6.6.1 Hardening Regressions', () => {
    it('enforces atomic carrier relay transmission and zero mutation on storage exhaustion (MAJ-02)', async () => {
      const runtime = SimulationRuntime.getOrCreate('surf-atomic-relay-test');
      await runtime.executeNavigationManeuver('mnv-lander-deploy');
      await authorizeParkingOrbitViaDecision(runtime);
      await runtime.executeNavigationManeuver('mnv-lander-descent');
      runtime.deploySurfaceRover();

      // Acquire observation
      runtime.executeSurfaceScience('CRYO_DRILL');
      const roverBefore = runtime.getSnapshot().surface?.rover;
      const energyBefore = roverBefore?.batteryEnergyJoules ?? 0;
      const storageUsedBefore = roverBefore?.onboardStorageUsedBytes ?? 0;
      expect(storageUsedBefore).toBeGreaterThan(0);

      // Artificially saturate carrier SSDR storage
      const storage = runtime.getCommunicationManager().getStorage();
      storage.storeData({
        id: 'pkt-fill-carrier-ssdr',
        category: 'engineering',
        sizeBytes: storage.getAvailableStorageBytes(), // Exhaust all available bytes
        priority: 10,
        createdAtMETSeconds: 100,
      });
      expect(storage.getAvailableStorageBytes()).toBe(0);

      // Attempt transmission to carrier relay -> must FAIL
      const result = runtime.transmitSurfaceDataToRelay();
      expect(result.success).toBe(false);
      expect(result.bytesUploaded).toBe(0);
      expect(result.message).toContain('Carrier AETHON SSDR storage capacity exceeded');

      // Verify ZERO mutation of rover state
      const roverAfter = runtime.getSnapshot().surface?.rover;
      expect(roverAfter?.batteryEnergyJoules).toBe(energyBefore);
      expect(roverAfter?.onboardStorageUsedBytes).toBe(storageUsedBefore);
      expect(roverAfter?.observations.every((o) => !o.isTransmittedToRelay)).toBe(true);
    });

    it('rejects relay transmission when link is unavailable or rover is in SAFE mode (MIN-02 & MAJ-02)', async () => {
      const runtime = SimulationRuntime.getOrCreate('surf-relay-link-test');
      await runtime.executeNavigationManeuver('mnv-lander-deploy');
      await authorizeParkingOrbitViaDecision(runtime);
      await runtime.executeNavigationManeuver('mnv-lander-descent');
      runtime.deploySurfaceRover();
      runtime.executeSurfaceScience('THERMAL_PROBE');

      // Set rover to SAFE mode
      runtime.setRoverOperatingMode('SAFE');
      const safeResult = runtime.transmitSurfaceDataToRelay();
      expect(safeResult.success).toBe(false);
      expect(safeResult.message).toContain('SAFE survival mode');

      // Restore to IDLE, but disable relay link
      runtime.setRoverOperatingMode('IDLE');
      const manager = runtime.getSurfaceMissionManager();
      (manager as any).relayState.isRelayLinkAvailable = false;

      const linkDownResult = runtime.transmitSurfaceDataToRelay();
      expect(linkDownResult.success).toBe(false);
      expect(linkDownResult.message).toContain('Proximity relay link is unavailable');
    });

    it('guarantees unique Level 0 product IDs for same instrument at identical MET (MIN-01)', async () => {
      const runtime = SimulationRuntime.getOrCreate('surf-unique-id-test');
      await runtime.executeNavigationManeuver('mnv-lander-deploy');
      await authorizeParkingOrbitViaDecision(runtime);
      await runtime.executeNavigationManeuver('mnv-lander-descent');
      runtime.deploySurfaceRover();

      // Acquire two samples in rapid succession with CRYO_DRILL
      const res1 = runtime.executeSurfaceScience('CRYO_DRILL');
      const res2 = runtime.executeSurfaceScience('CRYO_DRILL');

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.observation?.id).not.toBe(res2.observation?.id);
      expect(res1.level0Product?.id).not.toBe(res2.level0Product?.id);
      expect(res1.observation?.dataPacketId).not.toBe(res2.observation?.dataPacketId);

      const registry = runtime.getScienceManager().getDataRegistry();
      const cryoProducts = registry.getAllLevel0().filter((p) => p.instrument === 'CRYO_DRILL');
      const uniqueIds = new Set(cryoProducts.map((p) => p.id));
      expect(uniqueIds.size).toBe(cryoProducts.length);
    });

    it('strictly restores parkingOrbitPrerequisiteMet boolean value in save/restore (CRIT-01)', () => {
      const runtime = SimulationRuntime.getOrCreate('surf-orbit-auth-save');
      const initialSnap = runtime.exportSaveSnapshot();
      expect(initialSnap.surface?.parkingOrbitPrerequisiteMet).toBe(false);

      // Corrupt state with truthy non-boolean or missing value
      const corruptedSnapshot = {
        ...initialSnap,
        surface: {
          ...initialSnap.surface!,
          parkingOrbitPrerequisiteMet: undefined as any,
        },
      };

      runtime.restoreSaveSnapshot(corruptedSnapshot as any);
      expect(runtime.getSnapshot().surface?.parkingOrbitPrerequisiteMet).toBe(false);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 9. Phase 6.6.2 Targeted Hardening Regressions                            */
  /* ------------------------------------------------------------------------ */
  describe('Phase 6.6.2 Targeted Hardening Regressions', () => {
    // 1. CRIT-01 & MAJ-04: Formal Decision Pipeline & Gating
    it('enforces formal decision pipeline, prerequisite gating, and deadlock prevention for parking orbit (CRIT-01 & MAJ-04)', async () => {
      const runtime = SimulationRuntime.getOrCreate('surf-crit01-decision-gate');

      // Pre-reconnaissance stage: option must NOT be generated
      const initialDecisions = runtime.getAvailableDecisions();
      expect(initialDecisions.some((d) => d.id.startsWith('opt-authorize-parking-orbit'))).toBe(false);

      // In Europa reconnaissance phase, option is generated but INFEASIBLE until EXP-V-OBJ-01 is complete
      advanceCampaignToReconnaissance(runtime);
      runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });
      const decisionsInRecon = runtime.getAvailableDecisions();
      const parkingOpt = decisionsInRecon.find((d) => d.id.startsWith('opt-authorize-parking-orbit'));
      expect(parkingOpt).toBeDefined();

      // Feasibility check: must be INFEASIBLE because EXP-V-OBJ-01 is incomplete
      expect(parkingOpt?.validationResult?.status).toBe('INFEASIBLE');
      expect(parkingOpt?.validationResult?.constraintViolations.some((c) => c.includes('EXP-V-OBJ-01'))).toBe(true);

      // Proposing and attempting to authorize INFEASIBLE option must throw
      runtime.proposeDecision(parkingOpt!.id);
      expect(() => runtime.authorizeDecision(parkingOpt!.id, true)).toThrow(/validation status 'INFEASIBLE'/);

      // Satisfy prerequisite EXP-V-OBJ-01 via genuine reconnaissance scan pipeline
      const scanRes = runtime.triggerReconnaissanceScan();
      expect(scanRes.success).toBe(true);

      const evalObj = runtime.getDecisionManager().getObjectiveEvaluator().getObjective('EXP-V-OBJ-01');
      expect(evalObj?.state).toBe('COMPLETED');

      // Re-evaluate: now it must be FEASIBLE
      const evalReport = runtime.evaluateDecision(parkingOpt!.id);
      expect(evalReport.isFeasible).toBe(true);

      // Authorize and execute through formal pipeline
      const authRec = runtime.authorizeDecision(parkingOpt!.id, true);
      expect(authRec.status).toBe('APPROVED');

      const execResult = await runtime.executeDecision(parkingOpt!.id);
      expect(execResult.success).toBe(true);
      expect(execResult.consequences.length).toBeGreaterThan(0);

      // Verify authoritative state updated
      expect(runtime.getSnapshot().surface?.parkingOrbitPrerequisiteMet).toBe(true);
      expect(runtime.getNavigationManager().isParkingOrbitPrerequisiteAuthorized()).toBe(true);

      // Verify option is not regenerated once authorized
      const decisionsAfter = runtime.getAvailableDecisions();
      expect(decisionsAfter.some((d) => d.id.startsWith('opt-authorize-parking-orbit'))).toBe(false);
    });

    // 2. MAJ-02 & MAJ-03: Single Authoritative Source & Single Event Dispatch
    it('maintains single source of truth and emits exactly one authorization event (MAJ-02 & MAJ-03)', async () => {
      const runtime = SimulationRuntime.getOrCreate('surf-single-source-test');
      const nav = runtime.getNavigationManager();
      const surface = runtime.getSurfaceMissionManager();

      expect(nav.isParkingOrbitPrerequisiteAuthorized()).toBe(false);
      expect(surface.isParkingOrbitPrerequisiteAuthorized()).toBe(false);

      // Authorize via formal decision
      await authorizeParkingOrbitViaDecision(runtime);

      expect(nav.isParkingOrbitPrerequisiteAuthorized()).toBe(true);
      expect(surface.isParkingOrbitPrerequisiteAuthorized()).toBe(true);

      const eventsFirst = runtime.getMissionEvents().filter((e) => e.eventType === 'PARKING_ORBIT_ASSUMPTION_AUTHORIZED');
      expect(eventsFirst.length).toBe(1);

      // Attempt repeated authorization on NavigationManager
      const repeated = nav.authorizeParkingOrbitAssumption(500);
      expect(repeated.success).toBe(true);
      expect(repeated.message).toContain('already authorized');

      // Verify no duplicate event was emitted
      const eventsSecond = runtime.getMissionEvents().filter((e) => e.eventType === 'PARKING_ORBIT_ASSUMPTION_AUTHORIZED');
      expect(eventsSecond.length).toBe(1);
    });

    // 3. CRIT-02: Transactional Relay Failure & Recovery
    it('rolls back carrier storage and preserves rover state on relay failure, allowing clean retry (CRIT-02)', async () => {
      const runtime = SimulationRuntime.getOrCreate('surf-crit02-relay-test');
      await runtime.executeNavigationManeuver('mnv-lander-deploy');
      await authorizeParkingOrbitViaDecision(runtime);
      await runtime.executeNavigationManeuver('mnv-lander-descent');
      runtime.deploySurfaceRover();

      // Acquire 2 observations
      runtime.executeSurfaceScience('CRYO_DRILL');
      runtime.executeSurfaceScience('SURFACE_CAM');

      const roverBefore = runtime.getSnapshot().surface?.rover;
      const energyBefore = roverBefore?.batteryEnergyJoules ?? 0;
      const storageUsedBefore = roverBefore?.onboardStorageUsedBytes ?? 0;
      const observationsBefore = [...(roverBefore?.observations ?? [])];

      // Fill carrier SSDR so batch capacity fails
      const storage = runtime.getCommunicationManager().getStorage();
      const availableBefore = storage.getAvailableStorageBytes();
      storage.storeData({
        id: 'pkt-filler-ssdr',
        category: 'engineering',
        sizeBytes: availableBefore - 1000, // Leave only 1000 bytes, observations need ~70 MB
        createdAtMETSeconds: 200,
      });

      const carrierUsedBefore = storage.getUsedStorageBytes();

      // Attempt relay transmission -> must fail
      const result = runtime.transmitSurfaceDataToRelay();
      expect(result.success).toBe(false);
      expect(result.bytesUploaded).toBe(0);

      // Verify carrier storage did not leak partial packets
      expect(storage.getUsedStorageBytes()).toBe(carrierUsedBefore);

      // Verify rover state was completely unmutated
      const roverAfter = runtime.getSnapshot().surface?.rover;
      expect(roverAfter?.batteryEnergyJoules).toBe(energyBefore);
      expect(roverAfter?.onboardStorageUsedBytes).toBe(storageUsedBefore);
      expect(roverAfter?.observations.length).toBe(observationsBefore.length);
      expect(roverAfter?.observations.every((o) => !o.isTransmittedToRelay)).toBe(true);

      // Free space on carrier SSDR
      storage.clear();

      // Retry transmission -> must SUCCEED cleanly without duplicate ID collisions
      const retryResult = runtime.transmitSurfaceDataToRelay();
      expect(retryResult.success).toBe(true);
      expect(retryResult.bytesUploaded).toBeGreaterThan(0);

      const roverFinal = runtime.getSnapshot().surface?.rover;
      expect(roverFinal?.onboardStorageUsedBytes).toBe(0);
      expect(roverFinal?.observations.every((o) => o.isTransmittedToRelay)).toBe(true);
    });

    // 4. MAJ-01: Radiation Degradation Persistence
    it('persists radiationTier across save/restore and remains idempotent after reloading (MAJ-01)', async () => {
      const runtimeA = SimulationRuntime.getOrCreate('surf-rad-save-a');
      await runtimeA.executeNavigationManeuver('mnv-lander-deploy');
      await authorizeParkingOrbitViaDecision(runtimeA);
      await runtimeA.executeNavigationManeuver('mnv-lander-descent');
      runtimeA.deploySurfaceRover();

      // Advance rover radiation into DEGRADED_250K tier
      const managerA = runtimeA.getSurfaceMissionManager();
      const currentRover = managerA.getRoverState();
      (managerA as any).rover = {
        ...currentRover,
        cumulativeRadiationRads: 260_000,
      };
      // Tick once to apply degradation and update snapshot
      managerA.step(10, 1000);
      (runtimeA as any).updateSnapshot();

      const snapA = runtimeA.getSnapshot();
      expect(snapA.surface?.rover.radiationTier).toBe('DEGRADED_250K');
      expect(snapA.surface?.rover.mobilityHealthPercent).toBe(75.0);
      const degradedCountA = snapA.surface?.rover.instruments.filter((i) => i.status === 'DEGRADED').length;
      expect(degradedCountA).toBe(1);

      // Save and restore into fresh runtimeB
      const savedSnapshot = runtimeA.exportSaveSnapshot();
      expect(savedSnapshot.surface?.rover.radiationTier).toBe('DEGRADED_250K');

      const runtimeB = SimulationRuntime.getOrCreate('surf-rad-save-b');
      runtimeB.restoreSaveSnapshot(savedSnapshot);

      const snapB = runtimeB.getSnapshot();
      expect(snapB.surface?.rover.radiationTier).toBe('DEGRADED_250K');
      expect(snapB.surface?.rover.mobilityHealthPercent).toBe(75.0);

      // Advance runtimeB by multiple ticks at > 250 krad
      const managerB = runtimeB.getSurfaceMissionManager();
      for (let t = 0; t < 5; t++) {
        managerB.step(10, 1010 + t * 10);
      }

      // Invariant: no further instruments are degraded on resumption
      const snapBAfter = runtimeB.getSnapshot();
      expect(snapBAfter.surface?.rover.radiationTier).toBe('DEGRADED_250K');
      expect(snapBAfter.surface?.rover.mobilityHealthPercent).toBe(75.0);
      const degradedCountB = snapBAfter.surface?.rover.instruments.filter((i) => i.status === 'DEGRADED').length;
      expect(degradedCountB).toBe(1);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 10. Phase 6.6.3 Final Hardening & Verification                           */
  /* ------------------------------------------------------------------------ */
  describe('Phase 6.6.3: Science Evidence Pipeline & Final Hardening', () => {
    // 1. CRIT-01: End-to-end reconnaissance scan pipeline
    it('completes EXP-V-OBJ-01 via genuine reconnaissance radar pipeline and renders parking orbit decision FEASIBLE (CRIT-01)', async () => {
      const runtime = SimulationRuntime.getOrCreate('crit01-pipeline-test');
      advanceCampaignToReconnaissance(runtime);
      runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });

      // Initial objective state: NOT_STARTED
      const objBefore = runtime.getDecisionManager().getObjectiveEvaluator().getObjective('EXP-V-OBJ-01');
      expect(objBefore?.state).toBe('NOT_STARTED');

      // Trigger reconnaissance scan
      const scanResult = runtime.triggerReconnaissanceScan();
      expect(scanResult.success).toBe(true);
      expect(scanResult.bytesGenerated).toBe(125_000_000);

      // Verify L0, L1, L2 products in data registry
      const registry = runtime.getScienceManager().getDataRegistry();
      const l0Prods = registry.getAllLevel0();
      const l1Prods = registry.getAllLevel1();
      const l2Prods = registry.getAllLevel2();
      expect(l0Prods.some((p) => p.instrument === 'REASON')).toBe(true);
      expect(l1Prods.some((p) => p.instrument === 'REASON')).toBe(true);
      const reasonL2 = l2Prods.find((p) => p.instrument === 'REASON');
      expect(reasonL2).toBeDefined();

      // Verify deep reflector candidate detected at ~14.8 km depth
      const deepReflector = (reasonL2 as any).detectedReflectors.find((r: any) => r.estimatedDepthMetres > 500);
      expect(deepReflector).toBeDefined();
      expect(deepReflector.estimatedDepthMetres).toBeCloseTo(14864, -2);
      expect(deepReflector.echoAmplitude).toBeGreaterThanOrEqual(0.7);

      // Objective EXP-V-OBJ-01 must transition to COMPLETED naturally
      const objAfter = runtime.getDecisionManager().getObjectiveEvaluator().getObjective('EXP-V-OBJ-01');
      expect(objAfter?.state).toBe('COMPLETED');
      expect(objAfter?.progressPercent).toBe(100);

      // opt-authorize-parking-orbit must now be FEASIBLE without manual state injection
      const opt = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(opt).toBeDefined();
      expect(opt?.validationResult?.status).toBe('FEASIBLE');
    });

    // 2. MAJ-01: Gating without arbitrary 100-second constraint
    it('gates parking orbit decision by campaign stage and navigation phase rather than arbitrary MET (MAJ-01)', async () => {
      const runtime = SimulationRuntime.getOrCreate('maj01-gate-test');

      // Early stage: Stage 0 (CAMPAIGN_INTRO) at various MET values -> never generated
      for (const testMET of [0, 100, 500, 10_000]) {
        runtime.getDecisionManager().syncEngineeringSnapshot(testMET);
        const options = runtime.getDecisionManager().generateAndValidateOptions(testMET);
        expect(options.some((o) => o.id.startsWith('opt-authorize-parking-orbit'))).toBe(false);
      }

      // In Stage 10 (SURFACE_MISSION_PREPARATION) at MET = 0 -> generated immediately
      const campaign = runtime.getCampaignManager();
      const sm = campaign.getStateMachine();
      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);
      sm.transitionTo('LAUNCH_AUTHORIZATION', 0);
      sm.transitionTo('LAUNCH', 0);
      sm.transitionTo('INTERPLANETARY_CRUISE', 0);
      sm.transitionTo('JUPITER_ARRIVAL', 0);
      sm.transitionTo('EUROPA_RECONNAISSANCE', 0);
      sm.transitionTo('SURFACE_MISSION_PREPARATION', 0);

      expect(campaign.getCurrentStageId()).toBe('SURFACE_MISSION_PREPARATION');

      const optionsAtMet0 = runtime.getAvailableDecisions();
      const optAtMet0 = optionsAtMet0.find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(optAtMet0).toBeDefined();

      // Verify GNC requirement: set GNC to FAULT -> INFEASIBLE
      runtime.getFlightComputer().getSubsystemManager().setSubsystemStatus('GNC', 'FAULT', 'GNC loss of star lock', 1);

      const optGncFault = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(optGncFault?.validationResult?.status).toBe('INFEASIBLE');
      expect(optGncFault?.validationResult?.constraintViolations.some((c) => c.includes('GNC'))).toBe(true);

      // Restore GNC to NOMINAL -> GNC healthy again
      runtime.getFlightComputer().getSubsystemManager().setSubsystemStatus('GNC', 'NOMINAL', 'Star tracker re-locked', 2);
      const optGncResolved = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(optGncResolved?.validationResult?.constraintViolations.some((c) => c.includes('GNC'))).toBe(false);
    });

    // 3. MIN-01: Radiation tier validation and conservative derivation on restore
    it('validates and conservatively derives radiation tier during state restoration (MIN-01)', () => {
      const manager = new SurfaceMissionManager();

      // Case 1: Valid tier matching dose
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 10_000,
          radiationTier: 'NOMINAL',
        },
      });
      expect(manager.getRoverState().radiationTier).toBe('NOMINAL');

      // Case 2: Missing radiationTier (undefined / null) derived from cumulativeRadiationRads
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 275_000,
          radiationTier: undefined as any,
        },
      });
      expect(manager.getRoverState().radiationTier).toBe('DEGRADED_250K');

      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 380_000,
          radiationTier: undefined as any,
        },
      });
      expect(manager.getRoverState().radiationTier).toBe('CRITICAL_350K');

      // Case 3: Invalid tier string sanitized to dose-derived tier
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 260_000,
          radiationTier: 'INVALID_STRING' as any,
        },
      });
      expect(manager.getRoverState().radiationTier).toBe('DEGRADED_250K');

      // Case 4: Understated tier cannot override higher implied dose
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 400_000,
          radiationTier: 'NOMINAL' as any,
        },
      });
      expect(manager.getRoverState().radiationTier).toBe('CRITICAL_350K');
    });

    // 4. MIN-02: Telemetry status progression for lander touchdown
    it('correctly reports lander touchdown status progression across mission flight states (MIN-02)', async () => {
      const runtime = SimulationRuntime.getOrCreate('min02-telemetry-test');

      // State 1: Stowed
      expect(runtime.getSnapshot().navigation?.lander.flightState).toBe('STOWED');

      // State 2: Deployed / Descending
      await runtime.executeNavigationManeuver('mnv-lander-deploy');
      expect(runtime.getSnapshot().navigation?.lander.flightState).toBe('DEPLOYED');

      // Authorize parking orbit and execute descent
      await authorizeParkingOrbitViaDecision(runtime);
      await runtime.executeNavigationManeuver('mnv-lander-descent');

      // State 3: Touchdown Confirmed
      expect(runtime.getSnapshot().navigation?.lander.flightState).toBe('TOUCHDOWN');
      expect(runtime.getSnapshot().surface?.isInitialized).toBe(false);

      // State 4: Egress micro-rover -> Rover Deployed
      const deployRes = runtime.deploySurfaceRover();
      expect(deployRes.success).toBe(true);
      expect(runtime.getSnapshot().surface?.isInitialized).toBe(true);
      expect(runtime.getSnapshot().surface?.rover.deploymentState).toBe('DEPLOYED');
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 11. Phase 6.6.4: Audit Remediation Regressions                           */
  /* ------------------------------------------------------------------------ */
  describe('Phase 6.6.4: Audit Remediation Regressions', () => {
    // 1. Task 1: Authoritative Decision Stage Gating Hierarchy Matrix (FINDING-663-01)
    it('enforces fail-closed authoritative decision stage gating matrix (FINDING-663-01)', () => {
      const generator = new DecisionOptionGenerator(new RiskAssessmentEngine());

      const baseSnapshot: SpacecraftEngineeringSnapshot = {
        currentMET: 1000,
        isCommWindowActive: true,
        subsystemStatuses: {
          EPS: 'NOMINAL',
          PROPULSION: 'NOMINAL',
          COMM: 'NOMINAL',
          THERMAL: 'NOMINAL',
          CDH: 'NOMINAL',
          SCIENCE: 'NOMINAL',
          GNC: 'NOMINAL',
          LANDER_ROVER: 'NOMINAL',
        },
        activeFaultCount: 0,
        criticalFaultCount: 0,
        parkingOrbitPrerequisiteMet: false,
      };

      const checkParkingOption = (snap: SpacecraftEngineeringSnapshot, met = 1000) => {
        const evidenceManager = new DecisionEvidenceManager();
        evidenceManager.ingestEngineeringSnapshot(snap);
        const opts = generator.generateOptions(evidenceManager, met);
        return opts.some((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      };

      // Condition 1: Eligible campaign stage + eligible phase -> generated
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: 'EUROPA_RECONNAISSANCE',
          navigationPhase: 'EUROPA_RECONNAISSANCE',
        })
      ).toBe(true);

      // Condition 2: Eligible campaign stage + missing phase -> generated
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: 'SURFACE_MISSION_PREPARATION',
          navigationPhase: undefined,
        })
      ).toBe(true);

      // Condition 3: Missing stage + eligible phase -> generated (standalone navigation harness)
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: undefined,
          navigationPhase: 'EUROPA_RECONNAISSANCE',
        })
      ).toBe(true);

      // Condition 4: Missing stage + missing phase -> NOT generated (fail closed)
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: undefined,
          navigationPhase: undefined,
        })
      ).toBe(false);

      // Condition 5: Explicit ineligible stage (CAMPAIGN_INTRO) + eligible phase -> NOT generated
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: 'CAMPAIGN_INTRO',
          navigationPhase: 'EUROPA_RECONNAISSANCE',
        })
      ).toBe(false);

      // Condition 6: Explicit ineligible stage (EARTH_DEPARTURE) + eligible phase -> NOT generated
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: 'EARTH_DEPARTURE' as any,
          navigationPhase: 'EUROPA_RECONNAISSANCE',
        })
      ).toBe(false);

      // Condition 7: Explicit eligible stage + conflicting phase -> generated (stage is strictly authoritative)
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: 'SURFACE_MISSION_PREPARATION',
          navigationPhase: 'HELIOCENTRIC_CRUISE',
        })
      ).toBe(true);

      // Condition 8: Stage 0 / PRE_LAUNCH -> NOT generated
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: 'CAMPAIGN_INTRO',
          navigationPhase: 'PRE_LAUNCH',
        })
      ).toBe(false);

      // Condition 9: Earth departure phase without campaign stage -> NOT generated
      expect(
        checkParkingOption({
          ...baseSnapshot,
          campaignStageId: undefined,
          navigationPhase: 'EARTH_DEPARTURE',
        })
      ).toBe(false);

      // Condition 10: Interplanetary cruise with large MET (1,000,000 s) -> NOT generated
      expect(
        checkParkingOption(
          {
            ...baseSnapshot,
            campaignStageId: 'INTERPLANETARY_CRUISE',
            navigationPhase: 'HELIOCENTRIC_CRUISE',
          },
          1_000_000
        )
      ).toBe(false);

      // Condition 11: Feasibility gating under eligible stage
      const runtime = SimulationRuntime.getOrCreate('gating-feasibility-test');
      advanceCampaignToReconnaissance(runtime);
      runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });

      // Before recon scan: generated, but INFEASIBLE (EXP-V-OBJ-01 incomplete)
      const optBeforeScan = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(optBeforeScan).toBeDefined();
      expect(optBeforeScan?.validationResult?.status).toBe('INFEASIBLE');
      expect(optBeforeScan?.validationResult?.constraintViolations.some((c) => c.includes('EXP-V-OBJ-01'))).toBe(true);

      // Trigger GNC fault: option remains INFEASIBLE with GNC violation
      runtime.getFlightComputer().getSubsystemManager().setSubsystemStatus('GNC', 'FAULT', 'Star tracker loss', 100);
      const optGncFault = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(optGncFault?.validationResult?.status).toBe('INFEASIBLE');
      expect(optGncFault?.validationResult?.constraintViolations.some((c) => c.includes('GNC'))).toBe(true);

      // Clear GNC fault and perform recon scan: option becomes FEASIBLE
      runtime.getFlightComputer().getSubsystemManager().setSubsystemStatus('GNC', 'NOMINAL', 'Recovered', 101);
      const scanRes = runtime.triggerReconnaissanceScan();
      expect(scanRes.success).toBe(true);

      const optFeasible = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
      expect(optFeasible?.validationResult?.status).toBe('FEASIBLE');
    });

    // 2. Task 3: Lethal Radiation Hardware Degradation Invariants on Restore (FINDING-663-03)
    it('enforces hardware degradation invariants upon state restoration with lethal radiation (FINDING-663-03)', () => {
      const manager = new SurfaceMissionManager();

      // Case 1: Restore >= 350 krad with stored NOMINAL tier and 100% mobility
      // Must enforce zero mobility, SAFE mode, DISABLED mobility, all instruments FAULT
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 360_000,
          radiationTier: 'NOMINAL',
          operatingMode: 'NOMINAL_SCIENCE',
          mobilityState: 'READY',
          mobilityHealthPercent: 100.0,
          wheelHealthPercents: [100, 100, 100, 100],
          instruments: manager.getRoverState().instruments.map((i) => ({ ...i, status: 'NOMINAL' })),
        },
      });

      const state1 = manager.getRoverState();
      expect(state1.radiationTier).toBe('CRITICAL_350K');
      expect(state1.mobilityHealthPercent).toBe(0.0);
      expect(state1.wheelHealthPercents).toEqual([0, 0, 0, 0]);
      expect(state1.mobilityState).toBe('DISABLED');
      expect(state1.operatingMode).toBe('SAFE');
      expect(state1.instruments.every((i) => i.status === 'FAULT')).toBe(true);

      // Case 2: Restore >= 250 krad and < 350 krad with stored NOMINAL tier and nominal instruments
      // Must cap mobility at 75%, and degrade at least one instrument
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 300_000,
          radiationTier: 'NOMINAL',
          operatingMode: 'NOMINAL_SCIENCE',
          mobilityState: 'READY',
          mobilityHealthPercent: 100.0,
          wheelHealthPercents: [100, 100, 100, 100],
          instruments: manager.getRoverState().instruments.map((i) => ({ ...i, status: 'NOMINAL' })),
        },
      });

      const state2 = manager.getRoverState();
      expect(state2.radiationTier).toBe('DEGRADED_250K');
      expect(state2.mobilityHealthPercent).toBeLessThanOrEqual(75.0);
      expect(state2.wheelHealthPercents.every((w) => w <= 75.0)).toBe(true);
      expect(state2.instruments.some((i) => i.status === 'DEGRADED')).toBe(true);

      // Case 3: Restore invalid radiation tier string -> derived correctly from dose
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 270_000,
          radiationTier: 'INVALID_TIER_STR' as any,
        },
      });
      expect(manager.getRoverState().radiationTier).toBe('DEGRADED_250K');

      // Case 4: Repeated restore of the same state is strictly idempotent (no additional instruments degraded)
      const stateBeforeRepeat = manager.getRoverState();
      const degradedCountBefore = stateBeforeRepeat.instruments.filter((i) => i.status === 'DEGRADED').length;

      manager.restoreState({
        isInitialized: true,
        rover: stateBeforeRepeat,
      });

      const stateAfterRepeat = manager.getRoverState();
      const degradedCountAfter = stateAfterRepeat.instruments.filter((i) => i.status === 'DEGRADED').length;
      expect(degradedCountAfter).toBe(degradedCountBefore);
      expect(stateAfterRepeat.mobilityHealthPercent).toBe(stateBeforeRepeat.mobilityHealthPercent);

      // Case 5: Restore followed by multiple simulation ticks remains locked in degraded state
      manager.restoreState({
        isInitialized: true,
        rover: {
          ...manager.getRoverState(),
          cumulativeRadiationRads: 380_000,
          radiationTier: 'NOMINAL',
          mobilityHealthPercent: 100.0,
        },
      });

      for (let t = 0; t < 10; t++) {
        manager.step(10, 5000 + t * 10);
      }

      const lockedState = manager.getRoverState();
      expect(lockedState.radiationTier).toBe('CRITICAL_350K');
      expect(lockedState.mobilityHealthPercent).toBe(0.0);
      expect(lockedState.operatingMode).toBe('SAFE');
      expect(lockedState.mobilityState).toBe('DISABLED');
      expect(lockedState.instruments.every((i) => i.status === 'FAULT')).toBe(true);
    });

    // 3. Task 4: Repeated Reconnaissance Scans & ID Uniqueness (FINDING-663-04)
    it('guarantees unique packet and product IDs across repeated reconnaissance scans at identical MET (FINDING-663-04)', () => {
      const runtime = SimulationRuntime.getOrCreate('repeated-scan-id-test');
      advanceCampaignToReconnaissance(runtime);
      runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });

      // Trigger two scans at the exact same MET = 0
      const scan1 = runtime.triggerReconnaissanceScan();
      const scan2 = runtime.triggerReconnaissanceScan();

      expect(scan1.success).toBe(true);
      expect(scan2.success).toBe(true);

      const packets = runtime.getCommunicationManager().getStorage().getAllPackets();
      const reconPackets = packets.filter((p) => p.category === 'science');
      expect(reconPackets.length).toBe(2);
      expect(reconPackets[0].id).toBe('pkt-recon-0-1');
      expect(reconPackets[1].id).toBe('pkt-recon-0-2');

      const registry = runtime.getScienceManager().getDataRegistry();
      const l0Products = registry.getAllLevel0().filter((p) => p.instrument === 'REASON');
      expect(l0Products.length).toBe(2);
      expect(l0Products[0].id).toBe('l0-recon-radar-0-1');
      expect(l0Products[1].id).toBe('l0-recon-radar-0-2');

      // Verify save and restore preserves sequence counter
      const exported = runtime.exportSaveSnapshot();
      expect(exported.navigation?.reconScanSequence).toBe(2);

      const runtimeRestored = SimulationRuntime.getOrCreate('repeated-scan-restored');
      runtimeRestored.restoreSaveSnapshot(exported);
      advanceCampaignToReconnaissance(runtimeRestored);

      // Third scan should use sequence index 3
      const scan3 = runtimeRestored.triggerReconnaissanceScan();
      expect(scan3.success).toBe(true);

      const restoredPackets = runtimeRestored.getCommunicationManager().getStorage().getAllPackets();
      const thirdPacket = restoredPackets.find((p) => p.id === 'pkt-recon-0-3');
      expect(thirdPacket).toBeDefined();
    });
  });
});
