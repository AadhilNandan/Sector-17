// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationProvider } from '../src/runtime/SimulationContext';
import { CampaignRouteGuard } from '../src/router/CampaignRouteGuard';
import { CampaignOverviewScreen } from '../src/features/screens/campaign/CampaignOverviewScreen';
import { MainMenuScreen } from '../src/features/screens/MainMenuScreen';
import { MissionSelectionScreen } from '../src/features/screens/MissionSelectionScreen';
import { SpacecraftWorkshopScreen } from '../src/features/screens/SpacecraftWorkshopScreen';
import { TrajectoryPlannerScreen } from '../src/features/screens/TrajectoryPlannerScreen';
import { MissionOperationsScreen } from '../src/features/screens/MissionOperationsScreen';
import { MissionDecisionScreen } from '../src/features/screens/MissionDecisionScreen';
import { SurfaceExplorationScreen } from '../src/features/screens/SurfaceExplorationScreen';
import { AnomalyDetectedScreen } from '../src/features/screens/AnomalyDetectedScreen';
import { MissionDebriefScreen } from '../src/features/screens/MissionDebriefScreen';
import { ExpeditionProvider } from '../src/context/ExpeditionContext';

describe('Routing Stability & Direct Refresh Subsystem (Workstream B)', () => {
  const CAMPAIGN_ID = 'EXPEDITION-V';

  beforeEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
  });

  const renderSimulatedPageLoad = (initialPath: string) => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <SimulationProvider campaignId={CAMPAIGN_ID} config={{ initialState: 'INITIALIZED', autoPersistCampaign: true }}>
          <ExpeditionProvider>
            <Routes>
              <Route path="/" element={<MainMenuScreen />} />
              <Route
                path="/missions"
                element={
                  <CampaignRouteGuard>
                    <MissionSelectionScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route
                path="/workshop"
                element={
                  <CampaignRouteGuard>
                    <SpacecraftWorkshopScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route
                path="/trajectory"
                element={
                  <CampaignRouteGuard>
                    <TrajectoryPlannerScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route
                path="/operations"
                element={
                  <CampaignRouteGuard>
                    <MissionOperationsScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route
                path="/decisions"
                element={
                  <CampaignRouteGuard>
                    <MissionDecisionScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route path="/campaign" element={<CampaignOverviewScreen />} />
              <Route
                path="/surface"
                element={
                  <CampaignRouteGuard>
                    <SurfaceExplorationScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route
                path="/anomaly"
                element={
                  <CampaignRouteGuard>
                    <AnomalyDetectedScreen />
                  </CampaignRouteGuard>
                }
              />
              <Route
                path="/debrief"
                element={
                  <CampaignRouteGuard>
                    <MissionDebriefScreen />
                  </CampaignRouteGuard>
                }
              />
            </Routes>
          </ExpeditionProvider>
        </SimulationProvider>
      </MemoryRouter>
    );
  };

  it('1. universal route / (Main Menu) renders on direct navigation and does not redirect', () => {
    renderSimulatedPageLoad('/');
    expect(screen.getByTestId('main-menu-hero-bg')).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('2. universal route /campaign (Campaign Overview) renders on direct navigation without redirect', () => {
    renderSimulatedPageLoad('/campaign');
    expect(screen.getByTestId('campaign-save-button')).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('3. refresh on /missions remains on route when user has reached MISSION_SELECTION', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState('MISSION_SELECTION', 'ACTIVE', ['CAMPAIGN_INTRO'], []);
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/missions');
    expect(screen.getByText(/EXPEDITION ARCHIVE/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('4. refresh on /workshop remains on route when user has reached SPACECRAFT_DESIGN', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState('SPACECRAFT_DESIGN', 'ACTIVE', ['CAMPAIGN_INTRO', 'MISSION_SELECTION'], []);
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/workshop');
    expect(screen.getByText(/SPACECRAFT AETHON CONFIGURATION/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('5. refresh on /trajectory remains on route when user has reached MISSION_READINESS', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState(
      'MISSION_READINESS',
      'ACTIVE',
      ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION'],
      []
    );
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/trajectory');
    expect(screen.getByText(/ASTRODYNAMICS/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('6. refresh on /decisions remains on route when user has reached LAUNCH_AUTHORIZATION', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState(
      'LAUNCH_AUTHORIZATION',
      'ACTIVE',
      ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION', 'MISSION_READINESS'],
      []
    );
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/decisions');
    expect(screen.getByText(/MISSION DECISION & RESPONSE STATION/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('7. refresh on /operations remains on route when launch is authorized and flight started', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState(
      'LAUNCH',
      'ACTIVE',
      ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION', 'MISSION_READINESS', 'LAUNCH_AUTHORIZATION'],
      []
    );
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/operations');
    expect(screen.getByText(/MISSION OPERATIONS - EXPEDITION-V/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('8. refresh on /surface remains on route when user has reached SURFACE_OPERATIONS', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState(
      'SURFACE_OPERATIONS',
      'ACTIVE',
      ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION', 'MISSION_READINESS', 'LAUNCH_AUTHORIZATION', 'LAUNCH', 'LANDER_DEPLOYMENT'],
      []
    );
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/surface');
    expect(screen.getByText(/SURFACE EXPLORATION · EUROPA/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('9. refresh on /anomaly remains on route when user has reached ANOMALY_INVESTIGATION', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState(
      'ANOMALY_INVESTIGATION',
      'ACTIVE',
      ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION', 'MISSION_READINESS', 'LAUNCH_AUTHORIZATION', 'LAUNCH', 'LANDER_DEPLOYMENT', 'SURFACE_OPERATIONS'],
      []
    );
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/anomaly');
    expect(screen.getByRole('heading', { name: /ANOMALY DETECTED/i })).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('10. refresh on /debrief remains on route when user has reached MISSION_DEBRIEF', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID, { autoPersistCampaign: true });
    runtime.getCampaignManager().restoreState(
      'MISSION_DEBRIEF',
      'ACTIVE',
      ['CAMPAIGN_INTRO', 'MISSION_SELECTION', 'SPACECRAFT_DESIGN', 'ENGINEERING_VALIDATION', 'MISSION_READINESS', 'LAUNCH_AUTHORIZATION', 'LAUNCH', 'LANDER_DEPLOYMENT', 'SURFACE_OPERATIONS', 'ANOMALY_INVESTIGATION'],
      []
    );
    runtime.getCampaignManager().saveSync();
    SimulationRuntime.resetAll();

    renderSimulatedPageLoad('/debrief');
    expect(screen.getByText(/MISSION DEBRIEF/i)).toBeDefined();
    expect(screen.queryByTestId('campaign-route-guard-alert')).toBeNull();
  });

  it('11. premature access to locked route redirects to /campaign with clear explanation & navigation options', () => {
    // In fresh session at Stage 0, attempting to access /operations must be safely guarded
    renderSimulatedPageLoad('/operations');

    // Child screen must not render
    expect(screen.queryByText(/FLIGHT DIRECTOR CONSOLE/i)).toBeNull();

    // Alert banner is rendered on /campaign
    const alert = screen.getByTestId('campaign-route-guard-alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('ACCESS RESTRICTED [/operations]');
    expect(alert.textContent).toContain('Mission operations telemetry is locked until launch authorization is granted.');

    // Navigation options are present
    expect(screen.getByTestId('alert-proceed-current-btn')).toBeDefined();
    expect(screen.getByTestId('alert-main-menu-btn')).toBeDefined();
  });
});
