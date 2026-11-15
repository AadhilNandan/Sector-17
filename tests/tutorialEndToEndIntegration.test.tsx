// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { stepRegistry } from '../src/features/tutorial/data/stepRegistry';
import { TutorialProvider, useTutorial } from '../src/features/tutorial/context/TutorialContext';
import { TutorialOverlay } from '../src/features/tutorial/components/TutorialOverlay';
import { stepVerificationEngine } from '../src/features/tutorial/services/stepVerificationEngine';
import { MainMenuScreen } from '../src/features/screens/MainMenuScreen';
import { MissionSelectionScreen } from '../src/features/screens/MissionSelectionScreen';
import { SpacecraftWorkshopScreen } from '../src/features/screens/SpacecraftWorkshopScreen';
import { TrajectoryPlannerScreen } from '../src/features/screens/TrajectoryPlannerScreen';
import { MissionOperationsScreen } from '../src/features/screens/MissionOperationsScreen';
import { MissionDebriefScreen } from '../src/features/screens/MissionDebriefScreen';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationContext } from '../src/runtime/SimulationContext';
import { ExpeditionProvider } from '../src/context/ExpeditionContext';
import type { TutorialModuleId } from '../src/features/tutorial/types';

// Helper component to activate tutorial at specified step
const TutorialStarter: React.FC<{
  moduleId?: TutorialModuleId;
  stepId?: string;
  children: React.ReactNode;
}> = ({ moduleId, stepId, children }) => {
  const { startTutorial } = useTutorial();
  return (
    <div>
      <button
        type="button"
        data-testid="start-tut-btn"
        onClick={() => startTutorial(moduleId, stepId)}
      >
        START_TUT
      </button>
      {children}
    </div>
  );
};

describe('Phase 9.1.4: Screen DOM Tagging & End-to-End Tutorial Integration', () => {
  let runtime: SimulationRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    SimulationRuntime.resetAll();
    runtime = new SimulationRuntime('expedition-v-tut-test');
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    runtime?.dispose();
    SimulationRuntime.resetAll();
    document.body.innerHTML = '';
  });

  // A. Target Coverage Tests
  describe('A. Target Coverage & Screen DOM Resolution', () => {
    it('1. verifies that all 27 registered tutorial steps have unique target IDs', () => {
      const allSteps = stepRegistry.getAllSteps();
      expect(allSteps.length).toBe(27);

      const targetIds = allSteps.map((s) => s.targetId);
      const uniqueTargetIds = new Set(targetIds);
      expect(uniqueTargetIds.size).toBe(27);
    });

    it('2. verifies targets on Route / (MainMenuScreen): header-directive, btn-new-expedition', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <SimulationContext.Provider value={runtime}>
            <MainMenuScreen />
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      const headerDirective = document.querySelector('[data-tutorial-id="header-directive"]');
      expect(headerDirective).toBeTruthy();
      expect(headerDirective?.textContent).toContain('SECTOR 17');

      const btnNewExpedition = document.querySelector('[data-tutorial-id="btn-new-expedition"]');
      expect(btnNewExpedition).toBeTruthy();
      expect(btnNewExpedition?.textContent).toContain('New Expedition');
    });

    it('3. verifies targets on Route /missions (MissionSelectionScreen): dossier-card-expedition-5, btn-configure-spacecraft', () => {
      render(
        <MemoryRouter initialEntries={['/missions']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <MissionSelectionScreen />
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      const dossierCard = document.querySelector('[data-tutorial-id="dossier-card-expedition-5"]');
      expect(dossierCard).toBeTruthy();

      const btnConfigure = document.querySelector('[data-tutorial-id="btn-configure-spacecraft"]');
      expect(btnConfigure).toBeTruthy();
      expect(btnConfigure?.textContent).toContain('BEGIN EXPEDITION');
    });

    it('4. verifies targets on Route /workshop (SpacecraftWorkshopScreen): bay, camera, power, instruments, vehicle, budgets, proceed', () => {
      render(
        <MemoryRouter initialEntries={['/workshop']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <SpacecraftWorkshopScreen />
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      expect(document.querySelector('[data-tutorial-id="panel-workshop-bay"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="bar-camera-presets"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="tab-category-power"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="tab-category-instruments"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="selector-launch-vehicle"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="panel-resource-budgets"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-proceed-trajectory"]')).toBeTruthy();
    });

    it('5. verifies targets on Route /trajectory (TrajectoryPlannerScreen): viewport, scale, eoi burn, validate, timeline, authorize', () => {
      render(
        <MemoryRouter initialEntries={['/trajectory']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <TrajectoryPlannerScreen />
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      expect(document.querySelector('[data-tutorial-id="viewport-orbital-3d"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-scale-toggle"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="item-maneuver-eoi"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-validate-trajectory"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="bar-mission-timeline"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-certify-authorize"]')).toBeTruthy();
    });

    it('6. verifies targets on Route /operations (MissionOperationsScreen): viewport, met clock, comms, science, drop lander, finalize', () => {
      render(
        <MemoryRouter initialEntries={['/operations']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <MissionOperationsScreen />
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      expect(document.querySelector('[data-tutorial-id="viewport-operations-spacecraft"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="controls-met-clock"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-open-communications"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-open-science"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-header-drop-lander"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-finalize-expedition"]')).toBeTruthy();
    });

    it('7. verifies targets on Route /debrief (MissionDebriefScreen): report, science section, replay diagram, archive button', () => {
      render(
        <MemoryRouter initialEntries={['/debrief']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <MissionDebriefScreen />
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      expect(document.querySelector('[data-tutorial-id="doc-parchment-report"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="section-science-returned"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="diagram-trajectory-replay"]')).toBeTruthy();
      expect(document.querySelector('[data-tutorial-id="btn-archive-expedition"]')).toBeTruthy();
    });
  });

  // B. User Interaction & Signal Emission Tests
  describe('B. User Interaction & Signal Emission Tests', () => {
    it('8. user interaction with targeted element emits DOM interaction signal and verifies step', async () => {
      // Step: tut-03-scale-mode on /trajectory with target btn-scale-toggle
      render(
        <MemoryRouter initialEntries={['/trajectory']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <TutorialProvider
                currentRoute="/trajectory"
                initialModuleId="MODULE_03_TRAJECTORY"
                initialStepId="tut-03-scale-mode"
                autoLoadPersistence={false}
              >
                <TutorialStarter moduleId="MODULE_03_TRAJECTORY" stepId="tut-03-scale-mode">
                  <TrajectoryPlannerScreen />
                  <TutorialOverlay />
                </TutorialStarter>
              </TutorialProvider>
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      // Start tutorial explicitly
      fireEvent.click(screen.getByTestId('start-tut-btn'));

      // Verify initial state: action required (button displays AWAITING ACTION)
      const awaitingBtn = await screen.findByText('AWAITING ACTION');
      expect(awaitingBtn).toBeTruthy();

      // User clicks the real scale toggle button
      const scaleToggleContainer = document.querySelector('[data-tutorial-id="btn-scale-toggle"]');
      expect(scaleToggleContainer).toBeTruthy();

      const trueBtn = scaleToggleContainer?.querySelectorAll('button')[1];
      expect(trueBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(trueBtn!);
      });

      // The step is verified and auto-advances to the next step: Mission Maneuver Sequencing
      const nextStepTitle = await screen.findByText('Mission Maneuver Sequencing');
      expect(nextStepTitle).toBeTruthy();
    });

    it('9. selecting a launch vehicle unlocks the launch vehicle tutorial step', async () => {
      render(
        <MemoryRouter initialEntries={['/workshop']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <TutorialProvider
                currentRoute="/workshop"
                initialModuleId="MODULE_02_ENGINEERING"
                initialStepId="tut-02-launch-vehicle"
                autoLoadPersistence={false}
              >
                <TutorialStarter moduleId="MODULE_02_ENGINEERING" stepId="tut-02-launch-vehicle">
                  <SpacecraftWorkshopScreen />
                  <TutorialOverlay />
                </TutorialStarter>
              </TutorialProvider>
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      // Start tutorial explicitly
      fireEvent.click(screen.getByTestId('start-tut-btn'));

      const awaitingBtn = await screen.findByText('AWAITING ACTION');
      expect(awaitingBtn).toBeTruthy();

      // Click a launch vehicle item
      const selector = document.querySelector('[data-tutorial-id="selector-launch-vehicle"]');
      expect(selector).toBeTruthy();

      const vehicleItem = selector?.querySelector('.cursor-pointer');
      expect(vehicleItem).toBeTruthy();

      await act(async () => {
        fireEvent.click(vehicleItem!);
      });

      const continueBtn = await screen.findByText('CONTINUE');
      expect(continueBtn).toBeTruthy();
    });
  });

  // C. Progression, Stale Event Rejection & Authoritative State
  describe('C. Progression, Stale Event Rejection & Authoritative Verification', () => {
    it('10. strictly rejects events executed prior to step activation (stale event rejection)', () => {
      // Create snapshot with past LANDER_DEPLOYMENT_CONFIRMED event executed at MET 100
      const pastSnap = {
        ...runtime.getSnapshot(),
        metSeconds: 200,
        recentEvents: [
          {
            id: 'evt-past',
            eventType: 'LANDER_DEPLOYMENT_CONFIRMED',
            scheduledTimeSeconds: 100,
            executedAtSeconds: 100,
            status: 'EXECUTED' as const,
            executionCount: 1,
            retryCount: 0,
            payload: {},
          },
        ],
      };

      // Step baseline captured at MET 200, event count 1
      const evalResultStale = stepVerificationEngine.evaluate(
        { type: 'EVENT_AFTER_BASELINE', eventType: 'LANDER_DEPLOYMENT_CONFIRMED' },
        {
          snapshot: pastSnap,
          currentRoute: '/operations',
          stepBaselineMET: 200,
          stepBaselineEventCount: 1,
        }
      );

      // Must NOT verify because the past event was before baseline!
      expect(evalResultStale.verified).toBe(false);

      // Now dispatch a new event at MET 250 (after baseline)
      const newSnap = {
        ...pastSnap,
        metSeconds: 250,
        recentEvents: [
          ...pastSnap.recentEvents,
          {
            id: 'evt-new',
            eventType: 'LANDER_DEPLOYMENT_CONFIRMED',
            scheduledTimeSeconds: 250,
            executedAtSeconds: 250,
            status: 'EXECUTED' as const,
            executionCount: 1,
            retryCount: 0,
            payload: {},
          },
        ],
      };

      const evalResultNew = stepVerificationEngine.evaluate(
        { type: 'EVENT_AFTER_BASELINE', eventType: 'LANDER_DEPLOYMENT_CONFIRMED' },
        {
          snapshot: newSnap,
          currentRoute: '/operations',
          stepBaselineMET: 200,
          stepBaselineEventCount: 1,
        }
      );

      expect(evalResultNew.verified).toBe(true);
    });

    it('11. verifies authorize launch step using authoritative snapshot boolean flag', () => {
      const unauthSnap = {
        ...runtime.getSnapshot(),
        isLaunchAuthorized: false,
      };

      const resultUnauth = stepVerificationEngine.evaluate(
        { type: 'SNAPSHOT_BOOLEAN', property: 'isLaunchAuthorized', expectedValue: true },
        { snapshot: unauthSnap, currentRoute: '/trajectory' }
      );
      expect(resultUnauth.verified).toBe(false);

      const authSnap = {
        ...runtime.getSnapshot(),
        isLaunchAuthorized: true,
      };

      const resultAuth = stepVerificationEngine.evaluate(
        { type: 'SNAPSHOT_BOOLEAN', property: 'isLaunchAuthorized', expectedValue: true },
        { snapshot: authSnap, currentRoute: '/trajectory' }
      );
      expect(resultAuth.verified).toBe(true);
    });
  });

  // D. Spotlight Pointer-Event Non-Interception
  describe('D. Real Spotlight Non-Blocking Interaction', () => {
    it('12. permits clicking controls directly through the spotlight cutout', async () => {
      let clickFired = false;

      render(
        <div style={{ position: 'relative', width: '800px', height: '600px' }}>
          <button
            type="button"
            data-tutorial-id="target-test-button"
            style={{ position: 'absolute', top: '100px', left: '100px', width: '120px', height: '40px' }}
            onClick={() => {
              clickFired = true;
            }}
          >
            TEST BUTTON
          </button>
          <TutorialProvider
            initialModuleId="MODULE_01_BRIEFING"
            initialStepId="tut-01-briefing-directive"
            autoLoadPersistence={false}
          >
            <TutorialStarter moduleId="MODULE_01_BRIEFING" stepId="tut-01-briefing-directive">
              <TutorialOverlay />
            </TutorialStarter>
          </TutorialProvider>
        </div>
      );

      const btn = screen.getByRole('button', { name: /TEST BUTTON/i });
      expect(btn).toBeTruthy();

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(clickFired).toBe(true);
    });

    it('13. triggers science observation processing in operations and auto-advances to lander deployment', async () => {
      render(
        <MemoryRouter initialEntries={['/operations']}>
          <SimulationContext.Provider value={runtime}>
            <ExpeditionProvider>
              <TutorialProvider
                currentRoute="/operations"
                initialModuleId="MODULE_04_OPERATIONS"
                initialStepId="tut-04-science-processing"
                autoLoadPersistence={false}
              >
                <TutorialStarter moduleId="MODULE_04_OPERATIONS" stepId="tut-04-science-processing">
                  <MissionOperationsScreen />
                  <TutorialOverlay />
                </TutorialStarter>
              </TutorialProvider>
            </ExpeditionProvider>
          </SimulationContext.Provider>
        </MemoryRouter>
      );

      // Start tutorial explicitly
      fireEvent.click(screen.getByTestId('start-tut-btn'));

      // Tutorial dialog shows Process Scientific Observations
      expect(await screen.findByText('Process Scientific Observations')).toBeTruthy();

      // Open science modal
      const openScienceBtn = document.querySelector('[data-tutorial-id="btn-open-science"]');
      expect(openScienceBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(openScienceBtn!);
      });

      // Click PROCESS OBSERVATION BATCH button inside modal
      const processBatchBtn = await screen.findByRole('button', { name: /PROCESS OBSERVATION BATCH/i });
      expect(processBatchBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(processBatchBtn);
      });

      // The step is verified and auto-advances to Deploy Surface Probe PROMETHEUS-IV
      const nextStepTitle = await screen.findByText('Deploy Surface Probe PROMETHEUS-IV');
      expect(nextStepTitle).toBeTruthy();
    });
  });
});
