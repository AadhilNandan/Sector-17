/**
 * SECTOR 17 — Pre-Launch Integration & Campaign Gating Test Suite (Phase 6.7.2)
 *
 * Verifies end-to-end mission briefing, workshop architecture, physical metrics,
 * engineering validation, mission readiness certification, launch authorization Go/No-Go poll,
 * and flight software liftoff execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { COMPONENT_CATALOG, LAUNCH_VEHICLES, AVAILABLE_MISSIONS } from '../src/data/missionsAndComponents';
import {
  calculateSpacecraftMetrics,
  evaluateSpacecraftConfiguration,
  checkComponentIncompatibilities,
  validatePartNumericalValues,
  getDefaultSpacecraftConfig,
  EARTH_ORBIT_DISTANCE_AU,
  NOMINAL_EUROPA_DISTANCE_AU,
} from '../src/simulation/engineering/spacecraftConfiguration';
import type { SpacecraftPart, LaunchVehicle } from '../src/types/game';

describe('Phase 6.7.2: Pre-Launch Workflow & Campaign Integration', () => {
  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    SimulationRuntime.resetAll();
  });

  describe('1. Mission Briefing & Target Selection', () => {
    it('initializes runtime in prelaunch with default mission and stage CAMPAIGN_INTRO', () => {
      const runtime = new SimulationRuntime('test-prelaunch-intro', {
        initialState: 'INITIALIZED',
      });
      const snap = runtime.getSnapshot();

      expect(snap.flightState).toBe('INITIALIZED');
      expect(snap.campaign?.currentStageId).toBe('CAMPAIGN_INTRO');
      expect(snap.isReadinessCertified).toBe(false);
      expect(snap.isLaunchAuthorized).toBe(false);
      expect(snap.selectedMission?.id).toBe('europa-survey');
    });

    it('acknowledging briefing advances campaign stage to MISSION_SELECTION', () => {
      const runtime = new SimulationRuntime('test-briefing-ack', {
        initialState: 'INITIALIZED',
      });

      const res = runtime.acknowledgeBriefing();
      expect(res.success).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.campaign?.currentStageId).toBe('MISSION_SELECTION');
      expect(snap.campaign?.completedStageIds).toContain('CAMPAIGN_INTRO');
    });

    it('selecting unlocked mission sets target and advances stage to SPACECRAFT_DESIGN', () => {
      const runtime = new SimulationRuntime('test-mission-sel', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();

      const selRes = runtime.selectMission('europa-survey');
      expect(selRes.success).toBe(true);
      expect(selRes.mission.id).toBe('europa-survey');

      const snap = runtime.getSnapshot();
      expect(snap.selectedMissionId).toBe('europa-survey');
      expect(snap.campaign?.currentStageId).toBe('SPACECRAFT_DESIGN');
      expect(snap.campaign?.completedStageIds).toContain('MISSION_SELECTION');
    });

    it('rejects selecting locked or non-existent missions', () => {
      const runtime = new SimulationRuntime('test-locked-mission', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();

      expect(() => runtime.selectMission('titan-enigma')).toThrow(/locked/);
      expect(() => runtime.selectMission('invalid-target-xyz')).toThrow(/not found/);
    });
  });

  describe('2. Spacecraft Configuration & Engineering Validation Bridge', () => {
    it('provides valid default spacecraft configuration matching AETHON baseline specs', () => {
      const defaultConfig = getDefaultSpacecraftConfig();
      expect(defaultConfig.name).toContain('AETHON');
      expect(defaultConfig.parts.structure.name).toBe('Carbon-Composite Hex Truss');
      expect(defaultConfig.parts.propulsion.name).toBe('NEXT-C Xenon Ion Thruster');
      expect(defaultConfig.launchVehicle.name).toBe('Atlas V 551');

      const metrics = calculateSpacecraftMetrics(defaultConfig);
      expect(metrics.isWithinBudget).toBe(true);
      expect(metrics.isWithinPayloadCapacity).toBe(true);
      expect(metrics.totalDryMassKg).toBeGreaterThan(1500);
      expect(metrics.propellantCapacityKg).toBe(450.0);
      expect(metrics.deltaVMps).toBeGreaterThan(5000); // High ion ISP
    });

    it('rejects parts with invalid or negative mass, power, or cost budget', () => {
      const badPart: SpacecraftPart = {
        id: 'bad-part',
        name: 'Negative Mass Drive',
        category: 'propulsion',
        massKg: -50,
        powerKw: 1.0,
        costBudgetPercent: 10,
        description: 'Violates physical laws',
      };
      expect(() => validatePartNumericalValues(badPart)).toThrow(RangeError);

      const nanPart: SpacecraftPart = {
        ...badPart,
        massKg: 100,
        powerKw: NaN,
      };
      expect(() => validatePartNumericalValues(nanPart)).toThrow(TypeError);
    });

    it('detects over-budget configurations and flags failure in validation', () => {
      const config = getDefaultSpacecraftConfig();
      // Swap with high cost components
      const expensivePart: SpacecraftPart = {
        id: 'exp-inst',
        name: 'Quantum Hyper-Resonance Core',
        category: 'instruments',
        massKg: 400,
        powerKw: 1.5,
        costBudgetPercent: 85, // Total budget will exceed 100%
        description: 'Extremely costly prototype sensor',
      };

      const incomp = checkComponentIncompatibilities(
        { ...config.parts, instruments: expensivePart },
        config.launchVehicle
      );
      expect(incomp.some((msg) => msg.includes('budget exceeded'))).toBe(true);

      const report = evaluateSpacecraftConfiguration(
        { ...config.parts, instruments: expensivePart },
        config.launchVehicle
      );
      expect(report.overallStatus).toBe('FAIL');
      expect(report.failures.some((f) => f.includes('budget exceeded'))).toBe(true);
    });

    it('detects payload exceeding launch vehicle capacity', () => {
      const config = getDefaultSpacecraftConfig();
      // Atlas V 551 has maxPayloadKg = 3,800 kg. Bi-propellant adds 2,450 kg propellant.
      // Heavy bus + biprop can exceed 3,800 kg
      const heavyStructure: SpacecraftPart = {
        id: 'heavy-struct',
        name: 'Titanium Armored Shell',
        category: 'structure',
        massKg: 1600,
        powerKw: 0,
        costBudgetPercent: 15,
        description: 'Excessively heavy structure',
      };
      const biprop: SpacecraftPart = COMPONENT_CATALOG.propulsion[1]; // 2450 kg propellant

      const incomp = checkComponentIncompatibilities(
        { ...config.parts, structure: heavyStructure, propulsion: biprop },
        config.launchVehicle
      );
      expect(incomp.some((msg) => msg.includes('exceeds'))).toBe(true);
    });

    it('updates runtime spacecraft configuration and syncs propulsion capacity', () => {
      const runtime = new SimulationRuntime('test-workshop-update', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');

      const bipropPart = COMPONENT_CATALOG.propulsion[1]; // Hypergolic Bi-Propellant (2,450 kg)
      runtime.setSpacecraftPart('propulsion', bipropPart);

      const config = runtime.getSpacecraftConfig();
      expect(config.parts.propulsion.id).toBe(bipropPart.id);

      const metrics = runtime.getSpacecraftMetrics();
      expect(metrics.propellantCapacityKg).toBe(2450.0);

      const snap = runtime.getSnapshot();
      expect(snap.propellantCapacityKg).toBe(2450.0);
      expect(snap.propellantRemainingKg).toBe(2450.0);
    });

    it('evaluates distance-dependent solar array generation at 1.0 AU vs 5.204 AU while preserving RTG invariance', () => {
      const config = getDefaultSpacecraftConfig();

      // At Earth orbit (1.0 AU)
      const report1Au = evaluateSpacecraftConfiguration(config, undefined, EARTH_ORBIT_DISTANCE_AU);
      const metrics1Au = calculateSpacecraftMetrics(config, undefined, EARTH_ORBIT_DISTANCE_AU);
      expect(report1Au.overallStatus).toBe('PASS');
      expect(metrics1Au.totalPowerGenerationWatts).toBeGreaterThan(90000);

      // At Europa nominal orbit (5.204 AU)
      const report5Au = evaluateSpacecraftConfiguration(config, undefined, NOMINAL_EUROPA_DISTANCE_AU);
      const metrics5Au = calculateSpacecraftMetrics(config, undefined, NOMINAL_EUROPA_DISTANCE_AU);
      expect(report5Au.overallStatus).toBe('WARNING');
      expect(metrics5Au.totalPowerGenerationWatts).toBeLessThan(4000);
      expect(metrics5Au.totalPowerGenerationWatts).toBeGreaterThan(3400);

      // Verify inverse-square scaling ratio: (5.204 / 1.0)^2 ≈ 27.08
      const ratio = metrics1Au.totalPowerGenerationWatts / metrics5Au.totalPowerGenerationWatts;
      expect(ratio).toBeCloseTo(Math.pow(NOMINAL_EUROPA_DISTANCE_AU, 2), 1);

      // Verify RTG is distance-invariant
      const rtgPart = COMPONENT_CATALOG.power[1];
      const rtgConfig: SpacecraftConfig = {
        ...config,
        parts: { ...config.parts, power: rtgPart },
      };
      const rtgMetrics1Au = calculateSpacecraftMetrics(rtgConfig, undefined, EARTH_ORBIT_DISTANCE_AU);
      const rtgMetrics5Au = calculateSpacecraftMetrics(rtgConfig, undefined, NOMINAL_EUROPA_DISTANCE_AU);
      expect(rtgMetrics1Au.totalPowerGenerationWatts).toBe(2600);
      expect(rtgMetrics5Au.totalPowerGenerationWatts).toBe(2600);
    });

    it('validating architecture emits events and advances campaign to MISSION_READINESS', () => {
      const runtime = new SimulationRuntime('test-val-advance', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');

      expect(runtime.getSnapshot().campaign?.currentStageId).toBe('SPACECRAFT_DESIGN');

      const report = runtime.validateSpacecraftArchitecture();
      expect(report.overallStatus === 'PASS' || report.overallStatus === 'WARNING').toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.campaign?.currentStageId).toBe('MISSION_READINESS');
      expect(snap.campaign?.completedStageIds).toContain('SPACECRAFT_DESIGN');
      expect(snap.campaign?.completedStageIds).toContain('ENGINEERING_VALIDATION');
    });

    it('modifying component loadout rolls back campaign to SPACECRAFT_DESIGN and invalidates readiness', () => {
      const runtime = new SimulationRuntime('test-rollback-design', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      expect(runtime.getSnapshot().campaign?.currentStageId).toBe('LAUNCH_AUTHORIZATION');
      expect(runtime.getSnapshot().isReadinessCertified).toBe(true);

      // Re-editing a component at Stage 5
      const altPower = COMPONENT_CATALOG.power[1]; // RTG
      runtime.setSpacecraftPart('power', altPower);

      const snap = runtime.getSnapshot();
      expect(snap.campaign?.currentStageId).toBe('SPACECRAFT_DESIGN');
      expect(snap.isReadinessCertified).toBe(false);
      expect(snap.isLaunchAuthorized).toBe(false);
      expect(snap.validationReport).toBeUndefined();
    });
  });

  describe('3. Mission Flight Readiness Review', () => {
    it('certifying readiness succeeds when architecture is valid and no critical faults exist', () => {
      const runtime = new SimulationRuntime('test-readiness-cert', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();

      // First call requires warning acknowledgment when warnings exist
      const unackRes = runtime.certifyMissionReadiness();
      expect(unackRes.success).toBe(false);
      expect(unackRes.requiresWarningAcknowledgment).toBe(true);
      expect(unackRes.warnings && unackRes.warnings.length > 0).toBe(true);

      const certRes = runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      expect(certRes.success).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.isReadinessCertified).toBe(true);
      expect(snap.campaign?.currentStageId).toBe('LAUNCH_AUTHORIZATION');
      expect(snap.campaign?.completedStageIds).toContain('MISSION_READINESS');
    });

    it('rejects readiness certification if validation report is in FAIL status', () => {
      const runtime = new SimulationRuntime('test-readiness-fail', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');

      // Intentionally configure exceeding budget
      const overbudgetPart: SpacecraftPart = {
        id: 'ob-part',
        name: 'Overbudget Reactor',
        category: 'power',
        massKg: 500,
        powerKw: 5.0,
        costBudgetPercent: 80,
        description: 'Exceeds budget cap',
      };
      runtime.setSpacecraftPart('power', overbudgetPart);

      const certRes = runtime.certifyMissionReadiness();
      expect(certRes.success).toBe(false);
      expect(certRes.reasons?.some((r) => r.includes('Budget') || r.includes('FAIL'))).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.isReadinessCertified).toBe(false);
    });

    it('rejects readiness certification when critical subsystem faults are active', () => {
      const runtime = new SimulationRuntime('test-readiness-fault', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();

      // Inject critical avionics fault
      runtime.getFlightComputer().getFaultManager().raiseFault({
        id: 'fault-crit-eps',
        code: 'FLT-EPS-001',
        subsystemType: 'EPS',
        severity: 'CRITICAL',
        description: 'Main bus short circuit',
        detectedAtMETSeconds: 0,
        requiresSafeMode: false,
      });

      const certRes = runtime.certifyMissionReadiness();
      expect(certRes.success).toBe(false);
      expect(certRes.reasons?.some((r) => r.includes('critical faults'))).toBe(true);
    });
  });

  describe('4. Launch Authorization Go/No-Go Decision Gate', () => {
    it('generates LAUNCH_AUTHORIZATION candidate option only when readiness is certified', () => {
      const runtime = new SimulationRuntime('test-decision-opt-gen', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();

      // Before readiness certification
      let options = runtime.getAvailableDecisions();
      expect(options.some((o) => o.category === 'LAUNCH_AUTHORIZATION')).toBe(false);

      // After readiness certification
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      options = runtime.getAvailableDecisions();
      const launchOpt = options.find((o) => o.category === 'LAUNCH_AUTHORIZATION');
      expect(launchOpt).toBeDefined();
      expect(launchOpt?.title).toContain('Launch');
    });

    it('decision validator rejects LAUNCH_AUTHORIZATION if uncertified or in PRELAUNCH_HOLD', () => {
      const runtime = new SimulationRuntime('test-validator-reject', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      const options = runtime.getAvailableDecisions();
      const launchOpt = options.find((o) => o.category === 'LAUNCH_AUTHORIZATION')!;
      expect(launchOpt).toBeDefined();

      const evalReport = runtime.evaluateDecision(launchOpt.id);
      expect(evalReport.isFeasible).toBe(true);

      // Force vehicle into PRELAUNCH_HOLD
      runtime.getFlightComputer().getExecutionController().transitionTo(
        'PRELAUNCH_HOLD',
        runtime.getFlightComputer().getCurrentMETSeconds(),
        'Weather hold'
      );

      const holdReport = runtime.evaluateDecision(launchOpt.id);
      expect(holdReport.isFeasible).toBe(false);
      expect(holdReport.validationReasons.some((r) => r.includes('PRELAUNCH_HOLD'))).toBe(true);
    });

    it('proposing, approving, and executing LAUNCH_AUTHORIZATION decision transitions flight software to STANDBY and grants launch authorization', async () => {
      const runtime = new SimulationRuntime('test-decision-exec-flow', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      const options = runtime.getAvailableDecisions();
      const launchOpt = options.find((o) => o.category === 'LAUNCH_AUTHORIZATION')!;

      // 1. Propose decision
      const proposed = runtime.proposeDecision(launchOpt.id);
      expect(proposed.status).toBe('PROPOSED');

      // 2. Authorize decision
      const authorized = runtime.authorizeDecision(proposed.decisionId, true, 'Flight Director poll is GO');
      expect(authorized.status).toBe('APPROVED');

      // 3. Execute decision
      const execResult = await runtime.executeDecision(authorized.decisionId);
      expect(execResult.success).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.isLaunchAuthorized).toBe(true);
      expect(snap.flightState).toBe('STANDBY');
      expect(snap.campaign?.currentStageId).toBe('LAUNCH');
      expect(snap.campaign?.completedStageIds).toContain('LAUNCH_AUTHORIZATION');
    });

    it('authorizeLaunch() directly validates and transitions to STANDBY and Stage LAUNCH', () => {
      const runtime = new SimulationRuntime('test-direct-auth', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      const res = runtime.authorizeLaunch();
      expect(res.success).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.isLaunchAuthorized).toBe(true);
      expect(snap.flightState).toBe('STANDBY');
      expect(snap.campaign?.currentStageId).toBe('LAUNCH');
    });

    it('authorizeLaunch() is rejected when readiness has not been certified', () => {
      const runtime = new SimulationRuntime('test-direct-auth-reject', {
        initialState: 'INITIALIZED',
      });
      const res = runtime.authorizeLaunch();
      expect(res.success).toBe(false);
      expect(res.message).toContain('rejected');
    });
  });

  describe('5. Launch Execution & Liftoff Dynamics', () => {
    it('executeLaunchSequence() fails if launch authorization has not been granted', async () => {
      const runtime = new SimulationRuntime('test-launch-unauth', {
        initialState: 'INITIALIZED',
      });
      await expect(runtime.executeLaunchSequence()).rejects.toThrow(/Launch authorization has not been granted/);
    });

    it('executeLaunchSequence() fails if spacecraft is in PRELAUNCH_HOLD', async () => {
      const runtime = new SimulationRuntime('test-launch-hold', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      runtime.authorizeLaunch();

      runtime.getFlightComputer().getExecutionController().transitionTo(
        'PRELAUNCH_HOLD',
        0,
        'Range safety hold'
      );

      await expect(runtime.executeLaunchSequence()).rejects.toThrow(/PRELAUNCH_HOLD/);
    });

    it('successfully initiates liftoff: transitions to ACTIVE, burns ascent propellant, starts clock, and advances to INTERPLANETARY_CRUISE', async () => {
      const runtime = new SimulationRuntime('test-liftoff-success', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      runtime.authorizeLaunch();

      const initialProp = runtime.getSnapshot().propellantRemainingKg;

      const launchResult = await runtime.executeLaunchSequence();
      expect(launchResult.success).toBe(true);
      expect(launchResult.flightState).toBe('ACTIVE');
      expect(launchResult.propellantConsumedKg).toBeGreaterThan(0);

      const snap = runtime.getSnapshot();
      expect(snap.flightState).toBe('ACTIVE');
      expect(snap.propellantRemainingKg).toBeLessThan(initialProp);
      expect(snap.campaign?.currentStageId).toBe('INTERPLANETARY_CRUISE');
      expect(snap.campaign?.completedStageIds).toContain('LAUNCH');
      expect(snap.campaign?.completedStageIds).not.toContain('INTERPLANETARY_CRUISE');
      expect(runtime.getEventEngine().getTimeController().isRunning()).toBe(true);

      // CRIT-01: Liftoff emits LAUNCH_COMPLETE only; TJI must not be emitted unconditionally
      const processedTypes = runtime.getCampaignManager().getEventBridge().getProcessedEventTypes();
      expect(processedTypes.has('LAUNCH_COMPLETE')).toBe(true);
      expect(processedTypes.has('TRANS_JOVIAN_INJECTION_COMPLETE')).toBe(false);
    });

    it('rejects duplicate executeLaunchSequence() calls, preserves propellant, and avoids duplicate events', async () => {
      const runtime = new SimulationRuntime('test-launch-no-duplicate', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      runtime.authorizeLaunch();

      // First call succeeds
      const firstResult = await runtime.executeLaunchSequence();
      expect(firstResult.success).toBe(true);
      const propAfterFirst = runtime.getSnapshot().propellantRemainingKg;
      expect(runtime.getCampaignManager().getEventBridge().getProcessedEventTypes().has('LAUNCH_COMPLETE')).toBe(true);

      // Second call must reject
      await expect(runtime.executeLaunchSequence()).rejects.toThrow(
        /executeLaunchSequence: Spacecraft is already active in flight/
      );

      // Verify no additional propellant consumed
      const propAfterSecond = runtime.getSnapshot().propellantRemainingKg;
      expect(propAfterSecond).toBe(propAfterFirst);

      // Verify campaign progression is preserved
      expect(runtime.getSnapshot().campaign?.currentStageId).toBe('INTERPLANETARY_CRUISE');
    });

    it('aborts launch countdown, transitions to PRELAUNCH_HOLD, and records stage failure', () => {
      const runtime = new SimulationRuntime('test-launch-abort', {
        initialState: 'INITIALIZED',
      });
      runtime.acknowledgeBriefing();
      runtime.selectMission('europa-survey');
      runtime.validateSpacecraftArchitecture();
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      runtime.authorizeLaunch();

      const abortRes = runtime.abortLaunch('Fuel pump cavitating');
      expect(abortRes.success).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.isLaunchAuthorized).toBe(false);
      expect(snap.flightState).toBe('PRELAUNCH_HOLD');
      expect(snap.campaign?.currentStageStatus).toBe('FAILED');
      expect(snap.campaign?.failureReason).toContain('Fuel pump cavitating');
    });
  });

  describe('6. Save/Restore Persistence for Pre-Launch Workflow', () => {
    it('serializes and restores prelaunch state without state divergence', () => {
      const runtimeA = new SimulationRuntime('test-save-prelaunch-a', {
        initialState: 'INITIALIZED',
      });
      runtimeA.acknowledgeBriefing();
      runtimeA.selectMission('europa-survey');

      // Change propulsion part and select compatible heavy lift booster
      const biprop = COMPONENT_CATALOG.propulsion[1];
      runtimeA.setLaunchVehicle(LAUNCH_VEHICLES[1]); // Falcon Heavy (6200 kg capacity)
      runtimeA.setSpacecraftPart('propulsion', biprop);
      runtimeA.validateSpacecraftArchitecture();
      runtimeA.certifyMissionReadiness({ acknowledgeWarnings: true });
      runtimeA.authorizeLaunch();

      const savedState = runtimeA.exportSaveSnapshot();
      expect(savedState.prelaunch).toBeDefined();
      expect(savedState.prelaunch?.selectedMissionId).toBe('europa-survey');
      expect(savedState.prelaunch?.briefingAcknowledged).toBe(true);
      expect(savedState.prelaunch?.spacecraftConfig.parts.propulsion.id).toBe(biprop.id);
      expect(savedState.prelaunch?.isReadinessCertified).toBe(true);
      expect(savedState.prelaunch?.isLaunchAuthorized).toBe(true);

      runtimeA.dispose();

      // Restore into fresh runtime B
      const runtimeB = new SimulationRuntime('test-save-prelaunch-b', {
        initialState: 'INITIALIZED',
      });
      runtimeB.restoreSaveSnapshot(savedState);

      const snapB = runtimeB.getSnapshot();
      expect(snapB.selectedMissionId).toBe('europa-survey');
      expect(snapB.spacecraftConfig?.parts.propulsion.id).toBe(biprop.id);
      expect(snapB.isReadinessCertified).toBe(true);
      expect(snapB.isLaunchAuthorized).toBe(true);
      expect(snapB.flightState).toBe('STANDBY');
    });

    it('backward-compatible restore when prelaunch section is absent from legacy save', () => {
      const runtimeA = new SimulationRuntime('test-legacy-save-camp', {
        initialState: 'ACTIVE',
      });
      const legacySnapshot = runtimeA.exportSaveSnapshot();

      // Strip prelaunch key to simulate legacy save
      const { prelaunch, ...strippedSnapshot } = legacySnapshot as any;
      expect(strippedSnapshot.prelaunch).toBeUndefined();

      runtimeA.dispose();

      const runtimeB = new SimulationRuntime('test-legacy-restore-camp', {
        initialState: 'ACTIVE',
      });
      expect(() => runtimeB.restoreSaveSnapshot(strippedSnapshot)).not.toThrow();

      const snapB = runtimeB.getSnapshot();
      expect(snapB.selectedMissionId).toBe('europa-survey');
      expect(snapB.flightState).toBe('ACTIVE');
    });
  });
});
