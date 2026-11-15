// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { TutorialProvider, useTutorial } from '../src/features/tutorial/context/TutorialContext';
import { tutorialPersistence } from '../src/features/tutorial/services/tutorialPersistence';

describe('Phase 9.1.2: Tutorial Context & State Machine', () => {
  beforeEach(() => {
    tutorialPersistence.reset();
  });

  afterEach(() => {
    tutorialPersistence.reset();
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <TutorialProvider autoLoadPersistence={false}>{children}</TutorialProvider>;
  };

  it('1. initializes in INACTIVE mode with default first step', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    expect(result.current.state.mode).toBe('INACTIVE');
    expect(result.current.state.isActive).toBe(false);
    expect(result.current.currentModule?.id).toBe('MODULE_01_BRIEFING');
    expect(result.current.currentStep?.id).toBe('tut-01-briefing-directive');
    expect(result.current.state.completedStepIds).toEqual([]);
  });

  it('2. starts guided tutorial and transitions mode to GUIDED', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });

    expect(result.current.state.mode).toBe('GUIDED');
    expect(result.current.state.isActive).toBe(true);
    expect(result.current.state.isPaused).toBe(false);
  });

  it('3. pauses and resumes tutorial cleanly', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });
    expect(result.current.state.isPaused).toBe(false);

    act(() => {
      result.current.pauseTutorial();
    });
    expect(result.current.state.isPaused).toBe(true);

    act(() => {
      result.current.resumeTutorial();
    });
    expect(result.current.state.isPaused).toBe(false);
  });

  it('4. advances to next step and records completed steps', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });
    expect(result.current.currentStep?.id).toBe('tut-01-briefing-directive');

    act(() => {
      const advanced = result.current.advanceStep();
      expect(advanced).toBe(true);
    });

    expect(result.current.currentStep?.id).toBe('tut-01-new-expedition');
    expect(result.current.state.completedStepIds).toContain('tut-01-briefing-directive');
  });

  it('5. navigates back to previous step cleanly', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startTutorial();
      result.current.advanceStep();
    });
    expect(result.current.currentStep?.id).toBe('tut-01-new-expedition');

    act(() => {
      const wentBack = result.current.previousStep();
      expect(wentBack).toBe(true);
    });
    expect(result.current.currentStep?.id).toBe('tut-01-briefing-directive');
  });

  it('6. restarts tutorial from beginning', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });
    act(() => {
      result.current.advanceStep();
    });
    act(() => {
      result.current.advanceStep();
    });
    expect(result.current.state.completedStepIds.length).toBe(2);

    act(() => {
      result.current.restartTutorial();
    });

    expect(result.current.currentStep?.id).toBe('tut-01-briefing-directive');
    expect(result.current.state.completedStepIds).toEqual([]);
    expect(result.current.state.overallCompletion).toBe(false);
  });

  it('7. toggles inspect mode and handbook modal', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.setInspectMode(true);
    });
    expect(result.current.state.mode).toBe('INSPECT');
    expect(result.current.state.inspectModeActive).toBe(true);

    act(() => {
      result.current.openHandbook('art-04-electrical-power');
    });
    expect(result.current.state.mode).toBe('HANDBOOK');
    expect(result.current.state.handbookOpen).toBe(true);
    expect(result.current.state.activeHandbookArticleId).toBe('art-04-electrical-power');

    act(() => {
      result.current.closeHandbook();
    });
    expect(result.current.state.handbookOpen).toBe(false);
  });

  it('8. emits UI interaction signals for step verification', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.emitSignal('camera_preset_changed');
    });

    expect(result.current.state.interactionSignals['camera_preset_changed']).toBe(true);
  });
});
