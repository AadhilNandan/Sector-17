/**
 * SECTOR 17 — Navigation & Simulation Integration Tests (Phase 6.5)
 * Verifies end-to-end integration between NavigationManager, SimulationRuntime,
 * FlightComputer, SubsystemManager, EventEngine, ScienceDataRegistry, SSDR storage,
 * Campaign Progression, and Authoritative Save/Restore.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { PropulsionSubsystem } from '../src/simulation/flightSoftware/subsystemManager';

describe('Navigation & Simulation Runtime Integration', () => {
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
  it('initializes NavigationManager and exposes navigation state in SimulationSnapshot', () => {
    const runtime = SimulationRuntime.getOrCreate('nav-init-test');
    const snap = runtime.getSnapshot();

    expect(snap.navigation).toBeDefined();
    expect(snap.navigation?.currentPhase).toBe('PRE_LAUNCH');
    expect(snap.navigation?.centralBody).toBe('EARTH');
    expect(snap.navigation?.currentOrbit).toBeDefined();
    expect(snap.navigation?.availableManeuvers.length).toBeGreaterThan(0);
    expect(snap.navigation?.lander.flightState).toBe('STOWED');
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Maneuver Feasibility & Execution via Runtime                          */
  /* ------------------------------------------------------------------------ */
  it('validates and executes Trans-Jovian Injection, updating orbital state and consuming propellant', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-tji-test');
    const propBefore = runtime.getSnapshot().propellantRemainingKg;

    // Validate TJI maneuver
    const report = runtime.validateNavigationManeuver('mnv-tji-01');
    expect(report.status).toBe('PASS');
    expect(report.isFeasible).toBe(true);

    // Execute TJI
    const result = await runtime.executeNavigationManeuver('mnv-tji-01');
    expect(result.success).toBe(true);
    expect(result.maneuverType).toBe('TRANS_JOVIAN_INJECTION');

    // Verify snapshot was updated
    const snapAfter = runtime.getSnapshot();
    expect(snapAfter.navigation?.currentPhase).toBe('HELIOCENTRIC_CRUISE');
    expect(snapAfter.navigation?.centralBody).toBe('SUN');
    expect(snapAfter.propellantRemainingKg).toBeLessThan(propBefore);

    // Verify event was emitted
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'TRANS_JOVIAN_INJECTION_COMPLETE')).toBe(true);
  });

  it('rejects maneuver execution when thruster valves are isolated in SAFE mode', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-safe-mode-test');
    const fc = runtime.getFlightComputer();
    const propSub = fc.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;

    // Isolate valves by placing propulsion into SAFE mode
    propSub.toSafeMode();
    expect(propSub.areValvesIsolated()).toBe(true);

    const report = runtime.validateNavigationManeuver('mnv-tcm-01');
    expect(report.status).toBe('FAIL');
    expect(report.isFeasible).toBe(false);
    expect(report.reasons.some((r) => r.includes('valves are closed'))).toBe(true);

    const result = await runtime.executeNavigationManeuver('mnv-tcm-01');
    expect(result.success).toBe(false);
    expect(result.actualDeltaVMps).toBe(0);
    expect(result.propellantConsumedKg).toBe(0);
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Jovian Orbit Insertion & Science Reconnaissance                       */
  /* ------------------------------------------------------------------------ */
  it('executes Jupiter Orbit Insertion, emits milestones, and transitions to JOVIAN_ORBIT', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-joi-test');

    const result = await runtime.executeNavigationManeuver('mnv-joi-01');
    expect(result.success).toBe(true);
    expect(result.maneuverType).toBe('JUPITER_ORBIT_INSERTION');

    const snap = runtime.getSnapshot();
    expect(snap.navigation?.currentPhase).toBe('JOVIAN_ORBIT');
    expect(snap.navigation?.centralBody).toBe('JUPITER');
    expect(snap.navigation?.jupiterCapture.isCaptured).toBe(true);

    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'JUPITER_ARRIVAL')).toBe(true);
    expect(events.some((e) => e.eventType === 'JUPITER_ORBIT_INSERTION_COMPLETE')).toBe(true);
  });

  it('triggers Europa reconnaissance scan, generating SSDR packets and Level 0 science products', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-recon-test');

    // First transition into Europa reconnaissance phase
    await runtime.executeNavigationManeuver('mnv-flyby-01');
    const snapPhase = runtime.getSnapshot();
    expect(snapPhase.navigation?.currentPhase).toBe('EUROPA_RECONNAISSANCE');

    // Trigger radar sounding reconnaissance scan
    const storageUsedBefore = snapPhase.storage.usedBytes;
    const scanResult = runtime.triggerReconnaissanceScan();

    expect(scanResult.success).toBe(true);
    expect(scanResult.bytesGenerated).toBeGreaterThan(0);

    const snapAfter = runtime.getSnapshot();
    expect(snapAfter.storage.usedBytes).toBeGreaterThan(storageUsedBefore);
    expect(snapAfter.navigation?.europaFlyby.reconnaissanceDataAcquired).toBe(true);

    // Verify science product was registered in the registry
    const scienceRegistry = runtime.getScienceManager().getDataRegistry();
    const l0Products = scienceRegistry.getAllLevel0();
    expect(l0Products.some((p) => p.instrument === 'REASON')).toBe(true);

    // Verify event was emitted
    const events = runtime.getMissionEvents();
    expect(events.some((e) => e.eventType === 'RECONNAISSANCE_DATA_ACQUIRED')).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Lander Deployment & Near-Vacuum Powered Descent                       */
  /* ------------------------------------------------------------------------ */
  it('deploys the lander asset and executes near-vacuum powered descent to soft touchdown', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-lander-test');

    // 1. Deploy Lander
    const deployResult = await runtime.executeNavigationManeuver('mnv-lander-deploy');
    expect(deployResult.success).toBe(true);
    expect(runtime.getSnapshot().navigation?.lander.flightState).toBe('DEPLOYED');

    const eventsDeploy = runtime.getMissionEvents();
    expect(eventsDeploy.some((e) => e.eventType === 'LANDER_DEPLOYMENT_COMPLETE')).toBe(true);

    // 2. Attempt Powered Descent before prerequisite authorization -> rejected!
    const unauthDescent = await runtime.executeNavigationManeuver('mnv-lander-descent');
    expect(unauthDescent.success).toBe(false);

    // Authorize Europa parking-orbit operational assumption via formal decision system (CRIT-01 & MAJ-04)
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

    runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });
    const scanResult = runtime.triggerReconnaissanceScan();
    expect(scanResult.success).toBe(true);

    const evalObj = runtime.getDecisionManager().getObjectiveEvaluator().getObjective('EXP-V-OBJ-01');
    expect(evalObj?.state).toBe('COMPLETED');

    const opt = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
    expect(opt).toBeDefined();
    runtime.proposeDecision(opt!.id);
    runtime.authorizeDecision(opt!.id, true);
    const authResult = await runtime.executeDecision(opt!.id);
    expect(authResult.success).toBe(true);

    // Now execute Powered Descent -> nominal touchdown
    const descentResult = await runtime.executeNavigationManeuver('mnv-lander-descent');
    expect(descentResult.success).toBe(true);

    const snapLanded = runtime.getSnapshot();
    expect(snapLanded.navigation?.lander.flightState).toBe('TOUCHDOWN');
    expect(snapLanded.navigation?.currentPhase).toBe('SURFACE_OPERATIONS');

    const eventsDescent = runtime.getMissionEvents();
    expect(eventsDescent.some((e) => e.eventType === 'LANDER_DESCENT_STARTED')).toBe(true);
    expect(eventsDescent.some((e) => e.eventType === 'LANDER_TOUCHDOWN')).toBe(true);
  });

  /* ------------------------------------------------------------------------ */
  /* 5. Campaign Stage Integration                                            */
  /* ------------------------------------------------------------------------ */
  it('satisfies Campaign Stage 8 (JUPITER_ARRIVAL) requirements via JOI execution', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-campaign-joi-test');
    const campaign = runtime.getCampaignManager();
    const sm = campaign.getStateMachine();

    // Advance state machine sequentially to JUPITER_ARRIVAL
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);
    sm.transitionTo('INTERPLANETARY_CRUISE', 70);
    sm.transitionTo('JUPITER_ARRIVAL', 80);

    expect(campaign.getCurrentStageId()).toBe('JUPITER_ARRIVAL');

    // Before JOI, stage cannot complete
    expect(campaign.canAdvanceToNextStage().canAdvance).toBe(false);

    // Execute JOI - triggers JUPITER_ORBIT_INSERTION_COMPLETE event
    await runtime.executeNavigationManeuver('mnv-joi-01');

    // Event bridge deterministically advances campaign to EUROPA_RECONNAISSANCE
    expect(campaign.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');
  });

  it('satisfies Campaign Stage 11 (LANDER_DEPLOYMENT) via touchdown event', async () => {
    const runtime = SimulationRuntime.getOrCreate('nav-campaign-lander-test');
    const campaign = runtime.getCampaignManager();
    const sm = campaign.getStateMachine();

    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);
    sm.transitionTo('INTERPLANETARY_CRUISE', 70);
    sm.transitionTo('JUPITER_ARRIVAL', 80);
    sm.transitionTo('EUROPA_RECONNAISSANCE', 90);
    runtime.getNavigationManager().restoreState({ currentPhase: 'EUROPA_RECONNAISSANCE' });
    // Execute genuine reconnaissance scan during reconnaissance stage
    const scanRes = runtime.triggerReconnaissanceScan();
    expect(scanRes.success).toBe(true);

    sm.transitionTo('SURFACE_MISSION_PREPARATION', 100);
    sm.transitionTo('LANDER_DEPLOYMENT', 110);

    expect(campaign.getCurrentStageId()).toBe('LANDER_DEPLOYMENT');

    // Deploy lander
    await runtime.executeNavigationManeuver('mnv-lander-deploy');

    // EXP-V-OBJ-01 was completed naturally via reconnaissance scan
    const evalObj = runtime.getDecisionManager().getObjectiveEvaluator().getObjective('EXP-V-OBJ-01');
    expect(evalObj?.state).toBe('COMPLETED');

    const opt = runtime.getAvailableDecisions().find((o) => o.id.startsWith('opt-authorize-parking-orbit'));
    expect(opt).toBeDefined();
    runtime.proposeDecision(opt!.id);
    runtime.authorizeDecision(opt!.id, true);
    await runtime.executeDecision(opt!.id);
    await runtime.executeNavigationManeuver('mnv-lander-descent');

    // Touchdown event deterministically advances campaign to SURFACE_OPERATIONS
    expect(campaign.getCurrentStageId()).toBe('SURFACE_OPERATIONS');
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Authoritative Save / Restore & Deterministic Replay                   */
  /* ------------------------------------------------------------------------ */
  it('serializes complete navigation state into snapshot and restores it without state divergence', async () => {
    const runtimeA = SimulationRuntime.getOrCreate('nav-save-a');

    // Execute TJI, JOI, and Europa flyby targeting on runtimeA
    await runtimeA.executeNavigationManeuver('mnv-tji-01');
    await runtimeA.executeNavigationManeuver('mnv-joi-01');
    await runtimeA.executeNavigationManeuver('mnv-flyby-01');
    const scanResult = runtimeA.triggerReconnaissanceScan();
    expect(scanResult.success).toBe(true);

    const snapshotA = runtimeA.exportSaveSnapshot();
    expect(snapshotA.navigation).toBeDefined();
    expect(snapshotA.navigation?.currentPhase).toBe('EUROPA_RECONNAISSANCE');
    expect(snapshotA.navigation?.centralBody).toBe('JUPITER');
    expect(snapshotA.navigation?.jupiterCapture.isCaptured).toBe(true);
    expect(snapshotA.navigation?.executedManeuvers.length).toBe(3);

    // Create fresh runtimeB and restore snapshotA
    const runtimeB = SimulationRuntime.getOrCreate('nav-save-b');
    runtimeB.restoreSaveSnapshot(snapshotA);

    const snapshotB = runtimeB.getSnapshot();
    expect(snapshotB.navigation?.currentPhase).toBe('EUROPA_RECONNAISSANCE');
    expect(snapshotB.navigation?.centralBody).toBe('JUPITER');
    expect(snapshotB.navigation?.jupiterCapture.isCaptured).toBe(true);
    expect(snapshotB.navigation?.executedManeuvers.length).toBe(3);
    expect(snapshotB.navigation?.europaFlyby.reconnaissanceDataAcquired).toBe(true);

    // Verify further actions continue deterministically from restored state
    const landerDeployRes = await runtimeB.executeNavigationManeuver('mnv-lander-deploy');
    expect(landerDeployRes.success).toBe(true);
    expect(runtimeB.getSnapshot().navigation?.lander.flightState).toBe('DEPLOYED');
  });

  it('supports backward-compatible restoration when navigation is absent from legacy save', () => {
    const runtime = SimulationRuntime.getOrCreate('nav-legacy-save-test');
    const fullSnapshot = runtime.exportSaveSnapshot();

    // Strip navigation state as if from Phase 6.4
    const { navigation, ...legacySnapshot } = fullSnapshot;
    expect((legacySnapshot as any).navigation).toBeUndefined();

    // Restoring legacy snapshot should succeed cleanly without crashing
    expect(() => runtime.restoreSaveSnapshot(legacySnapshot as any)).not.toThrow();
    const snap = runtime.getSnapshot();
    expect(snap.navigation).toBeDefined();
  });
});
