/**
 * SECTOR 17 — Tutorial Progress Bar Component
 * Phase 9.1.3 Production Implementation
 *
 * Renders a compact, aerospace-style progress indicator tracking active module,
 * current step, and overall curriculum completion derived dynamically from the registry.
 */

import React from 'react';
import type { TutorialModule, TutorialStep } from '../types';
import { stepRegistry } from '../data/stepRegistry';

export interface TutorialProgressBarProps {
  readonly currentModule: TutorialModule | undefined;
  readonly currentStep: TutorialStep | undefined;
  readonly completedStepIds: readonly string[];
}

export const TutorialProgressBar: React.FC<TutorialProgressBarProps> = ({
  currentModule,
  currentStep,
  completedStepIds,
}) => {
  const allSteps = stepRegistry.getAllSteps();
  const allModules = stepRegistry.getAllModules();
  const totalSteps = allSteps.length;
  const totalCompleted = completedStepIds.length;

  const overallPercent = totalSteps > 0 ? Math.round((totalCompleted / totalSteps) * 100) : 0;

  // Step order index within active module
  const moduleSteps = currentModule ? stepRegistry.getStepsForModule(currentModule.id) : [];
  const stepIndexInModule = currentStep
    ? moduleSteps.findIndex((s) => s.id === currentStep.id) + 1
    : 1;

  return (
    <div
      className="w-full flex flex-col gap-1.5 font-mono text-[11px] text-[#A9B0B5] select-none"
      data-testid="tutorial-progress-bar"
    >
      {/* Top Meta: Module Name & Step Progress */}
      <div className="flex items-center justify-between text-[10px] tracking-wider uppercase">
        <span className="text-[#7FB7D4] font-semibold truncate max-w-[220px]">
          {currentModule ? `MOD 0${currentModule.order}: ${currentModule.title}` : 'TRAINING CURRICULUM'}
        </span>
        <span className="text-[#E6E2D6] font-bold">
          STEP {stepIndexInModule} / {moduleSteps.length || 1}
          <span className="text-[#6B757D] ml-1.5">({overallPercent}%)</span>
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1 bg-[#1C242D] rounded-full overflow-hidden flex">
        <div
          className="h-full bg-gradient-to-r from-[#7FB7D4] to-[#8FB8CC] transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
        />
      </div>

      {/* Module Milestone Dots */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        {allModules.map((mod) => {
          const isCurrent = currentModule?.id === mod.id;
          const isCompleted = mod.stepIds.every((id) => completedStepIds.includes(id));

          return (
            <div
              key={mod.id}
              className={`flex-1 h-0.5 rounded-full transition-colors ${
                isCompleted
                  ? 'bg-[#6FAE7C]'
                  : isCurrent
                  ? 'bg-[#7FB7D4]'
                  : 'bg-[#2B3642]'
              }`}
              title={`Module 0${mod.order}: ${mod.title}`}
            />
          );
        })}
      </div>
    </div>
  );
};
