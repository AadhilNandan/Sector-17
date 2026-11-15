import { describe, it, expect } from 'vitest';
import { stepRegistry } from '../src/features/tutorial/data/stepRegistry';
import { HANDBOOK_ARTICLES } from '../src/features/tutorial/data/handbookArticles';

describe('Phase 9.1.2: Tutorial Step Registry & Handbook Integrity', () => {
  it('1. validates that exactly 5 modules are registered', () => {
    const modules = stepRegistry.getAllModules();
    expect(modules.length).toBe(5);

    const moduleIds = modules.map((m) => m.id);
    expect(moduleIds).toEqual([
      'MODULE_01_BRIEFING',
      'MODULE_02_ENGINEERING',
      'MODULE_03_TRAJECTORY',
      'MODULE_04_OPERATIONS',
      'MODULE_05_DEBRIEF',
    ]);
  });

  it('2. validates that all 27 planned steps exist and are accounted for', () => {
    const steps = stepRegistry.getAllSteps();
    expect(steps.length).toBe(27);

    expect(stepRegistry.getStepsForModule('MODULE_01_BRIEFING').length).toBe(4);
    expect(stepRegistry.getStepsForModule('MODULE_02_ENGINEERING').length).toBe(7);
    expect(stepRegistry.getStepsForModule('MODULE_03_TRAJECTORY').length).toBe(6);
    expect(stepRegistry.getStepsForModule('MODULE_04_OPERATIONS').length).toBe(6);
    expect(stepRegistry.getStepsForModule('MODULE_05_DEBRIEF').length).toBe(4);
  });

  it('3. passes comprehensive internal self-testing validation', () => {
    const report = stepRegistry.validate();
    if (!report.isValid) {
      console.error('StepRegistry validation errors:', report.errors);
    }
    expect(report.isValid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.totalModules).toBe(5);
    expect(report.totalSteps).toBe(27);
  });

  it('4. contains zero duplicate step IDs', () => {
    const steps = stepRegistry.getAllSteps();
    const ids = steps.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('5. correctly navigates sequential steps forward and backward across boundaries', () => {
    const firstStep = stepRegistry.getAllSteps()[0];
    const secondStep = stepRegistry.getNextStep(firstStep.id);
    expect(secondStep).toBeDefined();
    expect(secondStep?.id).toBe('tut-01-new-expedition');

    const backToFirst = stepRegistry.getPreviousStep(secondStep!.id);
    expect(backToFirst?.id).toBe(firstStep.id);

    // Across module boundary: last step of Module 1 -> first step of Module 2
    const lastStepMod1 = 'tut-01-configure-spacecraft';
    const firstStepMod2 = stepRegistry.getNextStep(lastStepMod1);
    expect(firstStepMod2).toBeDefined();
    expect(firstStepMod2?.moduleId).toBe('MODULE_02_ENGINEERING');
    expect(firstStepMod2?.id).toBe('tut-02-workshop-overview');
  });

  it('6. verifies all 15 Mission Handbook chapters are fully defined', () => {
    expect(HANDBOOK_ARTICLES.length).toBe(15);

    const chapterNumbers = HANDBOOK_ARTICLES.map((a) => a.chapterNumber);
    expect(chapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    for (const article of HANDBOOK_ARTICLES) {
      expect(article.id).toBeDefined();
      expect(article.title.length).toBeGreaterThan(5);
      expect(article.summary.length).toBeGreaterThan(15);
      expect(article.content.length).toBeGreaterThan(100);
      expect(article.keyTerms.length).toBeGreaterThan(0);
      expect(['VERIFIED_PHYSICS', 'SIMPLIFIED_MODEL', 'GAMEPLAY_ABSTRACTION']).toContain(article.provenance);
    }
  });

  it('7. verifies that every handbook article reference in steps resolves to a real chapter', () => {
    const steps = stepRegistry.getAllSteps();
    const handbookIds = new Set(HANDBOOK_ARTICLES.map((a) => a.id));

    for (const step of steps) {
      if (step.handbookArticleId) {
        expect(handbookIds.has(step.handbookArticleId)).toBe(true);
      }
    }
  });
});
