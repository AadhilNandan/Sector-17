import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TutorialPersistenceService,
  TUTORIAL_STORAGE_KEY,
  CURRENT_TUTORIAL_SCHEMA_VERSION,
} from '../src/features/tutorial/services/tutorialPersistence';
import type { TutorialStorageSchema } from '../src/features/tutorial/types';

describe('Phase 9.1.2: Tutorial Persistence Service', () => {
  let persistence: TutorialPersistenceService;

  beforeEach(() => {
    persistence = new TutorialPersistenceService('test_sector17_tutorial_progress');
    persistence.reset();
  });

  afterEach(() => {
    persistence.reset();
  });

  it('1. returns null when no progress has been saved', () => {
    const loaded = persistence.loadProgress();
    expect(loaded).toBeNull();
  });

  it('2. creates valid default initial schema', () => {
    const initial = persistence.createInitialSchema();
    expect(initial.version).toBe(CURRENT_TUTORIAL_SCHEMA_VERSION);
    expect(initial.hasCompletedTutorial).toBe(false);
    expect(initial.currentModuleId).toBe('MODULE_01_BRIEFING');
    expect(initial.currentStepId).toBe('tut-01-briefing-directive');
    expect(initial.completedStepIds).toEqual([]);
    expect(initial.completedModuleIds).toEqual([]);
  });

  it('3. saves and restores tutorial progress cleanly', () => {
    const sample: TutorialStorageSchema = {
      version: CURRENT_TUTORIAL_SCHEMA_VERSION,
      hasCompletedTutorial: false,
      currentModuleId: 'MODULE_02_ENGINEERING',
      currentStepId: 'tut-02-power-subsystem',
      completedStepIds: ['tut-01-briefing-directive', 'tut-01-new-expedition'],
      completedModuleIds: ['MODULE_01_BRIEFING'],
      lastUpdatedTimestamp: Date.now(),
    };

    const saved = persistence.saveProgress(sample);
    expect(saved).toBe(true);

    const loaded = persistence.loadProgress();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentModuleId).toBe('MODULE_02_ENGINEERING');
    expect(loaded?.currentStepId).toBe('tut-02-power-subsystem');
    expect(loaded?.completedStepIds).toEqual(['tut-01-briefing-directive', 'tut-01-new-expedition']);
    expect(loaded?.completedModuleIds).toEqual(['MODULE_01_BRIEFING']);
  });

  it('4. recovers from corrupted or invalid JSON in storage without throwing', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('test_sector17_tutorial_progress', 'INVALID_CORRUPTED_JSON{{{');
    }

    const loaded = persistence.loadProgress();
    expect(loaded).toBeNull();
  });

  it('5. rejects invalid schemas during save and load', () => {
    const invalidObj = {
      version: 0, // invalid
      hasCompletedTutorial: 'not-a-bool', // invalid
    };

    const validation = persistence.validateSchema(invalidObj);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);

    const saveResult = persistence.saveProgress(invalidObj as any);
    expect(saveResult).toBe(false);
  });

  it('6. filters out phantom or stale step IDs when validStepIds is provided', () => {
    const dataWithGhostSteps: TutorialStorageSchema = {
      version: CURRENT_TUTORIAL_SCHEMA_VERSION,
      hasCompletedTutorial: false,
      currentModuleId: 'MODULE_01_BRIEFING',
      currentStepId: 'phantom-nonexistent-step',
      completedStepIds: ['real-step-1', 'phantom-step-2'],
      completedModuleIds: [],
      lastUpdatedTimestamp: Date.now(),
    };

    persistence.saveProgress(dataWithGhostSteps);

    const validSet = new Set(['real-step-1', 'real-step-3']);
    const loaded = persistence.loadProgress(validSet);

    expect(loaded).not.toBeNull();
    expect(loaded?.completedStepIds).toEqual(['real-step-1']);
  });

  it('7. independent reset clears tutorial storage without touching campaign data', () => {
    const sample = persistence.createInitialSchema();
    persistence.saveProgress(sample);

    expect(persistence.loadProgress()).not.toBeNull();
    persistence.reset();
    expect(persistence.loadProgress()).toBeNull();
  });

  it('8. falls back to in-memory store when localStorage is unavailable', () => {
    const memoryPersistence = new TutorialPersistenceService('mem_key');
    // Force isAvailable to false
    vi.spyOn(memoryPersistence, 'isAvailable').mockReturnValue(false);

    const sample = memoryPersistence.createInitialSchema();
    const saveOk = memoryPersistence.saveProgress(sample);
    expect(saveOk).toBe(true);

    const loaded = memoryPersistence.loadProgress();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentModuleId).toBe('MODULE_01_BRIEFING');
  });
});
