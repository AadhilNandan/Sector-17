import { describe, it, expect } from 'vitest';
import { stepVerificationEngine } from '../src/features/tutorial/services/stepVerificationEngine';
import type { VerificationContext } from '../src/features/tutorial/types';
import type { SimulationSnapshot } from '../src/runtime/types';

describe('Phase 9.1.2: Step Verification Engine', () => {
  const createMockSnapshot = (overrides?: Partial<SimulationSnapshot>): SimulationSnapshot => {
    return {
      metSeconds: 15811200,
      flightState: 'STANDBY',
      briefingAcknowledged: true,
      isReadinessCertified: false,
      isLaunchAuthorized: false,
      subsystems: {},
      recentEvents: [],
      objectives: [],
      availableDecisions: [],
      scienceProducts: { totalCount: 0, byInstrument: { REASON: [], MASPEX: [] }, anomalyReports: [] },
      recentObservations: [],
      storage: { capacityBytes: 64e9, usedBytes: 0, packetCount: 0, utilizationPercent: 0 },
      communications: { isWindowActive: true, currentStation: null, signalDelaySeconds: 0, snrDb: 25, queueUtilizationPercent: 0 },
      faults: { activeCount: 0, activeFaults: [], requiresUserAcknowledgement: false },
      campaign: {
        campaignId: 'EXPEDITION-V',
        currentStageId: 'SPACECRAFT_DESIGN',
        status: 'ACTIVE',
        completedStageIds: ['CAMPAIGN_INTRO', 'MISSION_SELECTION'],
        isCampaignCompleted: false,
        isCampaignFailed: false,
        activeBlockers: [],
      },
      validationReport: {
        overallStatus: 'PASS',
        massMarginKg: 450,
        powerMarginPercent: 22,
        failures: [],
        warnings: [],
      },
      ...overrides,
    } as unknown as SimulationSnapshot;
  };

  it('1. USER_ACKNOWLEDGEMENT verifies with manual advancement flag', () => {
    const ctx: VerificationContext = {
      snapshot: createMockSnapshot(),
      currentRoute: '/',
    };

    const res = stepVerificationEngine.evaluate({ type: 'USER_ACKNOWLEDGEMENT' }, ctx);
    expect(res.verified).toBe(true);
    expect(res.autoAdvance).toBe(false);
  });

  it('2. ROUTE_MATCH verifies when current route matches expected route', () => {
    const ctxMatch: VerificationContext = {
      snapshot: createMockSnapshot(),
      currentRoute: '/workshop',
    };
    const ctxMismatch: VerificationContext = {
      snapshot: createMockSnapshot(),
      currentRoute: '/',
    };

    const resMatch = stepVerificationEngine.evaluate({ type: 'ROUTE_MATCH', expectedRoute: '/workshop' }, ctxMatch);
    expect(resMatch.verified).toBe(true);
    expect(resMatch.autoAdvance).toBe(true);

    const resMismatch = stepVerificationEngine.evaluate({ type: 'ROUTE_MATCH', expectedRoute: '/workshop' }, ctxMismatch);
    expect(resMismatch.verified).toBe(false);
    expect(resMismatch.recoveryHint).toContain('/workshop');
  });

  it('3. CAMPAIGN_STAGE verifies exact and later stage allowance', () => {
    const ctx: VerificationContext = {
      snapshot: createMockSnapshot({
        campaign: {
          campaignId: 'EXPEDITION-V',
          currentStageId: 'MISSION_READINESS',
          status: 'ACTIVE',
          completedStageIds: ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION'],
          isCampaignCompleted: false,
          isCampaignFailed: false,
          activeBlockers: [],
        },
      }),
      currentRoute: '/trajectory',
    };

    // Exact stage match
    const resExact = stepVerificationEngine.evaluate(
      { type: 'CAMPAIGN_STAGE', expectedStageId: 'MISSION_READINESS' },
      ctx
    );
    expect(resExact.verified).toBe(true);

    // Later stage allowed: expecting SPACECRAFT_DESIGN (step 2) when at MISSION_READINESS (step 4)
    const resLaterAllowed = stepVerificationEngine.evaluate(
      { type: 'CAMPAIGN_STAGE', expectedStageId: 'SPACECRAFT_DESIGN', allowLaterStages: true },
      ctx
    );
    expect(resLaterAllowed.verified).toBe(true);

    // Later stage not allowed: expecting SPACECRAFT_DESIGN strictly
    const resLaterBlocked = stepVerificationEngine.evaluate(
      { type: 'CAMPAIGN_STAGE', expectedStageId: 'SPACECRAFT_DESIGN', allowLaterStages: false },
      ctx
    );
    expect(resLaterBlocked.verified).toBe(false);
  });

  it('4. SNAPSHOT_BOOLEAN verifies boolean flags accurately', () => {
    const ctxUnauth: VerificationContext = {
      snapshot: createMockSnapshot({ isLaunchAuthorized: false }),
      currentRoute: '/trajectory',
    };
    const ctxAuth: VerificationContext = {
      snapshot: createMockSnapshot({ isLaunchAuthorized: true }),
      currentRoute: '/trajectory',
    };

    const resUnauth = stepVerificationEngine.evaluate(
      { type: 'SNAPSHOT_BOOLEAN', property: 'isLaunchAuthorized', expectedValue: true },
      ctxUnauth
    );
    expect(resUnauth.verified).toBe(false);

    const resAuth = stepVerificationEngine.evaluate(
      { type: 'SNAPSHOT_BOOLEAN', property: 'isLaunchAuthorized', expectedValue: true },
      ctxAuth
    );
    expect(resAuth.verified).toBe(true);
  });

  it('5. CONFIGURATION_STATUS checks PASS and WARNING permissions', () => {
    const ctxPass: VerificationContext = {
      snapshot: createMockSnapshot({
        validationReport: { overallStatus: 'PASS', failures: [] } as any,
      }),
      currentRoute: '/workshop',
    };
    const ctxWarn: VerificationContext = {
      snapshot: createMockSnapshot({
        validationReport: { overallStatus: 'WARNING', failures: [], warnings: ['Power reserve low'] } as any,
      }),
      currentRoute: '/workshop',
    };
    const ctxFail: VerificationContext = {
      snapshot: createMockSnapshot({
        validationReport: { overallStatus: 'FAIL', failures: ['Over mass limit'] } as any,
      }),
      currentRoute: '/workshop',
    };

    const condition = { type: 'CONFIGURATION_STATUS' as const, allowedStatuses: ['PASS', 'WARNING'] as const };

    expect(stepVerificationEngine.evaluate(condition, ctxPass).verified).toBe(true);
    expect(stepVerificationEngine.evaluate(condition, ctxWarn).verified).toBe(true);
    const failRes = stepVerificationEngine.evaluate(condition, ctxFail);
    expect(failRes.verified).toBe(false);
    expect(failRes.recoveryHint).toContain('Over mass limit');
  });

  it('6. EVENT_AFTER_BASELINE strictly ignores old events and verifies new events', () => {
    const oldEvent = {
      eventId: 'evt-old-1',
      eventType: 'SCIENCE_OBSERVATION_PROCESSED',
      scheduledTimeSeconds: 100,
      executedAtSeconds: 100,
      status: 'EXECUTED' as const,
      success: true,
      payload: {},
    };

    // Scenario A: Step started at MET = 200, but only old event at MET = 100 exists
    const ctxStale: VerificationContext = {
      snapshot: createMockSnapshot({ recentEvents: [oldEvent] }),
      currentRoute: '/operations',
      stepBaselineMET: 200,
      stepBaselineEventCount: 1,
    };

    const staleRes = stepVerificationEngine.evaluate(
      { type: 'EVENT_AFTER_BASELINE', eventType: 'SCIENCE_OBSERVATION_PROCESSED' },
      ctxStale
    );
    expect(staleRes.verified).toBe(false);
    expect(staleRes.reason).toContain('Past recorded events disregarded');

    // Scenario B: New event executed at MET = 250 (after baseline MET 200 and index > 0)
    const newEvent = {
      eventId: 'evt-new-2',
      eventType: 'SCIENCE_OBSERVATION_PROCESSED',
      scheduledTimeSeconds: 250,
      executedAtSeconds: 250,
      status: 'EXECUTED' as const,
      success: true,
      payload: {},
    };

    const ctxFresh: VerificationContext = {
      snapshot: createMockSnapshot({ recentEvents: [oldEvent, newEvent] }),
      currentRoute: '/operations',
      stepBaselineMET: 200,
      stepBaselineEventCount: 1,
    };

    const freshRes = stepVerificationEngine.evaluate(
      { type: 'EVENT_AFTER_BASELINE', eventType: 'SCIENCE_OBSERVATION_PROCESSED' },
      ctxFresh
    );
    expect(freshRes.verified).toBe(true);
  });

  it('7. DOM_INTERACTION_SIGNAL checks lightweight UI interaction signals', () => {
    const ctxWithoutSignal: VerificationContext = {
      snapshot: createMockSnapshot(),
      currentRoute: '/workshop',
      interactionSignals: {},
    };
    const ctxWithSignal: VerificationContext = {
      snapshot: createMockSnapshot(),
      currentRoute: '/workshop',
      interactionSignals: { camera_preset_changed: true },
    };

    const condition = { type: 'DOM_INTERACTION_SIGNAL' as const, signalKey: 'camera_preset_changed' };

    expect(stepVerificationEngine.evaluate(condition, ctxWithoutSignal).verified).toBe(false);
    expect(stepVerificationEngine.evaluate(condition, ctxWithSignal).verified).toBe(true);
  });
});
