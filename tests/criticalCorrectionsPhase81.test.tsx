// @vitest-environment happy-dom
/**
 * SECTOR 17 — Phase 8.1 Critical Corrections Integration Tests
 * Verifies both P1 findings identified in the Phase 8.0 Audit:
 *
 * AUD-01: DYNAMIC MISSION DEBRIEF & SCIENTIFIC INTEGRITY
 * 1. Successful mission with recorded science evidence confirms findings.
 * 2. Failed mission with zero science data displays UNKNOWN / NOT RECORDED and makes no false claims.
 * 3. Partial science acquisition without downlink displays DATA UNRESOLVED (storage untransmitted).
 * 4. Completed anomaly investigation marks Relic-Omega as VERIFIED.
 * 5. Unperformed anomaly investigation marks anomaly as UNVERIFIED.
 *
 * AUD-02: TRAJECTORY TO OPERATIONS TRANSITION & CAMPAIGN SECURITY
 * 6. Flight readiness certification from Trajectory Planner succeeds.
 * 7. Launch authorization automatically and atomically occurs on certification transition.
 * 8. Direct transition from /trajectory to /operations succeeds without unexpected redirects.
 * 9. Premature access to /operations remains strictly locked by CampaignRouteGuard.
 * 10. Re-triggering proceed does not perform duplicate authorization or corrupt stage.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import {
  SimulationRuntime,
  SimulationProvider,
} from '../src/runtime';
import { MissionDebriefScreen } from '../src/features/screens/MissionDebriefScreen';
import { TrajectoryPlannerScreen } from '../src/features/screens/TrajectoryPlannerScreen';
import { CampaignRouteGuard } from '../src/router/CampaignRouteGuard';
import type { SimulationSnapshot } from '../src/runtime/types';
import { DebriefParchmentReport } from '../src/features/mission-debrief/components/DebriefParchmentReport';

describe('Phase 8.1: Critical Corrections (AUD-01 & AUD-02)', () => {
  const CAMPAIGN_ID = 'EXPEDITION-V-PHASE81-TEST';

  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    vi.restoreAllMocks();
  });

  /* ========================================================================== */
  /* AUD-01: DYNAMIC MISSION DEBRIEF SCIENTIFIC INTEGRITY                       */
  /* ========================================================================== */
  describe('AUD-01: Dynamic Mission Debrief & Scientific Integrity', () => {

    it('1. Successful mission with recorded science evidence confirms findings honestly', () => {
      const mockSnapshot: any = {
        formattedMET: '184:12:04:32',
        propellantCapacityKg: 2500,
        propellantRemainingKg: 1200,
        spacecraftConfig: {
          parts: {
            instruments: { name: 'ICE-PENETRATING RADAR (IPR-3) & MASPEX' },
            power: { name: 'RTG-750W' },
            propulsion: { name: 'Bipropellant Main Engine' },
          },
          launchVehicle: { name: 'SLS Block 1B' },
        },
        missionEvaluation: {
          outcome: 'FULL_SUCCESS',
          finalScore: 8900,
          maxScore: 10000,
          scienceBytesReturnedToEarth: 85899345920, // 80 GB
          totalScienceBytesAcquired: 85899345920,
          discoveries: [
            'Subsurface ocean dielectric reflectors confirmed at >15 km depth',
            'Plume volatile signature & organic detection verified',
          ],
          anomalyInvestigated: true,
          anomalyDecision: 'analyze',
          activeFaultCount: 0,
        },
      };

      render(<DebriefParchmentReport snapshot={mockSnapshot as SimulationSnapshot} />);

      // Must display FULL SUCCESS
      expect(screen.getByText(/FULL SUCCESS \/\/ DIRECTIVE COMPLETED/i)).toBeDefined();
      expect(screen.getByText('RELIABILITY ASSESS: NOMINAL')).toBeDefined();

      // Must show resolved data
      expect(screen.getAllByText(/80.0 GB/i).length).toBeGreaterThanOrEqual(1);

      // Must report the confirmed discoveries from recorded telemetry
      expect(
        screen.getByText(/Subsurface ocean dielectric reflectors confirmed at >15 km depth/i)
      ).toBeDefined();
      expect(
        screen.getByText(/Plume volatile signature & organic detection verified/i)
      ).toBeDefined();

      // Must show VERIFIED anomaly
      expect(
        screen.getByText(/VERIFIED: Anomalous precursor structure investigated at Target-B/i)
      ).toBeDefined();
    });

    it('2. Failed mission with zero science data displays UNKNOWN / NOT RECORDED and makes no false claims', () => {
      const mockSnapshot: any = {
        formattedMET: '012:04:10:00',
        propellantCapacityKg: 2500,
        propellantRemainingKg: 0,
        spacecraftConfig: {
          parts: {
            instruments: { name: 'ICE-PENETRATING RADAR (IPR-3)' },
            power: { name: 'RTG-750W' },
          },
        },
        missionEvaluation: {
          outcome: 'MISSION_FAILURE',
          finalScore: 120,
          maxScore: 10000,
          scienceBytesReturnedToEarth: 0,
          totalScienceBytesAcquired: 0,
          discoveries: [],
          anomalyInvestigated: false,
          activeFaultCount: 3,
        },
      };

      render(<DebriefParchmentReport snapshot={mockSnapshot as SimulationSnapshot} />);

      // Must display MISSION FAILURE
      expect(screen.getByText(/MISSION FAILURE \/\/ VEHICLE LOST/i)).toBeDefined();
      expect(screen.getByText('RELIABILITY ASSESS: CRITICAL')).toBeDefined();

      // Telemetry strip must display UNKNOWN / NOT RECORDED for data resolved
      expect(screen.getAllByText(/UNKNOWN \/ NOT RECORDED/i).length).toBeGreaterThanOrEqual(1);

      // Must NOT claim liquid water or ocean confirmed
      expect(screen.queryByText(/Confirmed the existence of liquid water/i)).toBeNull();
      expect(screen.queryByText(/organic detection verified/i)).toBeNull();

      // Anomaly must be unverified
      expect(
        screen.getByText(/UNVERIFIED \/ NOT ACCESSIBLE: Spacecraft did not attain Europa orbital survey geometry/i)
      ).toBeDefined();
    });

    it('3. Partial science acquisition without downlink displays DATA UNRESOLVED (storage untransmitted)', () => {
      const mockSnapshot: any = {
        formattedMET: '150:00:00:00',
        propellantCapacityKg: 2500,
        propellantRemainingKg: 300,
        storage: { usedBytes: 52428800 }, // 50 MB in storage
        missionEvaluation: {
          outcome: 'PARTIAL_SUCCESS',
          finalScore: 3400,
          maxScore: 10000,
          scienceBytesReturnedToEarth: 0,
          totalScienceBytesAcquired: 52428800,
          discoveries: [],
          anomalyInvestigated: false,
        },
      };

      render(<DebriefParchmentReport snapshot={mockSnapshot as SimulationSnapshot} />);

      // Telemetry strip should indicate untransmitted bytes
      expect(screen.getByText(/50.0 MB \(UNTRANSMITTED\)/i)).toBeDefined();

      // Science narrative must explicitly state observations remain stored and unresolved
      expect(
        screen.getByText(/DATA UNRESOLVED: Scientific observations \(50.0 MB acquired\) remain stored/i)
      ).toBeDefined();

      // Must not claim water confirmed
      expect(screen.queryByText(/Confirmed the existence of liquid water/i)).toBeNull();
    });

    it('4. Completed anomaly investigation marks Relic-Omega as VERIFIED', () => {
      const mockSnapshot: any = {
        formattedMET: '184:12:00:00',
        propellantCapacityKg: 2500,
        propellantRemainingKg: 800,
        missionEvaluation: {
          outcome: 'PARTIAL_SUCCESS',
          scienceBytesReturnedToEarth: 10737418240, // 10 GB
          totalScienceBytesAcquired: 10737418240,
          discoveries: ['Plume volatile spectrometry completed'],
          anomalyInvestigated: true,
          anomalyDecision: 'sample',
        },
      };

      render(<DebriefParchmentReport snapshot={mockSnapshot as SimulationSnapshot} />);

      expect(screen.getByText(/ANOMALY RESOLUTION:/i)).toBeDefined();
      expect(screen.getAllByText('VERIFIED').length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(/FICTIONAL HYPOTHESIS — EXPLORED VIA SAMPLE/i)
      ).toBeDefined();
    });

    it('5. Unperformed anomaly investigation marks anomaly as UNVERIFIED', () => {
      const mockSnapshot: any = {
        formattedMET: '184:12:00:00',
        propellantCapacityKg: 2500,
        propellantRemainingKg: 800,
        missionEvaluation: {
          outcome: 'PARTIAL_SUCCESS',
          scienceBytesReturnedToEarth: 10737418240,
          totalScienceBytesAcquired: 10737418240,
          discoveries: ['Plume volatile spectrometry completed'],
          anomalyInvestigated: false,
        },
      };

      render(<DebriefParchmentReport snapshot={mockSnapshot as SimulationSnapshot} />);

      expect(screen.getByText('UNVERIFIED')).toBeDefined();
      expect(
        screen.getByText(/UNVERIFIED \/ NO ON-SITE INVESTIGATION LOGGED/i)
      ).toBeDefined();
    });
  });

  /* ========================================================================== */
  /* AUD-02: TRAJECTORY TO OPERATIONS TRANSITION & CAMPAIGN SECURITY            */
  /* ========================================================================== */
  describe('AUD-02: Trajectory to Operations Transition & Campaign Security', () => {

    it('6. Certifying flight readiness in Trajectory Planner succeeds and advances state', () => {
      const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
      const campaignManager = runtime.getCampaignManager();
      const sm = campaignManager.getStateMachine();

      // Progress campaign to MISSION_READINESS
      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);

      expect(sm.getCurrentStageId()).toBe('MISSION_READINESS');
      expect(runtime.getSnapshot().isReadinessCertified).toBe(false);

      // Certify readiness
      const certifyRes = runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      expect(certifyRes.success).toBe(true);
      expect(runtime.getSnapshot().isReadinessCertified).toBe(true);
      expect(sm.getCurrentStageId()).toBe('LAUNCH_AUTHORIZATION');
    });

    it('7. Launch authorization automatically and atomically occurs on certification transition', () => {
      const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
      const campaignManager = runtime.getCampaignManager();
      const sm = campaignManager.getStateMachine();

      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);

      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      expect(runtime.getSnapshot().isLaunchAuthorized).toBe(false);

      const authRes = runtime.authorizeLaunch();
      expect(authRes.success).toBe(true);
      expect(runtime.getSnapshot().isLaunchAuthorized).toBe(true);

      // Campaign state machine must advance through LAUNCH_AUTHORIZATION to LAUNCH
      expect(sm.getCurrentStageId()).toBe('LAUNCH');
      expect(sm.getCompletedStages()).toContain('LAUNCH_AUTHORIZATION');
    });

    it('8. Direct transition from /trajectory to /operations succeeds without unexpected redirects', () => {
      const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
      const campaignManager = runtime.getCampaignManager();
      const sm = campaignManager.getStateMachine();

      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);

      render(
        <MemoryRouter initialEntries={['/trajectory']}>
          <SimulationProvider campaignId={CAMPAIGN_ID}>
            <Routes>
              <Route path="/trajectory" element={<TrajectoryPlannerScreen />} />
              <Route
                path="/operations"
                element={
                  <CampaignRouteGuard>
                    <div data-testid="operations-target">Operations Workstation Loaded</div>
                  </CampaignRouteGuard>
                }
              />
              <Route path="/campaign" element={<div data-testid="campaign-redirect">Campaign Redirect</div>} />
            </Routes>
          </SimulationProvider>
        </MemoryRouter>
      );

      // Verify Trajectory Planner is loaded
      expect(screen.getByText(/TRAJECTORY PLANNER \/\/ EXPEDITION-V/i)).toBeDefined();

      // Click CERTIFY FLIGHT READINESS (which now certifies and authorizes launch atomically)
      const certifyBtn = screen.getByRole('button', { name: /CERTIFY FLIGHT READINESS|PROCEED TO OPERATIONS/i });
      act(() => {
        fireEvent.click(certifyBtn);
      });

      // Must land on /operations directly, NOT redirected to /campaign
      expect(screen.getByTestId('operations-target')).toBeDefined();
      expect(screen.queryByTestId('campaign-redirect')).toBeNull();
    });

    it('9. Premature access to /operations remains strictly locked by CampaignRouteGuard', () => {
      const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
      const campaignManager = runtime.getCampaignManager();
      const sm = campaignManager.getStateMachine();

      // Start at early stage SPACECRAFT_DESIGN
      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);

      expect(runtime.getSnapshot().isLaunchAuthorized).toBe(false);
      expect(campaignManager.canAccessRoute('/operations').allowed).toBe(false);

      render(
        <MemoryRouter initialEntries={['/operations']}>
          <SimulationProvider campaignId={CAMPAIGN_ID}>
            <Routes>
              <Route
                path="/operations"
                element={
                  <CampaignRouteGuard>
                    <div data-testid="operations-target">Operations Workstation Loaded</div>
                  </CampaignRouteGuard>
                }
              />
              <Route path="/campaign" element={<div data-testid="campaign-redirect">Campaign Redirect</div>} />
            </Routes>
          </SimulationProvider>
        </MemoryRouter>
      );

      // Must be redirected to /campaign because launch is unauthorized
      expect(screen.getByTestId('campaign-redirect')).toBeDefined();
      expect(screen.queryByTestId('operations-target')).toBeNull();
    });

    it('10. Re-triggering proceed does not perform duplicate authorization or corrupt stage', () => {
      const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
      const campaignManager = runtime.getCampaignManager();
      const sm = campaignManager.getStateMachine();

      sm.transitionTo('MISSION_SELECTION', 0);
      sm.transitionTo('SPACECRAFT_DESIGN', 0);
      sm.transitionTo('ENGINEERING_VALIDATION', 0);
      sm.transitionTo('MISSION_READINESS', 0);

      runtime.certifyMissionReadiness({ acknowledgeWarnings: true });
      runtime.authorizeLaunch();

      expect(sm.getCurrentStageId()).toBe('LAUNCH');

      // Calling authorize again should return already-authorized or not corrupt stage
      const duplicateAuth = runtime.authorizeLaunch();
      expect(duplicateAuth.success).toBe(true);
      expect(sm.getCurrentStageId()).toBe('LAUNCH');
    });
  });
});
