/**
 * SECTOR 17 — Interplanetary Cruise & Jupiter Arrival Integration Test Suite (Phase 6.7.3)
 *
 * Verifies end-to-end playable cruise segment, separation of launch from TJI,
 * heliocentric trajectory propagation, TCM-1 execution, Jupiter Hill sphere ingress,
 * Jovian Orbit Insertion (JOI), campaign stage advancement to EUROPA_RECONNAISSANCE,
 * maneuver guards, and authoritative save/restore persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { CampaignManager } from '../src/campaign/campaignManager';
import { COMPONENT_CATALOG, LAUNCH_VEHICLES } from '../src/data/missionsAndComponents';
import type { PropulsionSubsystem } from '../src/simulation/flightSoftware/subsystems/propulsion';

describe('Phase 6.7.3: Interplanetary Cruise & Jupiter Arrival Integration', () => {
  const CAMPAIGN_ID = 'test-cruise-arrival-campaign';

  /**
   * Helper that sequentially executes valid campaign workflow up to liftoff:
   * CAMPAIGN_INTRO -> MISSION_SELECTION -> SPACECRAFT_DESIGN ->
   * ENGINEERING_VALIDATION -> MISSION_READINESS -> LAUNCH_AUTHORIZATION ->
   * LAUNCH -> INTERPLANETARY_CRUISE
   */
  async function launchToCruise(runtime: SimulationRuntime) {
    runtime.acknowledgeBriefing();
    runtime.selectMission('europa-survey');
    runtime.setLaunchVehicle(LAUNCH_VEHICLES[1]); // Falcon Heavy (6200 kg payload capacity)
    runtime.setSpacecraftPart('propulsion', COMPONENT_CATALOG.propulsion[1]); // Bipropellant (2450 kg)
    runtime.validateSpacecraftArchitecture();
    runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
    runtime.authorizeLaunch();
    await runtime.executeLaunchSequence();
  }

  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    SimulationRuntime.resetAll();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Complete Campaign Progression: Liftoff to Jovian Orbit Insertion       */
  /* -------------------------------------------------------------------------- */
  describe('1. Sequential Progression: Launch -> Cruise -> TJI -> TCM -> Arrival -> JOI', () => {
    it('executes full mission pipeline from pre-launch to Jovian Orbit Insertion and Europa Reconnaissance', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      const campaign = runtime.getCampaignManager();

      // Step A: Briefing & Selection
      expect(campaign.getCurrentStageId()).toBe('CAMPAIGN_INTRO');
      runtime.acknowledgeBriefing();
      expect(campaign.getCurrentStageId()).toBe('MISSION_SELECTION');

      runtime.selectMission('europa-survey');
      expect(campaign.getCurrentStageId()).toBe('SPACECRAFT_DESIGN');

      // Step B: Architecture & Certification
      runtime.setLaunchVehicle(LAUNCH_VEHICLES[1]);
      runtime.setSpacecraftPart('propulsion', COMPONENT_CATALOG.propulsion[1]);
      const valReport = runtime.validateSpacecraftArchitecture();
      expect(['PASS', 'WARNING']).toContain(valReport.overallStatus);

      const certResult = runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      expect(certResult.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('LAUNCH_AUTHORIZATION');

      // Step C: Launch Authorization & Go Poll
      const authDecision = runtime.getSnapshot().availableDecisions.find(
        (d) => d.category === 'LAUNCH_AUTHORIZATION'
      );
      expect(authDecision).toBeDefined();

      const authRes = runtime.authorizeLaunch();
      expect(authRes.success).toBe(true);
      expect(runtime.getSnapshot().isLaunchAuthorized).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('LAUNCH');

      // Step D: Liftoff Sequence
      const launchResult = await runtime.executeLaunchSequence();
      expect(launchResult.success).toBe(true);

      // Verify Launch semantics: liftoff succeeded, initial post-launch state, TJI NOT yet performed
      const postLaunchSnap = runtime.getSnapshot();
      expect(postLaunchSnap.flightState).toBe('ACTIVE');
      expect(postLaunchSnap.campaign?.currentStageId).toBe('INTERPLANETARY_CRUISE');
      expect(postLaunchSnap.navigation?.currentPhase).toBe('PRE_LAUNCH');
      expect(postLaunchSnap.navigation?.centralBody).toBe('EARTH');

      const eventTypes = campaign.getEventBridge().getProcessedEventTypes();
      expect(eventTypes.has('LAUNCH_COMPLETE')).toBe(true);
      expect(eventTypes.has('TRANS_JOVIAN_INJECTION_COMPLETE')).toBe(false);

      // Step E: Execute Trans-Jovian Injection (TJI)
      const tjiReport = runtime.validateNavigationManeuver('mnv-tji-01');
      expect(tjiReport.isFeasible).toBe(true);
      expect(tjiReport.status).toBe('PASS');

      const tjiResult = await runtime.executeNavigationManeuver('mnv-tji-01');
      expect(tjiResult.success).toBe(true);
      expect(tjiResult.maneuverType).toBe('TRANS_JOVIAN_INJECTION');

      // Spacecraft should now be in heliocentric cruise orbiting the Sun
      const postTjiSnap = runtime.getSnapshot();
      expect(postTjiSnap.navigation?.currentPhase).toBe('HELIOCENTRIC_CRUISE');
      expect(postTjiSnap.navigation?.centralBody).toBe('SUN');
      expect(campaign.getCurrentStageId()).toBe('INTERPLANETARY_CRUISE');
      expect(campaign.getEventBridge().getProcessedEventTypes().has('TRANS_JOVIAN_INJECTION_COMPLETE')).toBe(true);

      // Step F: Execute Midcourse Correction (TCM-1)
      const tcmReport = runtime.validateNavigationManeuver('mnv-tcm-01');
      expect(tcmReport.isFeasible).toBe(true);
      expect(tcmReport.requiredDeltaVMps).toBe(24.5);

      const tcmResult = await runtime.executeNavigationManeuver('mnv-tcm-01');
      expect(tcmResult.success).toBe(true);
      expect(tcmResult.maneuverType).toBe('MIDCOURSE_CORRECTION');
      expect(tcmResult.propellantConsumedKg).toBeGreaterThan(10);
      expect(campaign.getEventBridge().getProcessedEventTypes().has('MIDCOURSE_CORRECTION_COMPLETE')).toBe(true);

      // Step G: Jupiter Hill Sphere Ingress & Approach
      const approachReport = runtime.validateNavigationManeuver('mnv-approach-01');
      expect(approachReport.isFeasible).toBe(true);

      const approachResult = await runtime.executeJupiterApproach();
      expect(approachResult.success).toBe(true);
      expect(approachResult.maneuverType).toBe('JUPITER_APPROACH');

      // Verifies Jupiter arrival transition
      const postApproachSnap = runtime.getSnapshot();
      expect(postApproachSnap.navigation?.currentPhase).toBe('JUPITER_APPROACH');
      expect(postApproachSnap.navigation?.centralBody).toBe('JUPITER');
      expect(campaign.getCurrentStageId()).toBe('JUPITER_ARRIVAL');
      expect(campaign.getEventBridge().getProcessedEventTypes().has('JUPITER_ARRIVAL')).toBe(true);

      // Step H: Jupiter Orbit Insertion (JOI)
      const joiReport = runtime.validateNavigationManeuver('mnv-joi-01');
      expect(joiReport.isFeasible).toBe(true);
      expect(joiReport.requiredDeltaVMps).toBeGreaterThan(800.0);

      const joiResult = await runtime.executeNavigationManeuver('mnv-joi-01');
      expect(joiResult.success).toBe(true);
      expect(joiResult.maneuverType).toBe('JUPITER_ORBIT_INSERTION');
      expect(joiResult.propellantConsumedKg).toBeGreaterThan(500); // ~586 kg

      // Verifies capture into Jovian tour orbit and stage advancement to EUROPA_RECONNAISSANCE
      const postJoiSnap = runtime.getSnapshot();
      expect(postJoiSnap.navigation?.currentPhase).toBe('JOVIAN_ORBIT');
      expect(postJoiSnap.navigation?.centralBody).toBe('JUPITER');
      expect(postJoiSnap.navigation?.jupiterCapture.isCaptured).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');
      expect(campaign.getEventBridge().getProcessedEventTypes().has('JUPITER_ORBIT_INSERTION_COMPLETE')).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Maneuver Preconditions, Constraints & Guardrails                        */
  /* -------------------------------------------------------------------------- */
  describe('2. Maneuver Constraints & Boundary Guardrails', () => {
    it('prevents duplicate execution of Trans-Jovian Injection', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);

      // First execution succeeds
      const firstResult = await runtime.executeNavigationManeuver('mnv-tji-01');
      expect(firstResult.success).toBe(true);

      // Second execution is rejected
      const secondValidation = runtime.validateNavigationManeuver('mnv-tji-01');
      expect(secondValidation.isFeasible).toBe(false);
      expect(secondValidation.status).toBe('WARNING');
      expect(secondValidation.reasons[0]).toContain('already been executed');

      const secondResult = await runtime.executeNavigationManeuver('mnv-tji-01');
      expect(secondResult.success).toBe(false);
      expect(secondResult.failureReason).toContain('already been executed');
    });

    it('rejects Trans-Jovian Injection if propellant is below 15 kg minimum reserve', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, {
        initialState: 'INITIALIZED',
        initialPropellantKg: 10.0,
      });
      // Bypass directly to active without burning all propellant
      runtime.authorizeLaunch();
      (runtime.getFlightComputer().getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem)
        .setPropellantRemainingKg(10.0);

      const report = runtime.validateNavigationManeuver('mnv-tji-01');
      expect(report.isFeasible).toBe(false);
      expect(report.status).toBe('FAIL');
      expect(report.reasons.some((r) => r.includes('Insufficient propellant'))).toBe(true);

      const result = await runtime.executeNavigationManeuver('mnv-tji-01');
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('Insufficient propellant');
    });

    it('prevents duplicate execution of Midcourse Correction (TCM-1)', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      await runtime.executeNavigationManeuver('mnv-tji-01');

      // First TCM succeeds
      const tcm1 = await runtime.executeNavigationManeuver('mnv-tcm-01');
      expect(tcm1.success).toBe(true);

      // Second TCM validation fails
      const report = runtime.validateNavigationManeuver('mnv-tcm-01');
      expect(report.isFeasible).toBe(false);
      expect(report.status).toBe('WARNING');

      const tcm2 = await runtime.executeNavigationManeuver('mnv-tcm-01');
      expect(tcm2.success).toBe(false);
      expect(tcm2.failureReason).toContain('already been executed');
    });

    it('rejects Jupiter Approach if Trans-Jovian Injection was never completed', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);

      // In Earth parking orbit / pre-launch without TJI
      expect(runtime.getSnapshot().navigation?.currentPhase).toBe('PRE_LAUNCH');

      const report = runtime.validateNavigationManeuver('mnv-approach-01');
      expect(report.isFeasible).toBe(false);
      expect(report.status).toBe('FAIL');
      expect(report.reasons.some((r) => r.includes('Trans-Jovian Injection (TJI) has not been completed'))).toBe(true);

      const result = await runtime.executeJupiterApproach();
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('Trans-Jovian Injection (TJI) has not been completed');
    });

    it('rejects Jovian Orbit Insertion when propulsion isolation valves are closed in SAFE mode', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      await runtime.executeNavigationManeuver('mnv-tji-01');
      await runtime.executeJupiterApproach();

      // Put propulsion subsystem into SAFE mode with valves isolated
      const propSub = runtime.getFlightComputer().getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
      propSub.toSafeMode();
      expect(propSub.areValvesIsolated()).toBe(true);

      const report = runtime.validateNavigationManeuver('mnv-joi-01');
      expect(report.isFeasible).toBe(false);
      expect(report.reasons.some((r) => r.includes('isolated') || r.includes('closed'))).toBe(true);

      const result = await runtime.executeNavigationManeuver('mnv-joi-01');
      expect(result.success).toBe(false);
      expect(result.failureReason).toMatch(/closed|isolated/i);
    });

    it('rejects Jovian Orbit Insertion when propellant is insufficient for 885 m/s delta-V', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      await runtime.executeNavigationManeuver('mnv-tji-01');
      await runtime.executeJupiterApproach();

      // Deplete propellant to 200 kg (insufficient for 885 m/s, which requires ~586 kg)
      const propSub = runtime.getFlightComputer().getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
      propSub.setPropellantRemainingKg(200.0);

      const report = runtime.validateNavigationManeuver('mnv-joi-01');
      expect(report.isFeasible).toBe(false);
      expect(report.reasons.some((r) => r.includes('Insufficient propellant') || r.includes('deficit'))).toBe(true);

      const result = await runtime.executeNavigationManeuver('mnv-joi-01');
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('Insufficient propellant');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Cruise Telemetry, Physics & Coordinates                                 */
  /* -------------------------------------------------------------------------- */
  describe('3. Telemetry, Coordinate Frames & Physical Scalings', () => {
    it('accurately transitions coordinate frames from Earth -> Sun -> Jupiter', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      const navManager = runtime.getNavigationManager();

      // 1. Initial post-launch: Earth
      expect(navManager.getCurrentPhase()).toBe('PRE_LAUNCH');
      expect(runtime.getSnapshot().navigation?.centralBody).toBe('EARTH');

      // 2. Post-TJI: Heliocentric Sun frame
      await runtime.executeNavigationManeuver('mnv-tji-01');
      expect(navManager.getCurrentPhase()).toBe('HELIOCENTRIC_CRUISE');
      expect(runtime.getSnapshot().navigation?.centralBody).toBe('SUN');

      // 3. Post-Approach: Jovian system frame
      await runtime.executeJupiterApproach();
      expect(navManager.getCurrentPhase()).toBe('JUPITER_APPROACH');
      expect(runtime.getSnapshot().navigation?.centralBody).toBe('JUPITER');

      // 4. Post-JOI: Captured Jovian orbit
      await runtime.executeNavigationManeuver('mnv-joi-01');
      expect(navManager.getCurrentPhase()).toBe('JOVIAN_ORBIT');
      expect(runtime.getSnapshot().navigation?.centralBody).toBe('JUPITER');
    });

    it('accurately tracks cumulative delta-V and propellant consumption across burns', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      const initialProp = runtime.getSnapshot().propellantRemainingKg;

      // Burn 1: TJI
      const tji = await runtime.executeNavigationManeuver('mnv-tji-01');
      expect(tji.success).toBe(true);
      const afterTjiProp = runtime.getSnapshot().propellantRemainingKg;
      expect(afterTjiProp).toBeCloseTo(initialProp - 15.0, 1);

      // Burn 2: TCM-1
      const tcm = await runtime.executeNavigationManeuver('mnv-tcm-01');
      expect(tcm.success).toBe(true);
      const afterTcmProp = runtime.getSnapshot().propellantRemainingKg;
      expect(afterTcmProp).toBeLessThan(afterTjiProp - 10.0);

      // Approach: 0 delta-V
      const approach = await runtime.executeJupiterApproach();
      expect(approach.success).toBe(true);
      const afterApproachProp = runtime.getSnapshot().propellantRemainingKg;
      expect(afterApproachProp).toBeCloseTo(afterTcmProp, 1);

      // Burn 3: JOI
      const joi = await runtime.executeNavigationManeuver('mnv-joi-01');
      expect(joi.success).toBe(true);
      const afterJoiProp = runtime.getSnapshot().propellantRemainingKg;
      expect(afterJoiProp).toBeLessThan(afterApproachProp - 500.0);

      const navSnapshot = runtime.getSnapshot().navigation!;
      expect(navSnapshot.totalDeltaVExpendedMps).toBeCloseTo(3950 + 24.5 + 885, 0);
      expect(navSnapshot.totalPropellantBurnedKg).toBeCloseTo(initialProp - afterJoiProp, 1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Save/Restore Across Cruise and Arrival Stages                            */
  /* -------------------------------------------------------------------------- */
  describe('4. Authoritative State Persistence across Cruise & Arrival', () => {
    it('serializes and deserializes cruise state preserving heliocentric trajectory and maneuver history', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      const campaign = runtime.getCampaignManager();

      // Advance to cruise and execute TJI and TCM-1
      await runtime.executeNavigationManeuver('mnv-tji-01');
      await runtime.executeNavigationManeuver('mnv-tcm-01');

      const preSaveSnap = runtime.getSnapshot();
      expect(preSaveSnap.navigation?.currentPhase).toBe('HELIOCENTRIC_CRUISE');
      expect(preSaveSnap.navigation?.centralBody).toBe('SUN');
      expect(preSaveSnap.navigation?.executedManeuvers.length).toBe(2);

      // Save campaign state
      const saveOk = await campaign.save();
      expect(saveOk).toBe(true);

      // Mutate runtime: execute approach
      await runtime.executeJupiterApproach();
      expect(runtime.getSnapshot().navigation?.currentPhase).toBe('JUPITER_APPROACH');

      // Load back saved checkpoint
      const loadOk = await campaign.load();
      expect(loadOk).toBe(true);

      // Verify restored cruise state
      const restoredSnap = runtime.getSnapshot();
      expect(restoredSnap.navigation?.currentPhase).toBe('HELIOCENTRIC_CRUISE');
      expect(restoredSnap.navigation?.centralBody).toBe('SUN');
      expect(restoredSnap.navigation?.executedManeuvers.length).toBe(2);
      expect(restoredSnap.campaign?.currentStageId).toBe('INTERPLANETARY_CRUISE');

      // TJI and TCM should still be marked executed
      const restoredTji = runtime.validateNavigationManeuver('mnv-tji-01');
      expect(restoredTji.isFeasible).toBe(false);
      expect(restoredTji.reasons[0]).toContain('already been executed');
    });

    it('serializes and deserializes captured Jovian orbit state after JOI', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      const campaign = runtime.getCampaignManager();

      await runtime.executeNavigationManeuver('mnv-tji-01');
      await runtime.executeJupiterApproach();
      await runtime.executeNavigationManeuver('mnv-joi-01');

      expect(campaign.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');
      expect(runtime.getSnapshot().navigation?.jupiterCapture.isCaptured).toBe(true);

      // Save campaign state at Jovian orbit
      const saveOk = await campaign.save();
      expect(saveOk).toBe(true);
      const persistence = campaign.getPersistence();

      // Create fresh runtime and load using the same persistence
      SimulationRuntime.resetAll();
      const freshRuntime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      const freshCampaign = new CampaignManager({
        campaignId: CAMPAIGN_ID,
        runtime: freshRuntime,
        persistence,
      });

      const loadOk = await freshCampaign.load();
      expect(loadOk).toBe(true);

      const restoredSnap = freshRuntime.getSnapshot();
      expect(restoredSnap.flightState).toBe('ACTIVE');
      expect(restoredSnap.navigation?.currentPhase).toBe('JOVIAN_ORBIT');
      expect(restoredSnap.navigation?.centralBody).toBe('JUPITER');
      expect(restoredSnap.navigation?.jupiterCapture.isCaptured).toBe(true);
      expect(freshCampaign.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Stage Gating and Non-Bypassable Milestones                               */
  /* -------------------------------------------------------------------------- */
  describe('5. Campaign Gating & Milestone Verification', () => {
    it('blocks advancing from INTERPLANETARY_CRUISE to JUPITER_ARRIVAL without JUPITER_ARRIVAL event', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      const campaign = runtime.getCampaignManager();

      expect(campaign.getCurrentStageId()).toBe('INTERPLANETARY_CRUISE');

      // Attempting to advance without arrival event is blocked
      const canAdvance = campaign.canAdvanceToNextStage();
      expect(canAdvance.canAdvance).toBe(false);
      expect(canAdvance.reasons.some((b) => b.includes('cruise in progress') || b.includes('Jupiter') || b.includes('ingress'))).toBe(true);

      // Now emit arrival event
      campaign.getEventBridge().processEvent({
        id: 'evt-arr-01',
        type: 'JUPITER_ARRIVAL',
        timestamp: 200,
        metSeconds: 200,
        data: {},
      }, 200);

      expect(campaign.getCurrentStageId()).toBe('JUPITER_ARRIVAL');
    });

    it('blocks advancing from JUPITER_ARRIVAL to EUROPA_RECONNAISSANCE without JOI completion', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await launchToCruise(runtime);
      const campaign = runtime.getCampaignManager();

      // Advance to arrival
      campaign.getEventBridge().processEvent({
        id: 'evt-arr-01',
        type: 'JUPITER_ARRIVAL',
        timestamp: 200,
        metSeconds: 200,
        data: {},
      }, 200);

      expect(campaign.getCurrentStageId()).toBe('JUPITER_ARRIVAL');

      // Attempting to advance without JOI is blocked
      const canAdvance = campaign.canAdvanceToNextStage();
      expect(canAdvance.canAdvance).toBe(false);
      expect(canAdvance.reasons.some((b) => b.includes('Jupiter Orbit Insertion'))).toBe(true);

      // Emit JOI event
      campaign.getEventBridge().processEvent({
        id: 'evt-joi-01',
        type: 'JUPITER_ORBIT_INSERTION_COMPLETE',
        timestamp: 300,
        metSeconds: 300,
        data: {},
      }, 300);

      expect(campaign.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');
    });
  });
});
