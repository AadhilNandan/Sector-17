/**
 * SECTOR 17 — Campaign State Machine
 * Deterministic, validated finite state machine managing the 18 stages
 * of expedition progression with transition history tracking.
 */

import type {
  CampaignStageId,
  CampaignStageStatus,
  StageHistoryRecord,
  CampaignTransitionResult,
} from './campaignTypes';
import { CAMPAIGN_STAGES_SEQUENCE, CAMPAIGN_STAGE_CONFIGS } from './campaignStages';

export class CampaignTransitionError extends Error {
  public readonly fromStage: CampaignStageId;
  public readonly toStage: CampaignStageId;

  constructor(fromStage: CampaignStageId, toStage: CampaignStageId, reason: string) {
    super(`CampaignTransitionError [${fromStage} -> ${toStage}]: ${reason}`);
    this.name = 'CampaignTransitionError';
    this.fromStage = fromStage;
    this.toStage = toStage;
  }
}

export class CampaignStateMachine {
  private currentStageId: CampaignStageId;
  private currentStatus: CampaignStageStatus;
  private completedStages: Set<CampaignStageId>;
  private history: StageHistoryRecord[];
  private failureReason?: string;
  private failureMET?: number;

  constructor(
    initialStageId: CampaignStageId = 'CAMPAIGN_INTRO',
    initialStatus: CampaignStageStatus = 'ACTIVE',
    completedStages: CampaignStageId[] = [],
    history: StageHistoryRecord[] = []
  ) {
    if (!CAMPAIGN_STAGE_CONFIGS[initialStageId]) {
      throw new Error(`CampaignStateMachine: Invalid initial stageId '${initialStageId}'.`);
    }

    this.currentStageId = initialStageId;
    this.currentStatus = initialStatus;
    this.completedStages = new Set(completedStages);
    this.history = [...history];

    if (this.history.length === 0) {
      this.history.push({
        stageId: initialStageId,
        status: initialStatus,
        enteredAtMET: 0,
        notes: ['Campaign initialized.'],
      });
    }
  }

  public getCurrentStageId(): CampaignStageId {
    return this.currentStageId;
  }

  public getStatus(): CampaignStageStatus {
    return this.currentStatus;
  }

  public getCompletedStages(): CampaignStageId[] {
    return Array.from(this.completedStages);
  }

  public getHistory(): readonly StageHistoryRecord[] {
    return this.history;
  }

  public getFailureInfo(): { failureReason?: string; failureMET?: number } {
    return {
      failureReason: this.failureReason,
      failureMET: this.failureMET,
    };
  }

  /**
   * Evaluates whether a transition from current stage to target stage is structurally valid.
   */
  public isValidTransition(toStageId: CampaignStageId): { valid: boolean; reason?: string } {
    if (this.currentStatus === 'FAILED') {
      return {
        valid: false,
        reason: `Cannot transition out of FAILED status (Failure: ${this.failureReason ?? 'Mission aborted'}).`,
      };
    }

    if (this.currentStageId === 'CAMPAIGN_COMPLETED') {
      return {
        valid: false,
        reason: 'Campaign is already COMPLETED. No further transitions permitted.',
      };
    }

    if (!CAMPAIGN_STAGE_CONFIGS[toStageId]) {
      return {
        valid: false,
        reason: `Target stage '${toStageId}' is not a recognized campaign stage.`,
      };
    }

    const currentIndex = CAMPAIGN_STAGES_SEQUENCE.indexOf(this.currentStageId);
    const targetIndex = CAMPAIGN_STAGES_SEQUENCE.indexOf(toStageId);

    // 1. Next sequential stage
    if (targetIndex === currentIndex + 1) {
      return { valid: true };
    }

    // 2. Direct transition to MISSION_DEBRIEF from flight operations (skipping surface/anomaly per Phase 7.5 directive)
    if (
      toStageId === 'MISSION_DEBRIEF' &&
      (this.currentStageId === 'LAUNCH' ||
        this.currentStageId === 'INTERPLANETARY_CRUISE' ||
        this.currentStageId === 'JUPITER_ARRIVAL' ||
        this.currentStageId === 'EUROPA_RECONNAISSANCE' ||
        this.currentStageId === 'SURFACE_MISSION_PREPARATION' ||
        this.currentStageId === 'LANDER_DEPLOYMENT' ||
        this.currentStageId === 'SURFACE_OPERATIONS' ||
        this.currentStageId === 'ANOMALY_INVESTIGATION' ||
        this.currentStageId === 'FINAL_DATA_TRANSMISSION' ||
        this.currentStageId === 'MISSION_EVALUATION')
    ) {
      return { valid: true };
    }

    // 3. Pre-launch redesign rollback (e.g. from ENGINEERING_VALIDATION, MISSION_READINESS, or LAUNCH_AUTHORIZATION back to SPACECRAFT_DESIGN)
    if (
      toStageId === 'SPACECRAFT_DESIGN' &&
      (this.currentStageId === 'ENGINEERING_VALIDATION' ||
        this.currentStageId === 'MISSION_READINESS' ||
        this.currentStageId === 'LAUNCH_AUTHORIZATION')
    ) {
      return { valid: true };
    }

    // 3. Same stage (status update / re-evaluation)
    if (toStageId === this.currentStageId) {
      return { valid: true };
    }

    // Any other arbitrary jumps are strictly rejected
    return {
      valid: false,
      reason: `Direct transition from '${this.currentStageId}' (step ${currentIndex}) to '${toStageId}' (step ${targetIndex}) is invalid. Stages must progress deterministically.`,
    };
  }

  /**
   * Executes a valid transition to the next or target stage.
   */
  public transitionTo(
    toStageId: CampaignStageId,
    currentMET: number,
    options?: {
      markCompleted?: boolean;
      note?: string;
    }
  ): CampaignTransitionResult {
    const validity = this.isValidTransition(toStageId);
    if (!validity.valid) {
      throw new CampaignTransitionError(this.currentStageId, toStageId, validity.reason ?? 'Invalid transition.');
    }

    const fromStage = this.currentStageId;

    if (toStageId === fromStage) {
      // Internal stage status refresh
      return {
        success: true,
        fromStage,
        toStage: toStageId,
        transitionedAtMET: currentMET,
      };
    }

    // Close out previous stage in history
    const prevHistory = this.history[this.history.length - 1];
    if (prevHistory && prevHistory.stageId === fromStage && !prevHistory.completedAtMET) {
      prevHistory.completedAtMET = currentMET;
      prevHistory.status = 'COMPLETED';
      if (options?.note) {
        prevHistory.notes.push(options.note);
      }
    }

    const fromIndex = CAMPAIGN_STAGES_SEQUENCE.indexOf(fromStage);
    const targetIndex = CAMPAIGN_STAGES_SEQUENCE.indexOf(toStageId);

    if (targetIndex < fromIndex) {
      // Rollback transition (e.g. pre-launch redesign): invalidate and prune target and subsequent stages
      for (let i = targetIndex; i < CAMPAIGN_STAGES_SEQUENCE.length; i++) {
        this.completedStages.delete(CAMPAIGN_STAGES_SEQUENCE[i]);
      }
    } else if (options?.markCompleted !== false) {
      for (let i = fromIndex; i < targetIndex; i++) {
        this.completedStages.add(CAMPAIGN_STAGES_SEQUENCE[i]);
      }
    }

    // Advance state
    this.currentStageId = toStageId;
    this.currentStatus = toStageId === 'CAMPAIGN_COMPLETED' ? 'COMPLETED' : 'ACTIVE';

    if (toStageId === 'CAMPAIGN_COMPLETED') {
      this.completedStages.add('CAMPAIGN_COMPLETED');
    }

    // Add entry to history
    this.history.push({
      stageId: toStageId,
      status: this.currentStatus,
      enteredAtMET: currentMET,
      completedAtMET: toStageId === 'CAMPAIGN_COMPLETED' ? currentMET : undefined,
      notes: [options?.note ?? `Entered stage ${toStageId} at MET ${currentMET}s.`],
    });

    return {
      success: true,
      fromStage,
      toStage: toStageId,
      transitionedAtMET: currentMET,
    };
  }

  /**
   * Sets the current stage status to BLOCKED.
   */
  public setBlocked(reason: string, currentMET: number): void {
    if (this.currentStatus === 'FAILED' || this.currentStatus === 'COMPLETED') return;
    this.currentStatus = 'BLOCKED';
    const last = this.history[this.history.length - 1];
    if (last && last.stageId === this.currentStageId) {
      last.status = 'BLOCKED';
      last.notes.push(`Blocked at MET ${currentMET}s: ${reason}`);
    }
  }

  /**
   * Clears BLOCKED status and returns stage to ACTIVE.
   */
  public unblock(currentMET: number): void {
    if (this.currentStatus === 'BLOCKED') {
      this.currentStatus = 'ACTIVE';
      const last = this.history[this.history.length - 1];
      if (last && last.stageId === this.currentStageId) {
        last.status = 'ACTIVE';
        last.notes.push(`Unblocked at MET ${currentMET}s.`);
      }
    }
  }

  /**
   * Authoritatively transitions the campaign into FAILED status.
   */
  public fail(reason: string, currentMET: number): void {
    this.currentStatus = 'FAILED';
    this.failureReason = reason;
    this.failureMET = currentMET;

    const last = this.history[this.history.length - 1];
    if (last && last.stageId === this.currentStageId) {
      last.status = 'FAILED';
      last.failedAtMET = currentMET;
      last.failureReason = reason;
      last.notes.push(`Stage failed at MET ${currentMET}s: ${reason}`);
    }
  }
}
