/**
 * SECTOR 17 — Europa Surface Mission, Anomaly & Campaign Completion Integration Test Suite (Phase 6.7.4 & 6.7.5)
 *
 * Verifies:
 * 1. Sequential Progression: Europa Reconnaissance -> Site Selection -> Lander Deployment -> Powered Descent ->
 *    Surface Exploration -> Science Acquisition -> Relay -> Earth Downlink -> Anomaly Investigation ->
 *    Authoritative Mission Scoring -> Debrief Archiving -> Campaign Completed.
 * 2. Surface Mission Guardrails and Constraint Enforcement.
 * 3. Deep-Space Communications, Downlink Queues & Signal Travel Time.
 * 4. Anomaly Decision Paths (analyze, sample, withdraw).
 * 5. Deterministic Scoring Algorithm & Multiple Ending Classifications.
 * 6. Save/Restore State Persistence across Debrief and Campaign Completion.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { COMPONENT_CATALOG, LAUNCH_VEHICLES } from '../src/data/missionsAndComponents';

describe('Phase 6.7.4 & 6.7.5: Surface Mission, Anomaly & Campaign End Integration', () => {
  const CAMPAIGN_ID = 'test-surface-campaign-end';

  /**
   * Helper that executes mission pipeline from launch up to Europa orbit/reconnaissance
   */
  async function setupToEuropaReconnaissance(runtime: SimulationRuntime) {
    runtime.acknowledgeBriefing();
    runtime.selectMission('europa-survey');
    runtime.setLaunchVehicle(LAUNCH_VEHICLES[1]); // Falcon Heavy
    runtime.setSpacecraftPart('propulsion', COMPONENT_CATALOG.propulsion[1]); // Bipropellant
    runtime.validateSpacecraftArchitecture();
    runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
    runtime.authorizeLaunch();
    await runtime.executeLaunchSequence();
    await runtime.executeNavigationManeuver('mnv-tji-01');
    await runtime.executeJupiterApproach();
    await runtime.executeNavigationManeuver('mnv-joi-01');
  }

  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    SimulationRuntime.resetAll();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Complete Campaign Progression: Recon -> Surface -> Anomaly -> Debrief  */
  /* -------------------------------------------------------------------------- */
  describe('1. Sequential Campaign Progression: Recon to Debrief & Completion', () => {
    it('executes full mission from Europa Reconnaissance to Campaign Completed', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      const campaign = runtime.getCampaignManager();

      // Setup to EUROPA_RECONNAISSANCE
      await setupToEuropaReconnaissance(runtime);
      expect(campaign.getCurrentStageId()).toBe('EUROPA_RECONNAISSANCE');

      // Step 1: Reconnaissance Scan & Target Area Confirmation
      const scan1 = runtime.triggerReconnaissanceScan();
      expect(scan1.success).toBe(true);
      expect(scan1.bytesGenerated).toBeGreaterThan(0);

      const reconResult = runtime.completeEuropaReconnaissance();
      expect(reconResult.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('SURFACE_MISSION_PREPARATION');

      // Step 2: Landing Site Selection & Parking Orbit
      const siteSelect = runtime.selectLandingSite('Pelagon Chaos');
      expect(siteSelect.success).toBe(true);
      expect(siteSelect.landingSite).toBe('Pelagon Chaos');

      const parkingResult = runtime.authorizeParkingOrbitAssumption();
      expect(parkingResult.success).toBe(true);

      // Step 3: Lander Deployment
      const deployResult = await runtime.executeLanderDeployment();
      expect(deployResult.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('LANDER_DEPLOYMENT');

      // Step 4: Powered Descent & Touchdown
      const descentResult = await runtime.executeLanderPoweredDescent();
      expect(descentResult.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('SURFACE_OPERATIONS');

      // Step 5: Surface Rover Deployment & Exploration
      const roverDeploy = runtime.deploySurfaceRover();
      expect(roverDeploy.success).toBe(true);

      // Rover starts at [4, 4]. Step adjacent to [4, 5]
      const traverse1 = runtime.executeRoverTraverse(4, 5);
      expect(traverse1.success).toBe(true);

      // Acquire surface science using valid instruments
      const drill = runtime.executeSurfaceScience('CRYO_DRILL');
      expect(drill.success).toBe(true);

      const cam = runtime.executeSurfaceScience('SURFACE_CAM');
      expect(cam.success).toBe(true);

      // Relay telemetry to orbiter and complete surface sampling phase
      const relayResult = runtime.transmitSurfaceDataToRelay();
      expect(relayResult.success).toBe(true);
      expect(relayResult.bytesUploaded).toBeGreaterThan(0);
      expect(campaign.getCurrentStageId()).toBe('ANOMALY_INVESTIGATION');

      // Step 6: Anomaly Decision
      const decisionRes = runtime.executeAnomalyDecision('analyze');
      expect(decisionRes.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('FINAL_DATA_TRANSMISSION');

      // Step 7: Final Data Transmission via DSN Downlink
      const queueRes = runtime.queueAllStoredScienceForDownlink();
      expect(queueRes.queuedCount).toBeGreaterThan(0);

      const dsnRes = runtime.executeDsnDownlinkStep(3600);
      expect(dsnRes.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('MISSION_EVALUATION');

      // Step 8: Mission Evaluation & Scoring
      const evalRes = runtime.evaluateMissionOutcome();
      expect(evalRes.success).toBe(true);
      expect(evalRes.report.finalScore).toBeGreaterThan(50);
      expect(['FULL_SUCCESS', 'PARTIAL_SUCCESS']).toContain(evalRes.report.outcome);
      expect(campaign.getCurrentStageId()).toBe('MISSION_DEBRIEF');

      // Step 9: Archive Debrief & Campaign Completion
      const archiveRes = runtime.archiveMissionDebrief();
      expect(archiveRes.success).toBe(true);
      expect(campaign.getCurrentStageId()).toBe('CAMPAIGN_COMPLETED');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Guardrails & Constraint Enforcement                                     */
  /* -------------------------------------------------------------------------- */
  describe('2. Surface Mission Guardrails', () => {
    it('rejects lander deployment before completing Europa reconnaissance', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await setupToEuropaReconnaissance(runtime);

      // Attempt deploy directly while in EUROPA_RECONNAISSANCE without selecting site
      const deployResult = await runtime.executeLanderDeployment();
      expect(deployResult.success).toBe(false);
      expect(deployResult.failureReason).toContain('reconnaissance');
    });

    it('rejects rover operations before lander has touched down', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await setupToEuropaReconnaissance(runtime);

      const roverRes = runtime.deploySurfaceRover();
      expect(roverRes.success).toBe(false);
      expect(roverRes.message).toContain('touchdown');

      const traverseRes = runtime.executeRoverTraverse(4, 5);
      expect(traverseRes.success).toBe(false);
    });

    it('rejects anomaly decisions before reaching ANOMALY_INVESTIGATION stage', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await setupToEuropaReconnaissance(runtime);

      expect(() => runtime.executeAnomalyDecision('analyze')).toThrow(/Cannot execute anomaly decision/);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Anomaly Decision Paths & Outcome Scoring                                */
  /* -------------------------------------------------------------------------- */
  describe('3. Anomaly Branches & Scoring Behavior', () => {
    it('accurately evaluates score and ending based on completed objectives', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await setupToEuropaReconnaissance(runtime);

      runtime.triggerReconnaissanceScan();
      runtime.completeEuropaReconnaissance();
      runtime.selectLandingSite('Pelagon Chaos');
      runtime.authorizeParkingOrbitAssumption();
      await runtime.executeLanderDeployment();
      await runtime.executeLanderPoweredDescent();
      runtime.deploySurfaceRover();
      runtime.executeRoverTraverse(4, 5);
      runtime.executeSurfaceScience('CRYO_DRILL');
      runtime.executeSurfaceScience('SURFACE_CAM');
      runtime.transmitSurfaceDataToRelay();

      // Test 'sample' branch
      const decisionRes = runtime.executeAnomalyDecision('sample');
      expect(decisionRes.success).toBe(true);
      expect(decisionRes.decision).toBe('sample');

      runtime.queueAllStoredScienceForDownlink();
      runtime.executeDsnDownlinkStep(3600);

      const evaluation = runtime.evaluateMissionOutcome();
      expect(evaluation.success).toBe(true);
      expect(evaluation.report.scientificValuePercent).toBeGreaterThan(0);
      expect(evaluation.report.anomalyDecision).toBe('sample');
      expect(evaluation.report.discoveries.some((d) => d.includes('Precursor alloy'))).toBe(true);
    });

    it('supports withdraw decision branch and awards prudent anomaly score', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await setupToEuropaReconnaissance(runtime);

      runtime.triggerReconnaissanceScan();
      runtime.completeEuropaReconnaissance();
      runtime.selectLandingSite('Pelagon Chaos');
      runtime.authorizeParkingOrbitAssumption();
      await runtime.executeLanderDeployment();
      await runtime.executeLanderPoweredDescent();
      runtime.deploySurfaceRover();
      runtime.executeSurfaceScience('CRYO_DRILL');
      runtime.transmitSurfaceDataToRelay();

      // Test 'withdraw' branch
      const decisionRes = runtime.executeAnomalyDecision('withdraw');
      expect(decisionRes.success).toBe(true);
      expect(decisionRes.decision).toBe('withdraw');

      runtime.queueAllStoredScienceForDownlink();
      runtime.executeDsnDownlinkStep(3600);

      const evaluation = runtime.evaluateMissionOutcome();
      expect(evaluation.success).toBe(true);
      expect(evaluation.report.anomalyDecision).toBe('withdraw');
      expect(evaluation.report.discoveries.some((d) => d.includes('safety perimeter'))).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. State Persistence & Debrief Archival                                    */
  /* -------------------------------------------------------------------------- */
  describe('4. Save/Restore Across Debrief & Completion', () => {
    it('serializes and restores mission evaluation report and campaign completed state', async () => {
      const runtime = new SimulationRuntime(CAMPAIGN_ID, { initialState: 'INITIALIZED' });
      await setupToEuropaReconnaissance(runtime);

      runtime.triggerReconnaissanceScan();
      runtime.completeEuropaReconnaissance();
      runtime.selectLandingSite('Pelagon Chaos');
      runtime.authorizeParkingOrbitAssumption();
      await runtime.executeLanderDeployment();
      await runtime.executeLanderPoweredDescent();
      runtime.deploySurfaceRover();
      runtime.executeSurfaceScience('CRYO_DRILL');
      runtime.transmitSurfaceDataToRelay();
      runtime.executeAnomalyDecision('analyze');
      runtime.queueAllStoredScienceForDownlink();
      runtime.executeDsnDownlinkStep(3600);
      runtime.evaluateMissionOutcome();
      runtime.archiveMissionDebrief();

      expect(runtime.getCampaignManager().getCurrentStageId()).toBe('CAMPAIGN_COMPLETED');

      // Save state
      const snapshot = runtime.exportSaveSnapshot();
      expect(snapshot.missionEvaluation).toBeDefined();
      expect(snapshot.missionEvaluation?.finalScore).toBeGreaterThan(0);
      expect(snapshot.campaign.currentStageId).toBe('CAMPAIGN_COMPLETED');

      // Restore to a new runtime
      const runtime2 = new SimulationRuntime('test-restored-campaign', { initialState: 'INITIALIZED' });
      runtime2.restoreSaveSnapshot(snapshot);

      expect(runtime2.getCampaignManager().getCurrentStageId()).toBe('CAMPAIGN_COMPLETED');
      const snap2 = runtime2.getSnapshot();
      expect(snap2.missionEvaluation).toBeDefined();
      expect(snap2.missionEvaluation?.finalScore).toBe(snapshot.missionEvaluation?.finalScore);
      expect(snap2.missionEvaluation?.outcome).toBe(snapshot.missionEvaluation?.outcome);
    });
  });
});
