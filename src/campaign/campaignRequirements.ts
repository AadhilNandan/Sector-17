/**
 * SECTOR 17 — Campaign Requirements Evaluator
 * Evaluates entry criteria, completion gates, failure conditions, and blockers
 * for campaign stages using authoritative simulation telemetry.
 */

import type {
  CampaignStageId,
  CampaignEvaluationContext,
} from './campaignTypes';
import { CAMPAIGN_STAGE_CONFIGS, CAMPAIGN_STAGES_SEQUENCE } from './campaignStages';

export interface StageRequirementsEvaluation {
  canEnter: boolean;
  isComplete: boolean;
  isFailed: boolean;
  failureReason?: string;
  blockers: string[];
  entryReasons: string[];
  completionReasons: string[];
}

export class CampaignRequirementsEvaluator {
  /**
   * Evaluates all gates (entry, completion, failure) for a target stage.
   */
  public evaluateStage(
    stageId: CampaignStageId,
    context: CampaignEvaluationContext
  ): StageRequirementsEvaluation {
    const config = CAMPAIGN_STAGE_CONFIGS[stageId];
    if (!config) {
      throw new Error(`CampaignRequirementsEvaluator: Unknown stageId '${stageId}'.`);
    }

    const blockers: string[] = [];
    const entryReasons: string[] = [];
    const completionReasons: string[] = [];

    // 1. Evaluate Failure Conditions
    let isFailed = false;
    let failureReason: string | undefined;

    if (config.failureConditions && config.failureConditions.length > 0) {
      for (const cond of config.failureConditions) {
        try {
          const res = cond.evaluator(context);
          if (res.triggered) {
            isFailed = true;
            failureReason = res.failureReason ?? `Failure condition '${cond.id}' triggered.`;
            blockers.push(`MISSION FAILURE: ${failureReason}`);
            break;
          }
        } catch (err: any) {
          blockers.push(`Evaluation error in failure condition '${cond.id}': ${err.message}`);
        }
      }
    }

    // 2. Evaluate Entry Requirements
    let canEnter = true;
    for (const req of config.entryRequirements) {
      try {
        const res = req.evaluator(context);
        if (!res.satisfied) {
          canEnter = false;
          const msg = res.reason ?? `Unmet entry requirement: ${req.title}`;
          entryReasons.push(msg);
          if (req.isMandatory) {
            blockers.push(msg);
          }
        }
      } catch (err: any) {
        canEnter = false;
        const msg = `Evaluation error in entry requirement '${req.id}': ${err.message}`;
        entryReasons.push(msg);
        blockers.push(msg);
      }
    }

    // 3. Evaluate Completion Requirements
    let isComplete = true;
    for (const req of config.completionRequirements) {
      try {
        const res = req.evaluator(context);
        if (!res.satisfied) {
          isComplete = false;
          const msg = res.reason ?? `Unmet completion requirement: ${req.title}`;
          completionReasons.push(msg);
          if (req.isMandatory && req.type === 'SUBSYSTEM_STATE') {
            blockers.push(msg);
          }
        }
      } catch (err: any) {
        isComplete = false;
        const msg = `Evaluation error in completion requirement '${req.id}': ${err.message}`;
        completionReasons.push(msg);
        blockers.push(msg);
      }
    }

    return {
      canEnter,
      isComplete: isComplete && !isFailed,
      isFailed,
      failureReason,
      blockers,
      entryReasons,
      completionReasons,
    };
  }

  /**
   * Computes meaningful campaign progress percent based on stages completed and current stage objectives.
   */
  public computeProgressPercent(
    completedStages: readonly CampaignStageId[],
    currentStageId: CampaignStageId,
    context: CampaignEvaluationContext
  ): number {
    const totalStages = CAMPAIGN_STAGES_SEQUENCE.length;
    if (totalStages === 0) return 0;

    const baseProgress = (completedStages.length / totalStages) * 100;
    if (currentStageId === 'CAMPAIGN_COMPLETED' || completedStages.includes('CAMPAIGN_COMPLETED')) {
      return 100;
    }

    // Fractional progress for active stage
    const currentConfig = CAMPAIGN_STAGE_CONFIGS[currentStageId];
    if (!currentConfig || currentConfig.completionRequirements.length === 0) {
      return Math.min(100, Math.round(baseProgress));
    }

    let satisfiedCount = 0;
    for (const req of currentConfig.completionRequirements) {
      try {
        if (req.evaluator(context).satisfied) {
          satisfiedCount++;
        }
      } catch {
        // Ignore evaluation errors in fractional progress calculation
      }
    }

    const currentStageFraction = satisfiedCount / currentConfig.completionRequirements.length;
    const stageWeight = (1 / totalStages) * 100;
    const totalPercent = baseProgress + currentStageFraction * stageWeight;

    return Math.min(100, Math.round(totalPercent * 10) / 10);
  }
}
