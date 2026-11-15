// @vitest-environment happy-dom
/**
 * SECTOR 17 — Campaign Route & Stage-Access Hardening Test Suite
 * Comprehensive verification of route access boundaries, stage gating,
 * pre-launch event-driven progression, idempotency, failure states,
 * and React Router CampaignRouteGuard redirects.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationProvider } from '../src/runtime/SimulationContext';
import {
  CampaignManager,
  CampaignStateMachine,
  CampaignTransitionError,
  CampaignPersistenceEngine,
  CAMPAIGN_STAGES_SEQUENCE,
  CAMPAIGN_STAGE_CONFIGS,
} from '../src/campaign';
import { CampaignRouteGuard } from '../src/router/CampaignRouteGuard';
import { CampaignOverviewScreen } from '../src/features/screens/campaign/CampaignOverviewScreen';

describe('Phase 6.7.1 — Campaign Route & Stage-Transition Hardening', () => {
  const testCampaignId = 'test-campaign-routing-hardening';
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
  /* 1. Stage 0 Route Access Boundaries                                         */
  /* -------------------------------------------------------------------------- */
  it('1. permits only universal routes at Stage 0 (CAMPAIGN_INTRO) and locks all operational screens', () => {
    expect(manager.getCurrentStageId()).toBe('CAMPAIGN_INTRO');

    // Universal routes
    expect(manager.canAccessRoute('/').allowed).toBe(true);
    expect(manager.canAccessRoute('/campaign').allowed).toBe(true);

    // Stage-restricted screens are strictly locked
    const missions = manager.canAccessRoute('/missions');
    expect(missions.allowed).toBe(false);
    expect(missions.reason).toContain('acknowledging the expedition briefing directive');

    const workshop = manager.canAccessRoute('/workshop');
    expect(workshop.allowed).toBe(false);
    expect(workshop.reason).toContain('Spacecraft workshop requires selecting');

    const trajectory = manager.canAccessRoute('/trajectory');
    expect(trajectory.allowed).toBe(false);
    expect(trajectory.reason).toContain('Trajectory planning requires completing');

    const decisions = manager.canAccessRoute('/decisions');
    expect(decisions.allowed).toBe(false);
    expect(decisions.reason).toContain('Mission decision console requires completing');

    const operations = manager.canAccessRoute('/operations');
    expect(operations.allowed).toBe(false);
    expect(operations.reason).toContain('Mission operations telemetry is locked');

    const surface = manager.canAccessRoute('/surface');
    expect(surface.allowed).toBe(false);
    expect(surface.reason).toContain('Surface exploration telemetry is unavailable');

    const anomaly = manager.canAccessRoute('/anomaly');
    expect(anomaly.allowed).toBe(false);
    expect(anomaly.reason).toContain('Subsurface anomaly workspace requires');

    const debrief = manager.canAccessRoute('/debrief');
    expect(debrief.allowed).toBe(false);
    expect(debrief.reason).toContain('Mission debrief is locked');
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Route Unlocking Boundary Progression Across All 18 Stages               */
  /* -------------------------------------------------------------------------- */
  it('2. unlocks routes sequentially as campaign advances through its 18 stages', () => {
    const sm = manager.getStateMachine();

    // Stage 1: MISSION_SELECTION
    sm.transitionTo('MISSION_SELECTION', 10);
    expect(manager.canAccessRoute('/missions').allowed).toBe(true);
    expect(manager.canAccessRoute('/workshop').allowed).toBe(false);
    expect(manager.canAccessRoute('/trajectory').allowed).toBe(false);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(manager.canAccessRoute('/operations').allowed).toBe(false);

    // Stage 2: SPACECRAFT_DESIGN
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    expect(manager.canAccessRoute('/missions').allowed).toBe(true);
    expect(manager.canAccessRoute('/workshop').allowed).toBe(true);
    expect(manager.canAccessRoute('/trajectory').allowed).toBe(false);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(manager.canAccessRoute('/operations').allowed).toBe(false);

    // Stage 3: ENGINEERING_VALIDATION
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    expect(manager.canAccessRoute('/workshop').allowed).toBe(true);
    expect(manager.canAccessRoute('/trajectory').allowed).toBe(false);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(manager.canAccessRoute('/operations').allowed).toBe(false);

    // Stage 4: MISSION_READINESS
    sm.transitionTo('MISSION_READINESS', 40);
    expect(manager.canAccessRoute('/workshop').allowed).toBe(true);
    expect(manager.canAccessRoute('/trajectory').allowed).toBe(true);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(manager.canAccessRoute('/operations').allowed).toBe(false);

    // Stage 5: LAUNCH_AUTHORIZATION
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    expect(manager.canAccessRoute('/trajectory').allowed).toBe(true);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(true);
    expect(manager.canAccessRoute('/operations').allowed).toBe(false);

    // Stage 6: LAUNCH
    sm.transitionTo('LAUNCH', 60);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(true);
    expect(manager.canAccessRoute('/operations').allowed).toBe(true);
    expect(manager.canAccessRoute('/surface').allowed).toBe(false);
    expect(manager.canAccessRoute('/anomaly').allowed).toBe(false);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(false);

    // Stages 7-11: Cruise through Lander Deployment
    sm.transitionTo('INTERPLANETARY_CRUISE', 70);
    expect(manager.canAccessRoute('/operations').allowed).toBe(true);
    expect(manager.canAccessRoute('/surface').allowed).toBe(false);

    sm.transitionTo('JUPITER_ARRIVAL', 80);
    expect(manager.canAccessRoute('/operations').allowed).toBe(true);

    sm.transitionTo('EUROPA_RECONNAISSANCE', 90);
    expect(manager.canAccessRoute('/operations').allowed).toBe(true);

    sm.transitionTo('SURFACE_MISSION_PREPARATION', 100);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(true);
    expect(manager.canAccessRoute('/surface').allowed).toBe(false);

    sm.transitionTo('LANDER_DEPLOYMENT', 110);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(true);
    expect(manager.canAccessRoute('/surface').allowed).toBe(false);

    // Stage 12: SURFACE_OPERATIONS
    sm.transitionTo('SURFACE_OPERATIONS', 120);
    expect(manager.canAccessRoute('/surface').allowed).toBe(true);
    expect(manager.canAccessRoute('/anomaly').allowed).toBe(false);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(false);

    // Stage 13: ANOMALY_INVESTIGATION
    sm.transitionTo('ANOMALY_INVESTIGATION', 130);
    expect(manager.canAccessRoute('/surface').allowed).toBe(true);
    expect(manager.canAccessRoute('/anomaly').allowed).toBe(true);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(false);

    // Stage 14: FINAL_DATA_TRANSMISSION
    sm.transitionTo('FINAL_DATA_TRANSMISSION', 140);
    expect(manager.canAccessRoute('/operations').allowed).toBe(true);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(false);

    // Stage 15: MISSION_EVALUATION
    sm.transitionTo('MISSION_EVALUATION', 150);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(true);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(false);

    // Stage 16: MISSION_DEBRIEF
    sm.transitionTo('MISSION_DEBRIEF', 160);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(true);

    // Stage 17: CAMPAIGN_COMPLETED
    sm.transitionTo('CAMPAIGN_COMPLETED', 170);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(true);
    expect(manager.canAccessRoute('/campaign').allowed).toBe(true);
    expect(manager.canAccessRoute('/').allowed).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Mission Failure Permits Debrief and Retains Earlier Route Constraints   */
  /* -------------------------------------------------------------------------- */
  it('3. allows debrief screen when mission fails and preserves past route accessibility', () => {
    const sm = manager.getStateMachine();

    // Advance to LAUNCH (stage 6)
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);
    sm.transitionTo('LAUNCH_AUTHORIZATION', 50);
    sm.transitionTo('LAUNCH', 60);

    // Trigger failure during launch
    manager.failCampaign('Ascent stage telemetry lost', 65);

    expect(manager.getStatus()).toBe('FAILED');
    expect(manager.canAccessRoute('/campaign').allowed).toBe(true);
    expect(manager.canAccessRoute('/operations').allowed).toBe(true);
    expect(manager.canAccessRoute('/debrief').allowed).toBe(true); // Permitted on failure for post-mortem analysis

    // Later unreached operational stages remain locked
    expect(manager.canAccessRoute('/surface').allowed).toBe(false);
    expect(manager.canAccessRoute('/anomaly').allowed).toBe(false);
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Pre-Launch Redesign Rollback Preserves Route Boundary Constraints       */
  /* -------------------------------------------------------------------------- */
  it('4. locks trajectory route again when rolling back from readiness to spacecraft design', () => {
    const sm = manager.getStateMachine();

    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);

    expect(manager.canAccessRoute('/trajectory').allowed).toBe(true);

    // Rollback to SPACECRAFT_DESIGN
    const rollback = sm.transitionTo('SPACECRAFT_DESIGN', 45, { note: 'Propulsion recalculation needed' });
    expect(rollback.success).toBe(true);
    expect(manager.getCurrentStageId()).toBe('SPACECRAFT_DESIGN');

    // Workshop remains open
    expect(manager.canAccessRoute('/workshop').allowed).toBe(true);

    // Trajectory is now locked again since current stage is SPACECRAFT_DESIGN
    expect(manager.canAccessRoute('/trajectory').allowed).toBe(false);
    expect(manager.canAccessRoute('/trajectory').reason).toContain('Trajectory planning requires completing');
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Pre-Launch Event-Driven Deterministic Progression                        */
  /* -------------------------------------------------------------------------- */
  it('5. deterministically advances pre-launch stages through campaign event bridge', () => {
    const bridge = manager.getEventBridge();

    // 1. Briefing acknowledged -> MISSION_SELECTION
    const res1 = bridge.processEvent(
      {
        id: 'evt-test-briefing',
        type: 'EVT_BRIEFING_ACKNOWLEDGED',
        metSeconds: 5,
        priority: 'CRITICAL',
        title: 'Briefing Acknowledged',
        description: 'Commander reviewed expedition directive',
        requiresConfirmation: false,
      },
      5
    );
    expect(res1.processed).toBe(true);
    expect(res1.advancedStage).toBe('MISSION_SELECTION');
    expect(manager.getCurrentStageId()).toBe('MISSION_SELECTION');

    // 2. Mission selected -> SPACECRAFT_DESIGN
    const res2 = bridge.processEvent(
      {
        id: 'evt-test-mission-sel',
        type: 'MISSION_SELECTED',
        metSeconds: 10,
        priority: 'CRITICAL',
        title: 'Mission Selected',
        description: 'Europa Survey confirmed',
        requiresConfirmation: false,
      },
      10
    );
    expect(res2.processed).toBe(true);
    expect(res2.advancedStage).toBe('SPACECRAFT_DESIGN');
    expect(manager.getCurrentStageId()).toBe('SPACECRAFT_DESIGN');

    // 3. Spacecraft configured -> ENGINEERING_VALIDATION
    const res3 = bridge.processEvent(
      {
        id: 'evt-test-sc-config',
        type: 'SPACECRAFT_CONFIGURED',
        metSeconds: 15,
        priority: 'CRITICAL',
        title: 'Spacecraft Configured',
        description: 'Subsystems integrated',
        requiresConfirmation: false,
      },
      15
    );
    expect(res3.processed).toBe(true);
    expect(res3.advancedStage).toBe('ENGINEERING_VALIDATION');
    expect(manager.getCurrentStageId()).toBe('ENGINEERING_VALIDATION');

    // 4. Validation completed -> MISSION_READINESS
    const res4 = bridge.processEvent(
      {
        id: 'evt-test-val-done',
        type: 'VALIDATION_COMPLETED',
        metSeconds: 20,
        priority: 'CRITICAL',
        title: 'Validation Completed',
        description: 'Engineering validation verified',
        requiresConfirmation: false,
      },
      20
    );
    expect(res4.processed).toBe(true);
    expect(res4.advancedStage).toBe('MISSION_READINESS');
    expect(manager.getCurrentStageId()).toBe('MISSION_READINESS');

    // 5. Readiness certified -> LAUNCH_AUTHORIZATION
    const res5 = bridge.processEvent(
      {
        id: 'evt-test-ready-cert',
        type: 'READINESS_CERTIFIED',
        metSeconds: 25,
        priority: 'CRITICAL',
        title: 'Readiness Certified',
        description: 'Launch window and comms operational',
        requiresConfirmation: false,
      },
      25
    );
    expect(res5.processed).toBe(true);
    expect(res5.advancedStage).toBe('LAUNCH_AUTHORIZATION');
    expect(manager.getCurrentStageId()).toBe('LAUNCH_AUTHORIZATION');

    // 6. Launch authorized -> LAUNCH
    const res6 = bridge.processEvent(
      {
        id: 'evt-test-launch-auth',
        type: 'LAUNCH_AUTHORIZED',
        metSeconds: 30,
        priority: 'CRITICAL',
        title: 'Launch Authorized',
        description: 'Flight director Go poll confirmed',
        requiresConfirmation: false,
      },
      30
    );
    expect(res6.processed).toBe(true);
    expect(res6.advancedStage).toBe('LAUNCH');
    expect(manager.getCurrentStageId()).toBe('LAUNCH');
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Idempotency and Duplicate Protection                                    */
  /* -------------------------------------------------------------------------- */
  it('6. enforces idempotent stage transitions and ignores duplicate events', () => {
    const bridge = manager.getEventBridge();

    const evt = {
      id: 'evt-idempotent-test',
      type: 'EVT_BRIEFING_ACKNOWLEDGED',
      metSeconds: 5,
      priority: 'CRITICAL' as const,
      title: 'Briefing Acknowledged',
      description: 'Directive confirmed',
      requiresConfirmation: false,
    };

    const first = bridge.processEvent(evt, 5);
    expect(first.processed).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(manager.getCurrentStageId()).toBe('MISSION_SELECTION');

    // Duplicate submission of identical event
    const second = bridge.processEvent(evt, 6);
    expect(second.processed).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(manager.getCurrentStageId()).toBe('MISSION_SELECTION');

    // Advancing to the same stage directly is idempotent
    const selfAdvance = manager.advanceToStage('MISSION_SELECTION');
    expect(selfAdvance.success).toBe(true);
    expect(selfAdvance.fromStage).toBe('MISSION_SELECTION');
    expect(selfAdvance.toStage).toBe('MISSION_SELECTION');

    // Out-of-order past event does not cause regression
    const pastEvt = {
      id: 'evt-past-event',
      type: 'EVT_BRIEFING_ACKNOWLEDGED',
      metSeconds: 7,
      priority: 'CRITICAL' as const,
      title: 'Past Briefing Event',
      description: 'Directive confirmed',
      requiresConfirmation: false,
    };
    const pastRes = bridge.processEvent(pastEvt, 7);
    expect(pastRes.processed).toBe(true);
    expect(pastRes.advancedStage).toBeUndefined(); // Did not advance backward
    expect(manager.getCurrentStageId()).toBe('MISSION_SELECTION');
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Save and Restore Route Access Preservation                              */
  /* -------------------------------------------------------------------------- */
  it('7. preserves exact route accessibility across save and restore cycles', async () => {
    const sm = manager.getStateMachine();

    // Advance to MISSION_READINESS (stage 4)
    sm.transitionTo('MISSION_SELECTION', 10);
    sm.transitionTo('SPACECRAFT_DESIGN', 20);
    sm.transitionTo('ENGINEERING_VALIDATION', 30);
    sm.transitionTo('MISSION_READINESS', 40);

    expect(manager.canAccessRoute('/trajectory').allowed).toBe(true);
    expect(manager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(manager.canAccessRoute('/operations').allowed).toBe(false);

    // Save checkpoint
    const saved = await manager.save();
    expect(saved).toBe(true);

    // Create a new campaign manager in stage 0 and restore
    const freshManager = new CampaignManager({
      campaignId: testCampaignId,
      initialStageId: 'CAMPAIGN_INTRO',
      persistence: manager.getPersistence(),
    });

    expect(freshManager.getCurrentStageId()).toBe('CAMPAIGN_INTRO');
    expect(freshManager.canAccessRoute('/trajectory').allowed).toBe(false);

    const loaded = await freshManager.load();
    expect(loaded).toBe(true);
    expect(freshManager.getCurrentStageId()).toBe('MISSION_READINESS');

    // Route accessibility after restore matches exactly
    expect(freshManager.canAccessRoute('/').allowed).toBe(true);
    expect(freshManager.canAccessRoute('/campaign').allowed).toBe(true);
    expect(freshManager.canAccessRoute('/workshop').allowed).toBe(true);
    expect(freshManager.canAccessRoute('/trajectory').allowed).toBe(true);
    expect(freshManager.canAccessRoute('/decisions').allowed).toBe(false);
    expect(freshManager.canAccessRoute('/operations').allowed).toBe(false);
    expect(freshManager.canAccessRoute('/surface').allowed).toBe(false);
    expect(freshManager.canAccessRoute('/debrief').allowed).toBe(false);
  });

  /* -------------------------------------------------------------------------- */
  /* 8. React Router CampaignRouteGuard Redirect and State Notification         */
  /* -------------------------------------------------------------------------- */
  it('8. redirects unauthorized route navigation to /campaign and renders lock reason banner', () => {
    // Current stage is CAMPAIGN_INTRO, so /operations is locked
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/operations'] },
        React.createElement(
          SimulationProvider,
          { runtime },
          React.createElement(
            Routes,
            null,
            React.createElement(
              Route,
              {
                path: '/operations',
                element: React.createElement(
                  CampaignRouteGuard,
                  null,
                  React.createElement('div', { 'data-testid': 'operations-screen' }, 'OPERATIONS DASHBOARD')
                ),
              }
            ),
            React.createElement(
              Route,
              {
                path: '/campaign',
                element: React.createElement(CampaignOverviewScreen),
              }
            )
          )
        )
      )
    );

    // Child screen must not render
    expect(screen.queryByTestId('operations-screen')).toBeNull();

    // Redirects to /campaign and renders route guard alert
    const alert = screen.getByTestId('campaign-route-guard-alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('ACCESS RESTRICTED [/operations]');
    expect(alert.textContent).toContain('Mission operations telemetry is locked until launch authorization is granted.');
  });
});
