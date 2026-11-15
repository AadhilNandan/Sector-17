/**
 * SECTOR 17 — Central Tutorial Step Registry
 * Phase 9.1.2 Production Implementation
 *
 * Aggregates all 5 campaign modules and all 27 planned steps into an authoritative,
 * validated single source of truth. Provides lookup indexes and self-testing integrity checks.
 */

import type { TutorialModule, TutorialModuleId, TutorialStep } from '../types';
import { MODULE_01_METADATA, MODULE_01_STEPS } from './modules/module01_missionBriefing';
import { MODULE_02_METADATA, MODULE_02_STEPS } from './modules/module02_spacecraftDesign';
import { MODULE_03_METADATA, MODULE_03_STEPS } from './modules/module03_trajectoryPlanning';
import { MODULE_04_METADATA, MODULE_04_STEPS } from './modules/module04_flightOperations';
import { MODULE_05_METADATA, MODULE_05_STEPS } from './modules/module05_missionDebrief';
import { HANDBOOK_ARTICLES } from './handbookArticles';

export interface RegistryValidationReport {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly totalModules: number;
  readonly totalSteps: number;
}

export class StepRegistry {
  private readonly modules: readonly TutorialModule[];
  private readonly steps: readonly TutorialStep[];
  private readonly stepMap: Map<string, TutorialStep> = new Map();
  private readonly moduleMap: Map<TutorialModuleId, TutorialModule> = new Map();
  private readonly routeStepMap: Map<string, TutorialStep[]> = new Map();

  constructor() {
    this.modules = [
      MODULE_01_METADATA,
      MODULE_02_METADATA,
      MODULE_03_METADATA,
      MODULE_04_METADATA,
      MODULE_05_METADATA,
    ];

    this.steps = [
      ...MODULE_01_STEPS,
      ...MODULE_02_STEPS,
      ...MODULE_03_STEPS,
      ...MODULE_04_STEPS,
      ...MODULE_05_STEPS,
    ];

    // Build lookup maps
    for (const mod of this.modules) {
      this.moduleMap.set(mod.id, mod);
    }

    for (const step of this.steps) {
      this.stepMap.set(step.id, step);

      const routeSteps = this.routeStepMap.get(step.route) ?? [];
      routeSteps.push(step);
      this.routeStepMap.set(step.route, routeSteps);
    }
  }

  public getAllModules(): readonly TutorialModule[] {
    return this.modules;
  }

  public getAllSteps(): readonly TutorialStep[] {
    return this.steps;
  }

  public getStepById(stepId: string): TutorialStep | undefined {
    return this.stepMap.get(stepId);
  }

  public getModuleById(moduleId: TutorialModuleId): TutorialModule | undefined {
    return this.moduleMap.get(moduleId);
  }

  public getStepsForModule(moduleId: TutorialModuleId): readonly TutorialStep[] {
    return this.steps.filter((s) => s.moduleId === moduleId);
  }

  public getStepsForRoute(route: string): readonly TutorialStep[] {
    return this.routeStepMap.get(route) ?? [];
  }

  /**
   * Returns the next sequential step across module boundaries.
   */
  public getNextStep(currentStepId: string): TutorialStep | undefined {
    const idx = this.steps.findIndex((s) => s.id === currentStepId);
    if (idx === -1 || idx === this.steps.length - 1) {
      return undefined;
    }
    return this.steps[idx + 1];
  }

  /**
   * Returns the previous sequential step across module boundaries.
   */
  public getPreviousStep(currentStepId: string): TutorialStep | undefined {
    const idx = this.steps.findIndex((s) => s.id === currentStepId);
    if (idx <= 0) {
      return undefined;
    }
    return this.steps[idx - 1];
  }

  /**
   * Comprehensive validation verifying registry structural integrity and cross-references.
   */
  public validate(): RegistryValidationReport {
    const errors: string[] = [];
    const stepIdsSeen = new Set<string>();
    const handbookIds = new Set(HANDBOOK_ARTICLES.map((a) => a.id));

    // 1. Verify exactly 5 modules
    if (this.modules.length !== 5) {
      errors.push(`Expected exactly 5 tutorial modules, found ${this.modules.length}`);
    }

    // 2. Verify all 27 planned steps
    if (this.steps.length !== 27) {
      errors.push(`Expected exactly 27 total tutorial steps, found ${this.steps.length}`);
    }

    // 3. Verify step ID uniqueness and properties
    for (const step of this.steps) {
      if (stepIdsSeen.has(step.id)) {
        errors.push(`Duplicate step ID detected: '${step.id}'`);
      }
      stepIdsSeen.add(step.id);

      if (!this.moduleMap.has(step.moduleId)) {
        errors.push(`Step '${step.id}' references unknown moduleId: '${step.moduleId}'`);
      }

      if (!step.route || !step.route.startsWith('/')) {
        errors.push(`Step '${step.id}' has invalid route: '${step.route}'`);
      }

      if (!step.targetId || step.targetId.trim().length === 0) {
        errors.push(`Step '${step.id}' is missing mandatory targetId`);
      }

      if (!step.verification || !step.verification.type) {
        errors.push(`Step '${step.id}' is missing valid verification condition`);
      }

      if (step.handbookArticleId && !handbookIds.has(step.handbookArticleId)) {
        errors.push(`Step '${step.id}' references non-existent handbookArticleId: '${step.handbookArticleId}'`);
      }
    }

    // 4. Verify module stepIds match registered steps
    for (const mod of this.modules) {
      for (const stepId of mod.stepIds) {
        const step = this.stepMap.get(stepId);
        if (!step) {
          errors.push(`Module '${mod.id}' references missing stepId: '${stepId}'`);
        } else if (step.moduleId !== mod.id) {
          errors.push(`Module '${mod.id}' references step '${stepId}' whose moduleId is '${step.moduleId}'`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      totalModules: this.modules.length,
      totalSteps: this.steps.length,
    };
  }
}

export const stepRegistry = new StepRegistry();
