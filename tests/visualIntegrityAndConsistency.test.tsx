/**
 * SECTOR 17 — Phase 7.2.1.1: Visual Integrity & Simulation Consistency Regression Tests
 *
 * Verifies:
 * 1. Mission Duration Consistency between Mission Selection and Trajectory Planner.
 * 2. Power Telemetry Consistency: Live metrics and architecture validation report are derived
 *    from the identical calculation (no discrepancy between telemetry numbers and warning banner).
 * 3. Decision Generation & Stage Gating: Pre-launch LAUNCH_AUTHORIZATION stage strictly omits
 *    in-flight Europa science surveys and surface lander descents; direct calls cannot bypass stage gates.
 * 4. Mission Maturity Indicator: Does not mark the mission "CERTIFIED" prematurely in the workshop.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import {
  calculateSpacecraftMetrics,
  evaluateSpacecraftConfiguration,
  getDefaultSpacecraftConfig,
} from '../src/simulation/engineering/spacecraftConfiguration';
import { calculatePowerBudget } from '../src/simulation/engineering/powerBudget';
import { calculateRealisticAethonTrajectory } from '../src/simulation/navigation/heliocentricTrajectory';
import { AVAILABLE_MISSIONS } from '../src/data/missionsAndComponents';

describe('Phase 7.2.1.1: Visual Integrity & Simulation Consistency Audit', () => {
  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    SimulationRuntime.resetAll();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Mission Duration Consistency                                            */
  /* -------------------------------------------------------------------------- */
  describe('1. Mission Duration Consistency', () => {
    it('aligns Mission Selection transit duration with authoritative heliocentric trajectory calculation', () => {
      const trajectory = calculateRealisticAethonTrajectory();
      expect(trajectory.transferTimeDays).toBe(1180);

      const europaMission = AVAILABLE_MISSIONS.find((m) => m.id === 'europa-survey');
      expect(europaMission).toBeDefined();

      // Must clearly specify 1,180 Days transit matching the astrodynamics model
      expect(europaMission?.estimatedDuration).toContain('1,180 Days');
      expect(europaMission?.estimatedDuration).toContain('Transit');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Power Telemetry Consistency Pipeline                                    */
  /* -------------------------------------------------------------------------- */
  describe('2. Power Telemetry Consistency Pipeline', () => {
    it('guarantees calculateSpacecraftMetrics and evaluateSpacecraftConfiguration use identical power figures', () => {
      const defaultCraft = getDefaultSpacecraftConfig();
      const metrics = calculateSpacecraftMetrics(defaultCraft);
      const validation = evaluateSpacecraftConfiguration(defaultCraft);

      // Verify generation and consumption match down to the decimal
      expect(metrics.totalPowerGenerationWatts).toBeCloseTo(3507.9, 1);
      expect(metrics.totalPowerConsumptionWatts).toBeCloseTo(3400.0, 1);
      expect(metrics.netPowerWatts).toBeCloseTo(107.9, 1);
      expect(metrics.powerReservePercent).toBeCloseTo(3.2, 1);

      // Verify validation warning quotes the EXACT same numbers as metrics
      const powerWarning = validation.warnings.find((w) => w.includes('Power reserve'));
      expect(powerWarning).toBeDefined();
      expect(powerWarning).toContain('3.2%');
      expect(powerWarning).toContain('107.9 W');
      expect(powerWarning).toContain('15%');

      // Verify shortfall calculation against configured 15% threshold
      expect(metrics.powerReserveThresholdPercent).toBe(15);
      const expectedShortfall = 3400.0 * 0.15 - 107.9; // ~402.1 W
      expect(metrics.powerReserveShortfallWatts).toBeCloseTo(expectedShortfall, 1);
    });

    it('SimulationRuntime.getSpacecraftMetrics returns identical power numbers to validateSpacecraftArchitecture', () => {
      const runtime = new SimulationRuntime('power-consistency-test');
      const metrics = runtime.getSpacecraftMetrics();
      const report = runtime.validateSpacecraftArchitecture();

      expect(metrics.netPowerWatts).toBeCloseTo(107.9, 1);
      expect(metrics.powerReservePercent).toBeCloseTo(3.2, 1);

      const warning = report.warnings.find((w) => w.includes('Power reserve'));
      expect(warning).toBeDefined();
      expect(warning).toContain(`${metrics.powerReservePercent.toFixed(1)}%`);
      expect(warning).toContain(`${metrics.netPowerWatts.toFixed(1)} W`);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Decision Generation & Stage Gating                                      */
  /* -------------------------------------------------------------------------- */
  describe('3. Decision Generation & Stage Gating', () => {
    it('strictly omits Europa science surveys and lander descents during LAUNCH_AUTHORIZATION stage', () => {
      const runtime = new SimulationRuntime('decision-gate-test');
      const sm = runtime.getCampaignManager().getStateMachine();
      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);
      sm.transitionTo('LAUNCH_AUTHORIZATION', 0);
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      expect(runtime.getSnapshot().campaign?.currentStageId).toBe('LAUNCH_AUTHORIZATION');
      expect(runtime.getSnapshot().flightState).toBe('INITIALIZED');
      expect(runtime.getSnapshot().metSeconds).toBe(0);

      const availableDecisions = runtime.getAvailableDecisions();
      const categories = availableDecisions.map((d) => d.category);

      // Must only contain launch authorization & safety hold, NOT in-flight Europa operations
      expect(categories).toContain('LAUNCH_AUTHORIZATION');
      expect(categories).toContain('ABORT_OR_SUSPEND');
      expect(categories).not.toContain('CONTINUE_INVESTIGATION');
      expect(categories).not.toContain('DEPLOY_LANDER');
      expect(categories).not.toContain('PRESERVE_SPACECRAFT');
      expect(availableDecisions.length).toBe(2);
    });

    it('prohibits direct authorization of DEPLOY_LANDER or CONTINUE_INVESTIGATION during pre-launch', () => {
      const runtime = new SimulationRuntime('direct-auth-gate-test');
      const sm = runtime.getCampaignManager().getStateMachine();
      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);
      sm.transitionTo('LAUNCH_AUTHORIZATION', 0);
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      const validator = (runtime as any).decisionManager.getValidator();
      const snap = (runtime as any).decisionManager.getEvidenceManager().getEngineeringSnapshot();

      // Test direct validation of premature lander descent
      const prematureLanderOption: any = {
        id: 'opt-premature-lander',
        category: 'DEPLOY_LANDER',
        title: 'Premature Lander Descent',
        resourceRequirements: { requiredSubsystems: ['LANDER_ROVER'] },
        riskAssessment: { hasHardConstraintViolation: false },
      };

      const result = validator.validate(
        prematureLanderOption,
        snap,
        (runtime as any).decisionManager.getObjectiveEvaluator(),
        0
      );

      expect(result.status).toBe('INFEASIBLE');
      expect(result.constraintViolations.some((c: string) => c.includes('Requires Europa reconnaissance'))).toBe(true);

      // Direct authorization through authorization engine must throw
      const authEngine = (runtime as any).decisionManager.getAuthorizationEngine();
      prematureLanderOption.validationResult = result;
      authEngine.propose(prematureLanderOption, 0);

      expect(() => authEngine.authorize(prematureLanderOption.id, true, 'Test Director', 0)).toThrow(
        /validation status 'INFEASIBLE'/
      );
    });

    it('does not display duplicate or stale candidate options once proposed or executed', () => {
      const runtime = new SimulationRuntime('stale-candidate-test');
      const sm = runtime.getCampaignManager().getStateMachine();
      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);
      sm.transitionTo('LAUNCH_AUTHORIZATION', 0);
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });

      const initialOptions = runtime.getAvailableDecisions();
      const launchOption = initialOptions.find((d) => d.category === 'LAUNCH_AUTHORIZATION');
      expect(launchOption).toBeDefined();

      // Propose launch authorization
      runtime.proposeDecision(launchOption!.id);

      // Once proposed, the option must not be returned in candidates list
      const afterProposal = runtime.getAvailableDecisions();
      expect(afterProposal.some((d) => d.id === launchOption!.id)).toBe(false);
      expect(afterProposal.some((d) => d.category === 'LAUNCH_AUTHORIZATION')).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Mission Maturity Indicator                                              */
  /* -------------------------------------------------------------------------- */
  describe('4. Mission Maturity Indicator Truthfulness', () => {
    it('does not claim CERTIFIED before flight readiness is officially certified', () => {
      const runtime = new SimulationRuntime('maturity-test');
      // Default spacecraft configuration has WARNING for power reserve < 15%
      const validation = runtime.validateSpacecraftArchitecture();
      expect(validation.overallStatus).toBe('WARNING');

      // But readiness has NOT been certified yet (player has not certified in Trajectory Planner)
      expect(runtime.getSnapshot().isReadinessCertified).toBe(false);

      // Once certified in trajectory planner (with acknowledged warning), readinessCertified becomes true
      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      expect(runtime.getSnapshot().isReadinessCertified).toBe(true);
    });
  });
});
