/**
 * SECTOR 17 — Tutorial Progress Persistence Service
 * Phase 9.1.2 Production Implementation
 *
 * Provides safe, isolated browser persistence for user onboarding progress under
 * 'sector17_tutorial_progress_v1'. Completely separate from simulation/campaign saves.
 * Includes schema validation, corruption containment, and memory fallback.
 */

import type { TutorialStorageSchema, TutorialModuleId } from '../types';

export const TUTORIAL_STORAGE_KEY = 'sector17_tutorial_progress_v1';
export const CURRENT_TUTORIAL_SCHEMA_VERSION = 1;

export interface StorageValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export class TutorialPersistenceService {
  private readonly storageKey: string;
  private readonly memoryStore: Map<string, string> = new Map();

  constructor(storageKey: string = TUTORIAL_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /**
   * Checks if browser localStorage is supported and accessible.
   */
  public isAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = `__sector17_storage_test_${Date.now()}`;
      window.localStorage.setItem(testKey, 'ok');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates stored progress data against current schema.
   */
  public validateSchema(data: unknown): StorageValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['Stored data must be a non-null object'] };
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.version !== 'number' || obj.version < 1) {
      errors.push('Invalid schema version');
    }

    if (typeof obj.hasCompletedTutorial !== 'boolean') {
      errors.push('hasCompletedTutorial must be a boolean');
    }

    if (typeof obj.currentModuleId !== 'string' || !obj.currentModuleId.startsWith('MODULE_')) {
      errors.push('currentModuleId must be a valid module identifier');
    }

    if (typeof obj.currentStepId !== 'string' || obj.currentStepId.length === 0) {
      errors.push('currentStepId must be a non-empty string');
    }

    if (!Array.isArray(obj.completedStepIds)) {
      errors.push('completedStepIds must be an array');
    }

    if (!Array.isArray(obj.completedModuleIds)) {
      errors.push('completedModuleIds must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Loads persisted tutorial progress from localStorage or memory fallback.
   * If validStepIds is provided, filters out any stored step IDs not in the active registry.
   */
  public loadProgress(validStepIds?: ReadonlySet<string>): TutorialStorageSchema | null {
    try {
      let rawJson: string | null = null;

      if (this.isAvailable()) {
        rawJson = window.localStorage.getItem(this.storageKey);
      } else {
        rawJson = this.memoryStore.get(this.storageKey) ?? null;
      }

      if (!rawJson) {
        return null;
      }

      const parsed = JSON.parse(rawJson);
      const validation = this.validateSchema(parsed);

      if (!validation.isValid) {
        console.warn('TutorialPersistenceService: Corrupted or incompatible schema encountered:', validation.errors);
        return null;
      }

      const schema = parsed as TutorialStorageSchema;

      // Filter against valid step IDs if provided to prevent phantom/stale steps
      if (validStepIds && validStepIds.size > 0) {
        const filteredCompletedSteps = schema.completedStepIds.filter((id) => validStepIds.has(id));
        const currentStepValid = validStepIds.has(schema.currentStepId);

        return {
          ...schema,
          currentStepId: currentStepValid ? schema.currentStepId : (filteredCompletedSteps[0] ?? schema.currentStepId),
          completedStepIds: filteredCompletedSteps,
        };
      }

      return schema;
    } catch (err) {
      console.warn('TutorialPersistenceService: Failed to parse stored progress, returning null:', err);
      return null;
    }
  }

  /**
   * Persists tutorial progress to localStorage or memory fallback.
   */
  public saveProgress(state: TutorialStorageSchema): boolean {
    try {
      const validation = this.validateSchema(state);
      if (!validation.isValid) {
        console.error('TutorialPersistenceService: Refusing to save invalid progress data:', validation.errors);
        return false;
      }

      const rawJson = JSON.stringify(state);

      if (this.isAvailable()) {
        window.localStorage.setItem(this.storageKey, rawJson);
      } else {
        this.memoryStore.set(this.storageKey, rawJson);
      }

      return true;
    } catch (err) {
      console.error('TutorialPersistenceService: Error saving tutorial progress:', err);
      return false;
    }
  }

  /**
   * Resets stored tutorial progress without modifying campaign saves.
   */
  public reset(): void {
    try {
      if (this.isAvailable()) {
        window.localStorage.removeItem(this.storageKey);
      }
      this.memoryStore.delete(this.storageKey);
    } catch (err) {
      console.warn('TutorialPersistenceService: Reset failed non-fatally:', err);
    }
  }

  /**
   * Creates a default initial storage record.
   */
  public createInitialSchema(
    initialModuleId: TutorialModuleId = 'MODULE_01_BRIEFING',
    initialStepId: string = 'tut-01-briefing-directive'
  ): TutorialStorageSchema {
    return {
      version: CURRENT_TUTORIAL_SCHEMA_VERSION,
      hasCompletedTutorial: false,
      currentModuleId: initialModuleId,
      currentStepId: initialStepId,
      completedStepIds: [],
      completedModuleIds: [],
      lastUpdatedTimestamp: Date.now(),
    };
  }
}

export const tutorialPersistence = new TutorialPersistenceService();
