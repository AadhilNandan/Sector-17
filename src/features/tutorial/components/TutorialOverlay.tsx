/**
 * SECTOR 17 — Tutorial Overlay Controller
 * Phase 9.1.3 Production Implementation
 *
 * Coordinates active spotlight reticle and floating directive dialog.
 * Continuously evaluates step verification conditions against authoritative simulation state.
 * Returns null when tutorial is inactive, ensuring zero visual or layout intrusion.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialDialog } from './TutorialDialog';
import { useLocation } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { useSimulationSnapshot } from '../../../runtime';

export const TutorialOverlay: React.FC = () => {
  const {
    state,
    currentStep,
    currentModule,
    lastVerificationResult,
    isTutorialMinimized,
    minimizeTutorial,
    restoreTutorial,
    advanceStep,
    previousStep,
    pauseTutorial,
    resumeTutorial,
    skipTutorial,
    openHandbook,
    verifyCurrentStep,
    emitSignal,
  } = useTutorial();

  const [targetFound, setTargetFound] = useState<boolean>(false);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);

  // Safely subscribe to simulation snapshot when mounted inside SimulationProvider
  let snap: unknown = null;
  try {
    snap = useSimulationSnapshot();
  } catch {
    // Graceful fallback for tests outside SimulationProvider
  }

  // Safely read location if inside React Router context
  let currentPath = '/';
  try {
    const location = useLocation();
    currentPath = location.pathname;
  } catch {
    currentPath = currentStep?.route ?? '/';
  }

  // Evaluate verification condition on mount, step change, route change, and telemetry updates
  const runVerification = useCallback(() => {
    if (!state.isActive || state.isPaused || isTutorialMinimized || !currentStep) return;
    const res = verifyCurrentStep({ currentRoute: currentPath, domElementFound: targetFound });

    // Auto-advance if verification allows it
    if (res.verified && res.autoAdvance && currentStep.autoAdvanceOnVerify) {
      advanceStep();
    }
  }, [state.isActive, state.isPaused, isTutorialMinimized, currentStep, currentPath, targetFound, verifyCurrentStep, advanceStep]);

  useEffect(() => {
    runVerification();
  }, [runVerification, snap]);

  // Periodic evaluation while active (e.g. 250ms) to ensure instant reaction to asynchronous events
  useEffect(() => {
    if (!state.isActive || state.isPaused || isTutorialMinimized || !currentStep) return;
    const timer = setInterval(() => {
      runVerification();
    }, 250);
    return () => clearInterval(timer);
  }, [state.isActive, state.isPaused, isTutorialMinimized, currentStep, runVerification]);

  // Listen for operational events dispatched across the application
  useEffect(() => {
    const handleTutorialEvent = (e: Event) => {
      const custom = e as CustomEvent<{ type?: string }>;
      if (custom.detail?.type) {
        emitSignal(custom.detail.type);
        emitSignal(custom.detail.type.toLowerCase());
      }
      runVerification();
    };

    window.addEventListener('sector17:tutorial-event', handleTutorialEvent);
    return () => {
      window.removeEventListener('sector17:tutorial-event', handleTutorialEvent);
    };
  }, [emitSignal, runVerification]);

  // Global click observer for special modal actions (like science processing batch)
  useEffect(() => {
    if (!state.isActive || state.isPaused || isTutorialMinimized || !currentStep) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const triggerEl = target.closest('[data-tutorial-id]');
      const tutorialId = triggerEl?.getAttribute('data-tutorial-id');

      if (tutorialId === 'btn-process-observation-batch') {
        emitSignal('SCIENCE_OBSERVATION_PROCESSED');
        emitSignal('science_observation_processed');
        runVerification();
      } else if (tutorialId === 'btn-header-drop-lander') {
        emitSignal('LANDER_DEPLOYMENT_CONFIRMED');
        emitSignal('lander_deployment_confirmed');
        runVerification();
      } else if (tutorialId === 'btn-archive-expedition') {
        emitSignal('MISSION_DEBRIEF_ARCHIVED');
        emitSignal('mission_debrief_archived');
        runVerification();
      }
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [state.isActive, state.isPaused, isTutorialMinimized, currentStep, emitSignal, runVerification]);

  // Listen for real user interaction with target element to satisfy DOM_INTERACTION_SIGNAL
  useEffect(() => {
    if (!state.isActive || state.isPaused || isTutorialMinimized || !currentStep) return;
    if (currentStep.verification.type !== 'DOM_INTERACTION_SIGNAL') return;

    const signalKey = currentStep.verification.signalKey;
    const targetId = currentStep.targetId;

    const handleInteraction = () => {
      emitSignal(signalKey);
    };

    const findTarget = () => {
      return (
        document.querySelector(`[data-tutorial-id="${targetId}"]`) ||
        document.getElementById(targetId) ||
        document.querySelector(`.${targetId}`)
      );
    };

    const attachListeners = (el: Element) => {
      el.addEventListener('click', handleInteraction, { capture: true });
      el.addEventListener('input', handleInteraction, { capture: true });
      el.addEventListener('change', handleInteraction, { capture: true });
      return () => {
        el.removeEventListener('click', handleInteraction, { capture: true });
        el.removeEventListener('input', handleInteraction, { capture: true });
        el.removeEventListener('change', handleInteraction, { capture: true });
      };
    };

    let cleanupListeners: (() => void) | undefined;
    const initialEl = findTarget();
    if (initialEl) {
      cleanupListeners = attachListeners(initialEl);
    }

    // Observe body for target mounting if rendered dynamically
    const observer = new MutationObserver(() => {
      if (!cleanupListeners) {
        const el = findTarget();
        if (el) {
          cleanupListeners = attachListeners(el);
        }
      }
    });

    if (typeof document !== 'undefined' && document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cleanupListeners?.();
      observer.disconnect();
    };
  }, [state.isActive, state.isPaused, currentStep, emitSignal]);

  // If tutorial is inactive, render nothing
  if (!state.isActive || !currentStep) {
    return null;
  }

  // Workstream A: When tutorial is minimized, completely unmount spotlight and dialog,
  // leaving all underlying workspace and spacecraft controls directly accessible,
  // and render a compact aerospace restore button at bottom-right.
  if (isTutorialMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 pointer-events-auto select-none" data-testid="tutorial-minimized-container">
        <button
          type="button"
          onClick={restoreTutorial}
          className="flex items-center gap-2 px-3 py-2 rounded bg-[#0D1116]/95 hover:bg-[#151B22] text-[#7FB7D4] hover:text-[#E6E2D6] border border-[#7FB7D4]/40 hover:border-[#7FB7D4] shadow-2xl backdrop-blur-md font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer animate-fade-in"
          data-testid="tutorial-restore-button"
          title="Resume Tutorial (M)"
          aria-label="Resume Tutorial"
        >
          <Maximize2 size={13} className="text-[#7FB7D4]" />
          <span>TUTORIAL — RESUME</span>
          <span className="text-[10px] px-1 py-0.5 rounded bg-[#1C242D] text-[#A9B0B5] border border-[#2B3642]">M</span>
        </button>
      </div>
    );
  }

  // Handle Target Found callback from Spotlight
  const handleTargetFound = (found: boolean) => {
    setTargetFound(found);
  };

  return (
    <>
      {/* 1. Spotlight Reticle: highlights target control if present */}
      {!state.isPaused && (
        <TutorialSpotlight
          targetId={currentStep.targetId}
          onTargetFound={handleTargetFound}
        />
      )}

      {/* 2. Directive Dialog: instruction card */}
      <TutorialDialog
        currentModule={currentModule}
        currentStep={currentStep}
        completedStepIds={state.completedStepIds}
        verificationResult={lastVerificationResult}
        isPaused={state.isPaused}
        targetFound={targetFound}
        position={dialogPosition}
        onPositionChange={setDialogPosition}
        onAdvance={advanceStep}
        onPrevious={previousStep}
        onPauseToggle={() => (state.isPaused ? resumeTutorial() : pauseTutorial())}
        onSkip={skipTutorial}
        onOpenHandbook={openHandbook}
        onMinimize={minimizeTutorial}
      />
    </>
  );
};
