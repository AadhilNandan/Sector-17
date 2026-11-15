/**
 * SECTOR 17 — Tutorial React Context & Hooks
 * Phase 9.1.2 Production Implementation
 *
 * Grounded in the Phase 9.1.1 Architecture Blueprint.
 * Centralized state controller for guided onboarding, contextual assistance (inspect mode),
 * and the Mission Handbook. Integrates safe persistence and real-time step verification.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import type {
  TutorialState,
  TutorialModuleId,
  TutorialStep,
  TutorialModule,
  VerificationContext,
  VerificationResult,
} from '../types';
import { stepRegistry } from '../data/stepRegistry';
import { tutorialPersistence } from '../services/tutorialPersistence';
import { stepVerificationEngine } from '../services/stepVerificationEngine';
import { SimulationContext } from '../../../runtime/SimulationContext';
import type { SimulationSnapshot } from '../../../runtime/types';

export interface TutorialContextValue {
  readonly state: TutorialState;
  readonly currentStep: TutorialStep | undefined;
  readonly currentModule: TutorialModule | undefined;
  readonly lastVerificationResult: VerificationResult | undefined;
  readonly isTutorialMinimized: boolean;
  readonly startTutorial: (moduleId?: TutorialModuleId, stepId?: string) => void;
  readonly pauseTutorial: () => void;
  readonly resumeTutorial: () => void;
  readonly minimizeTutorial: () => void;
  readonly restoreTutorial: () => void;
  readonly advanceStep: () => boolean;
  readonly previousStep: () => boolean;
  readonly skipTutorial: () => void;
  readonly restartTutorial: () => void;
  readonly completeStep: (stepId: string) => void;
  readonly resetTutorialProgress: () => void;
  readonly setInspectMode: (active: boolean) => void;
  readonly openHandbook: (articleId?: string) => void;
  readonly closeHandbook: () => void;
  readonly emitSignal: (signalKey: string) => void;
  readonly verifyCurrentStep: (contextOverride?: Partial<VerificationContext>) => VerificationResult;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);

export interface TutorialProviderProps {
  readonly children: React.ReactNode;
  readonly currentRoute?: string;
  readonly initialModuleId?: TutorialModuleId;
  readonly initialStepId?: string;
  readonly autoLoadPersistence?: boolean;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({
  children,
  currentRoute,
  initialModuleId = 'MODULE_01_BRIEFING',
  initialStepId = 'tut-01-briefing-directive',
  autoLoadPersistence = true,
}) => {
  const simulationRuntime = useContext(SimulationContext);

  // Active step and module resolution
  const [currentModuleId, setCurrentModuleId] = useState<TutorialModuleId>(initialModuleId);
  const [currentStepId, setCurrentStepId] = useState<string>(initialStepId);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isTutorialMinimized, setIsTutorialMinimized] = useState<boolean>(false);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [completedModuleIds, setCompletedModuleIds] = useState<TutorialModuleId[]>([]);
  const [overallCompletion, setOverallCompletion] = useState<boolean>(false);
  const [inspectModeActive, setInspectModeActive] = useState<boolean>(false);
  const [handbookOpen, setHandbookOpen] = useState<boolean>(false);
  const [activeHandbookArticleId, setActiveHandbookArticleId] = useState<string | undefined>(undefined);

  // Baseline tracking for stale-event rejection
  const [stepBaselineMET, setStepBaselineMET] = useState<number>(0);
  const [stepBaselineEventCount, setStepBaselineEventCount] = useState<number>(0);
  const [interactionSignals, setInteractionSignals] = useState<Record<string, boolean>>({});

  // Last evaluation result
  const [lastVerificationResult, setLastVerificationResult] = useState<VerificationResult | undefined>(undefined);

  const initialLoadedRef = useRef(false);

  // Load persisted progress on mount
  useEffect(() => {
    if (!autoLoadPersistence || initialLoadedRef.current) return;
    initialLoadedRef.current = true;

    const allStepIds = new Set(stepRegistry.getAllSteps().map((s) => s.id));
    const saved = tutorialPersistence.loadProgress(allStepIds);

    if (saved) {
      setCurrentModuleId(saved.currentModuleId);
      setCurrentStepId(saved.currentStepId);
      setCompletedStepIds([...saved.completedStepIds]);
      setCompletedModuleIds([...saved.completedModuleIds]);
      setOverallCompletion(saved.hasCompletedTutorial);
    }
  }, [autoLoadPersistence]);

  // Current step & module from registry
  const currentStep = useMemo(() => stepRegistry.getStepById(currentStepId), [currentStepId]);
  const currentModule = useMemo(() => stepRegistry.getModuleById(currentModuleId), [currentModuleId]);

  // Derive mode
  const mode = useMemo(() => {
    if (handbookOpen) return 'HANDBOOK';
    if (inspectModeActive) return 'INSPECT';
    if (isActive) return 'GUIDED';
    return 'INACTIVE';
  }, [handbookOpen, inspectModeActive, isActive]);

  // Current state object
  const state: TutorialState = useMemo(
    () => ({
      mode,
      isActive,
      isTutorialMinimized,
      currentModuleId,
      currentStepId,
      isPaused,
      completedStepIds,
      completedModuleIds,
      overallCompletion,
      handbookOpen,
      activeHandbookArticleId,
      inspectModeActive,
      lastUpdatedTimestamp: Date.now(),
      stepBaselineMET,
      stepBaselineEventCount,
      interactionSignals,
    }),
    [
      mode,
      isActive,
      isTutorialMinimized,
      currentModuleId,
      currentStepId,
      isPaused,
      completedStepIds,
      completedModuleIds,
      overallCompletion,
      handbookOpen,
      activeHandbookArticleId,
      inspectModeActive,
      stepBaselineMET,
      stepBaselineEventCount,
      interactionSignals,
    ]
  );

  // Helper to persist current state
  const persistState = useCallback(
    (
      newModuleId: TutorialModuleId,
      newStepId: string,
      newCompletedSteps: readonly string[],
      newCompletedModules: readonly TutorialModuleId[],
      completed: boolean
    ) => {
      tutorialPersistence.saveProgress({
        version: 1,
        hasCompletedTutorial: completed,
        currentModuleId: newModuleId,
        currentStepId: newStepId,
        completedStepIds: [...newCompletedSteps],
        completedModuleIds: [...newCompletedModules],
        lastUpdatedTimestamp: Date.now(),
      });
    },
    []
  );

  // Helper to capture current baseline when activating a step
  const captureStepBaseline = useCallback(() => {
    let met = 0;
    let eventCount = 0;

    if (simulationRuntime) {
      const snap = simulationRuntime.getSnapshot();
      met = snap.metSeconds ?? 0;
      eventCount = snap.recentEvents?.length ?? 0;
    }

    setStepBaselineMET(met);
    setStepBaselineEventCount(eventCount);
    setInteractionSignals({});
    setLastVerificationResult(undefined);
  }, [simulationRuntime]);

  // Verification method
  const verifyCurrentStep = useCallback(
    (contextOverride?: Partial<VerificationContext>): VerificationResult => {
      if (!currentStep) {
        return { verified: false, reason: 'No active tutorial step.' };
      }

      let snapshot: SimulationSnapshot;
      if (contextOverride?.snapshot) {
        snapshot = contextOverride.snapshot;
      } else if (simulationRuntime) {
        snapshot = simulationRuntime.getSnapshot();
      } else {
        // Fallback mock snapshot for test environments
        snapshot = {
          metSeconds: 0,
          flightState: 'STANDBY',
          briefingAcknowledged: true,
          subsystems: {},
          recentEvents: [],
          objectives: [],
          availableDecisions: [],
          scienceProducts: { totalCount: 0, byInstrument: { REASON: [], MASPEX: [] }, anomalyReports: [] },
          recentObservations: [],
          storage: { capacityBytes: 64e9, usedBytes: 0, packetCount: 0, utilizationPercent: 0 },
          communications: { isWindowActive: true, currentStation: null, signalDelaySeconds: 0, snrDb: 25, queueUtilizationPercent: 0 },
          faults: { activeCount: 0, activeFaults: [], requiresUserAcknowledgement: false },
        } as unknown as SimulationSnapshot;
      }

      const activeRoute = contextOverride?.currentRoute ?? currentRoute ?? currentStep.route;

      const evalContext: VerificationContext = {
        snapshot,
        runtime: simulationRuntime,
        currentRoute: activeRoute,
        stepBaselineMET,
        stepBaselineEventCount,
        interactionSignals,
        domElementFound: contextOverride?.domElementFound ?? true,
        ...contextOverride,
      };

      const result = stepVerificationEngine.evaluate(currentStep.verification, evalContext);
      setLastVerificationResult(result);
      return result;
    },
    [currentStep, simulationRuntime, currentRoute, stepBaselineMET, stepBaselineEventCount, interactionSignals]
  );

  // Start guided walkthrough
  const startTutorial = useCallback(
    (targetModuleId?: TutorialModuleId, targetStepId?: string) => {
      const allSteps = stepRegistry.getAllSteps();
      const firstStep = allSteps[0];
      const startStep = targetStepId
        ? stepRegistry.getStepById(targetStepId)
        : targetModuleId
        ? stepRegistry.getStepsForModule(targetModuleId)[0]
        : firstStep;

      if (!startStep) return;

      setCurrentModuleId(startStep.moduleId);
      setCurrentStepId(startStep.id);
      setIsActive(true);
      setIsPaused(false);
      setIsTutorialMinimized(false);
      setInspectModeActive(false);
      setHandbookOpen(false);

      captureStepBaseline();
    },
    [captureStepBaseline]
  );

  // Pause guided walkthrough
  const pauseTutorial = useCallback(() => {
    setIsPaused(true);
  }, []);

  // Resume guided walkthrough
  const resumeTutorial = useCallback(() => {
    setIsPaused(false);
    setIsActive(true);
  }, []);

  // Minimize tutorial UI (Workstream A)
  const minimizeTutorial = useCallback(() => {
    setIsTutorialMinimized(true);
  }, []);

  // Restore tutorial UI from minimization (Workstream A)
  const restoreTutorial = useCallback(() => {
    setIsTutorialMinimized(false);
  }, []);

  // Global hotkey: 'M' or 'm' toggles minimization (Workstream A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            (target as HTMLElement).isContentEditable)
        ) {
          return;
        }

        if (isActive) {
          e.preventDefault();
          setIsTutorialMinimized((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  // Complete specific step
  const completeStep = useCallback(
    (stepId: string) => {
      setCompletedStepIds((prev) => {
        if (prev.includes(stepId)) return prev;
        const next = [...prev, stepId];
        persistState(currentModuleId, currentStepId, next, completedModuleIds, overallCompletion);
        return next;
      });
    },
    [currentModuleId, currentStepId, completedModuleIds, overallCompletion, persistState]
  );

  // Advance to next step
  const advanceStep = useCallback((): boolean => {
    if (!currentStep) return false;

    // Mark current step complete
    const updatedCompletedSteps = completedStepIds.includes(currentStep.id)
      ? completedStepIds
      : [...completedStepIds, currentStep.id];
    setCompletedStepIds(updatedCompletedSteps);

    // Check if module is completed
    const currentModuleSteps = stepRegistry.getStepsForModule(currentStep.moduleId);
    const allModuleStepsComplete = currentModuleSteps.every((s) => updatedCompletedSteps.includes(s.id));

    let updatedCompletedModules = completedModuleIds;
    if (allModuleStepsComplete && !completedModuleIds.includes(currentStep.moduleId)) {
      updatedCompletedModules = [...completedModuleIds, currentStep.moduleId];
      setCompletedModuleIds(updatedCompletedModules);
    }

    const next = stepRegistry.getNextStep(currentStep.id);
    if (next) {
      setCurrentModuleId(next.moduleId);
      setCurrentStepId(next.id);
      captureStepBaseline();
      persistState(next.moduleId, next.id, updatedCompletedSteps, updatedCompletedModules, false);
      return true;
    } else {
      // Reached the end of all modules!
      setOverallCompletion(true);
      setIsActive(false);
      persistState(currentStep.moduleId, currentStep.id, updatedCompletedSteps, updatedCompletedModules, true);
      return false;
    }
  }, [currentStep, completedStepIds, completedModuleIds, captureStepBaseline, persistState]);

  // Return to previous step
  const previousStep = useCallback((): boolean => {
    if (!currentStep) return false;
    const prev = stepRegistry.getPreviousStep(currentStep.id);
    if (!prev) return false;

    setCurrentModuleId(prev.moduleId);
    setCurrentStepId(prev.id);
    captureStepBaseline();
    return true;
  }, [currentStep, captureStepBaseline]);

  // Skip tutorial
  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    setIsTutorialMinimized(false);
  }, []);

  // Restart tutorial from beginning
  const restartTutorial = useCallback(() => {
    const firstStep = stepRegistry.getAllSteps()[0];
    if (!firstStep) return;

    setCurrentModuleId(firstStep.moduleId);
    setCurrentStepId(firstStep.id);
    setCompletedStepIds([]);
    setCompletedModuleIds([]);
    setOverallCompletion(false);
    setIsActive(true);
    setIsPaused(false);
    setIsTutorialMinimized(false);
    captureStepBaseline();
    persistState(firstStep.moduleId, firstStep.id, [], [], false);
  }, [captureStepBaseline, persistState]);

  // Reset progress independently of simulation save
  const resetTutorialProgress = useCallback(() => {
    tutorialPersistence.reset();
    const firstStep = stepRegistry.getAllSteps()[0];
    if (firstStep) {
      setCurrentModuleId(firstStep.moduleId);
      setCurrentStepId(firstStep.id);
    }
    setCompletedStepIds([]);
    setCompletedModuleIds([]);
    setOverallCompletion(false);
    setIsActive(false);
    setIsPaused(false);
    setIsTutorialMinimized(false);
    setInspectModeActive(false);
    setHandbookOpen(false);
    setInteractionSignals({});
  }, []);

  // Inspect mode toggle
  const setInspectMode = useCallback((active: boolean) => {
    setInspectModeActive(active);
    if (active) {
      setHandbookOpen(false);
    }
  }, []);

  // Handbook controls
  const openHandbook = useCallback((articleId?: string) => {
    setHandbookOpen(true);
    setActiveHandbookArticleId(articleId);
  }, []);

  const closeHandbook = useCallback(() => {
    setHandbookOpen(false);
  }, []);

  // Emit UI interaction signal
  const emitSignal = useCallback((signalKey: string) => {
    setInteractionSignals((prev) => ({
      ...prev,
      [signalKey]: true,
    }));
  }, []);

  const value: TutorialContextValue = useMemo(
    () => ({
      state,
      currentStep,
      currentModule,
      lastVerificationResult,
      isTutorialMinimized,
      startTutorial,
      pauseTutorial,
      resumeTutorial,
      minimizeTutorial,
      restoreTutorial,
      advanceStep,
      previousStep,
      skipTutorial,
      restartTutorial,
      completeStep,
      resetTutorialProgress,
      setInspectMode,
      openHandbook,
      closeHandbook,
      emitSignal,
      verifyCurrentStep,
    }),
    [
      state,
      currentStep,
      currentModule,
      lastVerificationResult,
      isTutorialMinimized,
      startTutorial,
      pauseTutorial,
      resumeTutorial,
      minimizeTutorial,
      restoreTutorial,
      advanceStep,
      previousStep,
      skipTutorial,
      restartTutorial,
      completeStep,
      resetTutorialProgress,
      setInspectMode,
      openHandbook,
      closeHandbook,
      emitSignal,
      verifyCurrentStep,
    ]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};

/**
 * Hook to access the tutorial controller.
 */
export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
