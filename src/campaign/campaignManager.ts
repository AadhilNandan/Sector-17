/**
 * SECTOR 17 — Campaign Progression Manager
 * Central authoritative orchestrator connecting the 18-stage campaign state machine,
 * simulation runtime, requirement evaluators, deterministic event bridge, and local persistence.
 */

import type { SimulationRuntime } from '../runtime/simulationRuntime';
import type { SimulationSnapshot } from '../runtime/types';
import type {
  CampaignStageId,
  CampaignStageStatus,
  CampaignStageConfig,
  CampaignSnapshot,
  CampaignTransitionResult,
  CampaignEvaluationContext,
  CampaignSaveData,
} from './campaignTypes';
import { CAMPAIGN_STAGE_CONFIGS, CAMPAIGN_STAGES_SEQUENCE } from './campaignStages';
import { CampaignStateMachine } from './campaignStateMachine';
import { CampaignRequirementsEvaluator } from './campaignRequirements';
import { CampaignEventBridge } from './campaignEventBridge';
import { CampaignPersistenceEngine, CURRENT_SAVE_SCHEMA_VERSION } from './campaignPersistence';

export interface CampaignManagerOptions {
  campaignId?: string;
  initialStageId?: CampaignStageId;
  runtime?: SimulationRuntime;
  persistence?: CampaignPersistenceEngine;
  autoPersist?: boolean;
}

export class CampaignManager {
  private readonly campaignId: string;
  private autoPersist: boolean;
  private stateMachine!: CampaignStateMachine;
  private requirementsEvaluator: CampaignRequirementsEvaluator;
  private eventBridge: CampaignEventBridge;
  private persistence: CampaignPersistenceEngine;
  private runtime?: SimulationRuntime;

  private runtimeUnsubscribe?: () => void;
  private listeners: Set<() => void> = new Set();
  private activeBlockers: string[] = [];
  private pendingRuntimeSnapshot?: any;

  constructor(options: CampaignManagerOptions = {}) {
    this.campaignId = options.campaignId?.trim() || 'default-campaign';
    this.autoPersist = options.autoPersist ?? false;
    this.requirementsEvaluator = new CampaignRequirementsEvaluator();
    this.persistence = options.persistence ?? new CampaignPersistenceEngine();
    this.eventBridge = new CampaignEventBridge(this);

    let loaded = false;
    if (this.autoPersist) {
      loaded = this.loadSync();
    }

    if (!loaded) {
      this.stateMachine = new CampaignStateMachine(options.initialStageId ?? 'CAMPAIGN_INTRO');
    }

    if (options.runtime) {
      this.attachRuntime(options.runtime);
    }
  }

  public getCampaignId(): string {
    return this.campaignId;
  }

  public getCurrentStageId(): CampaignStageId {
    return this.stateMachine.getCurrentStageId();
  }

  public getCurrentStageConfig(): CampaignStageConfig {
    return CAMPAIGN_STAGE_CONFIGS[this.getCurrentStageId()];
  }

  public getStatus(): CampaignStageStatus {
    return this.stateMachine.getStatus();
  }

  public getCompletedStages(): CampaignStageId[] {
    return this.stateMachine.getCompletedStages();
  }

  public getHistory() {
    return this.stateMachine.getHistory();
  }

  public getActiveBlockers(): readonly string[] {
    return [...this.activeBlockers];
  }

  public getEventBridge(): CampaignEventBridge {
    return this.eventBridge;
  }

  public getPersistence(): CampaignPersistenceEngine {
    return this.persistence;
  }

  public getStateMachine(): CampaignStateMachine {
    return this.stateMachine;
  }

  /**
   * Connects the campaign manager to an active SimulationRuntime instance.
   */
  public attachRuntime(runtime: SimulationRuntime): void {
    this.detachRuntime();
    this.runtime = runtime;

    // Restore any pending runtime snapshot restored during early loadSync
    if (this.pendingRuntimeSnapshot) {
      try {
        runtime.restoreSaveSnapshot(this.pendingRuntimeSnapshot);
      } catch {
        // Fallback
      }
      this.pendingRuntimeSnapshot = undefined;
    }

    // Attach event engine to event bridge
    this.eventBridge.attachEventEngine(runtime.getEventEngine());

    // Subscribe to runtime snapshot changes for reactive requirement evaluation
    this.runtimeUnsubscribe = runtime.subscribe(() => {
      const met = runtime.getFlightComputer().getCurrentMETSeconds();
      this.evaluateCurrentStage(met);
    });

    const met = runtime.getFlightComputer().getCurrentMETSeconds();
    this.evaluateCurrentStage(met);
  }

  public detachRuntime(): void {
    if (this.runtimeUnsubscribe) {
      this.runtimeUnsubscribe();
      this.runtimeUnsubscribe = undefined;
    }
    this.eventBridge.detachEventEngine();
    this.runtime = undefined;
  }

  /**
   * Constructs the evaluation context from current simulation state.
   */
  public getEvaluationContext(overrideMET?: number): CampaignEvaluationContext {
    let currentMET = overrideMET ?? 0;
    let snapshot: SimulationSnapshot | undefined;

    if (this.runtime) {
      currentMET = overrideMET ?? this.runtime.getFlightComputer().getCurrentMETSeconds();
      snapshot = this.runtime.getSnapshot();
    }

    return {
      campaignId: this.campaignId,
      currentMET,
      flightComputer: this.runtime?.getFlightComputer(),
      decisionManager: this.runtime?.getDecisionManager(),
      scienceManager: this.runtime?.getScienceManager(),
      commManager: this.runtime?.getCommunicationManager(),
      eventEngine: this.runtime?.getEventEngine(),
      snapshot,
      processedEventIds: this.eventBridge.getProcessedEventIds(),
      processedEventTypes: this.eventBridge.getProcessedEventTypes(),
    };
  }

  /**
   * Directly restores campaign state machine and event bridge from serialized snapshot.
   */
  public restoreState(
    currentStageId: CampaignStageId,
    currentStatus: CampaignStageStatus,
    completedStages: CampaignStageId[],
    history: any[],
    processedEventIds: readonly string[] = [],
    processedEventTypes: readonly string[] = []
  ): void {
    this.stateMachine = new CampaignStateMachine(
      currentStageId,
      currentStatus,
      completedStages,
      history
    );
    this.eventBridge.restore(processedEventIds as string[], processedEventTypes as string[]);
    this.notifyListeners();
  }

  /**
   * Evaluates the current active stage requirements and updates status (ACTIVE vs BLOCKED vs FAILED).
   */
  public evaluateCurrentStage(currentMET?: number): void {
    const met = currentMET ?? this.runtime?.getFlightComputer().getCurrentMETSeconds() ?? 0;
    const currentStageId = this.stateMachine.getCurrentStageId();
    const context = this.getEvaluationContext(met);

    const evalResult = this.requirementsEvaluator.evaluateStage(currentStageId, context);

    if (evalResult.isFailed) {
      this.activeBlockers = evalResult.blockers;
      this.stateMachine.fail(evalResult.failureReason ?? 'Mission failure condition satisfied', met);
      this.notifyListeners();
      return;
    }

    if (evalResult.blockers.length > 0) {
      this.activeBlockers = evalResult.blockers;
      this.stateMachine.setBlocked(evalResult.blockers.join('; '), met);
    } else {
      this.activeBlockers = [];
      this.stateMachine.unblock(met);
    }

    this.notifyListeners();
  }

  /**
   * Checks whether the campaign can progress to a target stage.
   */
  public canProgressTo(targetStageId: CampaignStageId): { canProgress: boolean; reasons: string[] } {
    const currentStageId = this.stateMachine.getCurrentStageId();
    const validity = this.stateMachine.isValidTransition(targetStageId);
    if (!validity.valid) {
      return { canProgress: false, reasons: [validity.reason ?? 'Invalid state transition'] };
    }

    if (targetStageId === currentStageId) {
      return { canProgress: true, reasons: [] };
    }

    // Direct progression to MISSION_DEBRIEF from Mission Operations (skipping surface/anomaly)
    if (targetStageId === 'MISSION_DEBRIEF' && validity.valid) {
      return { canProgress: true, reasons: [] };
    }

    // Check completion criteria of current stage
    const met = this.runtime?.getFlightComputer().getCurrentMETSeconds() ?? 0;
    const ctx = this.getEvaluationContext(met);
    const currentEval = this.requirementsEvaluator.evaluateStage(currentStageId, ctx);

    if (!currentEval.isComplete) {
      return {
        canProgress: false,
        reasons: currentEval.completionReasons.length > 0
          ? currentEval.completionReasons
          : ['Current stage completion requirements not yet satisfied.'],
      };
    }

    // Check entry criteria of target stage
    const targetEval = this.requirementsEvaluator.evaluateStage(targetStageId, ctx);
    if (!targetEval.canEnter) {
      return {
        canProgress: false,
        reasons: targetEval.entryReasons.length > 0
          ? targetEval.entryReasons
          : ['Target stage entry requirements not yet satisfied.'],
      };
    }

    return { canProgress: true, reasons: [] };
  }

  /**
   * Evaluates whether the campaign can advance to the next sequential stage.
   * Prevents self-transition false positives where evaluating currentStageId unconditionally passes.
   */
  public canAdvanceToNextStage(): { canAdvance: boolean; nextStageId?: CampaignStageId; reasons: string[] } {
    const currentStageId = this.stateMachine.getCurrentStageId();
    const currentIndex = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStageId);
    if (currentIndex < 0 || currentIndex >= CAMPAIGN_STAGES_SEQUENCE.length - 1) {
      return {
        canAdvance: false,
        reasons: ['Campaign has reached the terminal stage.'],
      };
    }

    const nextStageId = CAMPAIGN_STAGES_SEQUENCE[currentIndex + 1];
    const check = this.canProgressTo(nextStageId);
    return {
      canAdvance: check.canProgress,
      nextStageId,
      reasons: check.reasons,
    };
  }

  /**
   * Advances the campaign to the next sequential stage, or explicitly specified target stage.
   */
  public advanceToStage(
    targetStageId?: CampaignStageId,
    options?: { note?: string }
  ): CampaignTransitionResult {
    const currentStageId = this.stateMachine.getCurrentStageId();
    const met = this.runtime?.getFlightComputer().getCurrentMETSeconds() ?? 0;

    let destination = targetStageId;
    if (!destination) {
      const currentIndex = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStageId);
      if (currentIndex >= 0 && currentIndex < CAMPAIGN_STAGES_SEQUENCE.length - 1) {
        destination = CAMPAIGN_STAGES_SEQUENCE[currentIndex + 1];
      } else {
        destination = 'CAMPAIGN_COMPLETED';
      }
    }

    const check = this.canProgressTo(destination);
    if (!check.canProgress) {
      return {
        success: false,
        fromStage: currentStageId,
        toStage: destination,
        transitionedAtMET: met,
        blockers: check.reasons,
        failureReason: check.reasons.join('; '),
      };
    }

    const transitionResult = this.stateMachine.transitionTo(destination, met, options);
    this.evaluateCurrentStage(met);
    if (transitionResult.success && this.autoPersist) {
      try {
        this.saveSync();
      } catch {
        // Fallback if in restricted sandbox
      }
    }
    return transitionResult;
  }

  /**
   * Checks whether the player is permitted to access a given screen route.
   * Strictly enforces campaign stage gating while preserving universal access
   * to main menu and campaign overview.
   */
  public canAccessRoute(routePath: string): { allowed: boolean; reason?: string } {
    // Universal routes: Main Menu and Campaign Overview are always accessible
    if (routePath === '/' || routePath === '/campaign') {
      return { allowed: true };
    }

    const currentStageId = this.getCurrentStageId();
    const currentIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStageId);
    const completedStages = this.stateMachine.getCompletedStages();
    const isFailed = this.stateMachine.getStatus() === 'FAILED';

    if (routePath === '/missions') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('MISSION_SELECTION');
      if (currentIdx < minIdx && !completedStages.includes('CAMPAIGN_INTRO')) {
        return {
          allowed: false,
          reason: 'Mission selection requires acknowledging the expedition briefing directive.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/workshop') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('SPACECRAFT_DESIGN');
      if (currentIdx < minIdx && !completedStages.includes('MISSION_SELECTION')) {
        return {
          allowed: false,
          reason: 'Spacecraft workshop requires selecting and confirming the mission target.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/trajectory') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('MISSION_READINESS');
      if (currentIdx < minIdx && !completedStages.includes('ENGINEERING_VALIDATION')) {
        return {
          allowed: false,
          reason: 'Trajectory planning requires completing spacecraft engineering validation.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/decisions') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('LAUNCH_AUTHORIZATION');
      if (currentIdx < minIdx && !completedStages.includes('MISSION_READINESS')) {
        return {
          allowed: false,
          reason: 'Mission decision console requires completing flight readiness certification.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/operations') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('LAUNCH');
      if (currentIdx < minIdx && !completedStages.includes('LAUNCH_AUTHORIZATION')) {
        return {
          allowed: false,
          reason: 'Mission operations telemetry is locked until launch authorization is granted.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/surface') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('SURFACE_OPERATIONS');
      if (currentIdx < minIdx && !completedStages.includes('LANDER_DEPLOYMENT')) {
        return {
          allowed: false,
          reason: 'Surface exploration telemetry is unavailable until lander deployment is confirmed.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/anomaly') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('ANOMALY_INVESTIGATION');
      if (currentIdx < minIdx && !completedStages.includes('SURFACE_OPERATIONS')) {
        return {
          allowed: false,
          reason: 'Subsurface anomaly workspace requires surface reconnaissance evidence.',
        };
      }
      return { allowed: true };
    }

    if (routePath === '/debrief') {
      const minIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('MISSION_DEBRIEF');
      if (currentIdx < minIdx && !isFailed) {
        return {
          allowed: false,
          reason: 'Mission debrief is locked until final science data transmission concludes or mission ends.',
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  /**
   * Triggers authoritative mission failure.
   */
  public failCampaign(reason: string, atMET?: number): void {
    const met = atMET ?? this.runtime?.getFlightComputer().getCurrentMETSeconds() ?? 0;
    this.stateMachine.fail(reason, met);
    this.activeBlockers = [`CRITICAL MISSION FAILURE: ${reason}`];
    if (this.autoPersist) {
      try {
        this.saveSync();
      } catch {
        // Fallback
      }
    }
    this.notifyListeners();
  }

  /**
   * Saves the current campaign and simulation state checkpoint synchronously to local persistence.
   */
  public saveSync(): boolean {
    const met = this.runtime?.getFlightComputer().getCurrentMETSeconds() ?? 0;
    const snap = this.runtime?.getSnapshot();
    const runtimeSnapshot = this.runtime?.exportSaveSnapshot();

    const saveData: CampaignSaveData = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      campaignId: this.campaignId,
      savedAtTimestamp: Date.now(),
      savedAtMET: met,
      currentStageId: this.stateMachine.getCurrentStageId(),
      currentStageStatus: this.stateMachine.getStatus(),
      completedStageIds: this.stateMachine.getCompletedStages(),
      stageHistory: [...this.stateMachine.getHistory()],
      processedEventIds: Array.from(this.eventBridge.getProcessedEventIds()),
      processedEventTypes: Array.from(this.eventBridge.getProcessedEventTypes()),
      activeBlockers: [...this.activeBlockers],
      isCampaignCompleted: this.stateMachine.getCurrentStageId() === 'CAMPAIGN_COMPLETED',
      isCampaignFailed: this.stateMachine.getStatus() === 'FAILED',
      failureMET: this.stateMachine.getFailureInfo().failureMET,
      failureReason: this.stateMachine.getFailureInfo().failureReason,
      simulationStateCheckpoint: snap
        ? {
            flightState: snap.flightState,
            availablePropellantKg: snap.propellantRemainingKg,
            storageUsedBytes: snap.storage.usedBytes,
            subsystemStatuses: snap.subsystems,
          }
        : undefined,
      runtimeSnapshot,
    };

    return this.persistence.saveCampaignSync(saveData);
  }

  /**
   * Saves the current campaign and simulation state checkpoint to local persistence (async wrapper).
   */
  public async save(): Promise<boolean> {
    return this.saveSync();
  }

  /**
   * Restores campaign state synchronously from local persistence.
   */
  public loadSync(): boolean {
    const loadedData = this.persistence.loadCampaignSync(this.campaignId);
    if (!loadedData) {
      return false;
    }

    // 1. Reconstruct state machine
    this.stateMachine = new CampaignStateMachine(
      loadedData.currentStageId,
      loadedData.currentStageStatus,
      loadedData.completedStageIds,
      loadedData.stageHistory
    );

    if (loadedData.isCampaignFailed && loadedData.failureReason) {
      this.stateMachine.fail(loadedData.failureReason, loadedData.failureMET ?? loadedData.savedAtMET);
    }

    // 2. Restore processed event IDs and types to prevent duplicate event execution
    this.eventBridge.restore(loadedData.processedEventIds, loadedData.processedEventTypes);
    this.activeBlockers = loadedData.activeBlockers ?? [];

    // 3. Restore authoritative simulation runtime state if present (CRIT-01)
    if (loadedData.runtimeSnapshot && this.runtime) {
      this.runtime.restoreSaveSnapshot(loadedData.runtimeSnapshot);
    } else if (loadedData.runtimeSnapshot) {
      this.pendingRuntimeSnapshot = loadedData.runtimeSnapshot;
    }

    this.evaluateCurrentStage(loadedData.savedAtMET);
    this.notifyListeners();
    return true;
  }

  /**
   * Restores campaign state from local persistence (async wrapper).
   */
  public async load(): Promise<boolean> {
    return this.loadSync();
  }

  /**
   * Generates a reactive snapshot of campaign state for React components.
   */
  public getSnapshot(): CampaignSnapshot {
    const currentStageId = this.stateMachine.getCurrentStageId();
    const currentStatus = this.stateMachine.getStatus();
    const completedStages = this.stateMachine.getCompletedStages();
    const met = this.runtime?.getFlightComputer().getCurrentMETSeconds() ?? 0;
    const ctx = this.getEvaluationContext(met);

    const progressPercent = this.requirementsEvaluator.computeProgressPercent(
      completedStages,
      currentStageId,
      ctx
    );

    const failInfo = this.stateMachine.getFailureInfo();

    return {
      campaignId: this.campaignId,
      currentStageId,
      currentStageStatus: currentStatus,
      completedStageIds: completedStages,
      stageHistory: this.stateMachine.getHistory(),
      missionElapsedTime: met,
      lastEventId: Array.from(this.eventBridge.getProcessedEventIds()).pop(),
      activeBlockers: this.activeBlockers,
      overallProgressPercent: progressPercent,
      isCampaignCompleted: currentStageId === 'CAMPAIGN_COMPLETED' || completedStages.includes('CAMPAIGN_COMPLETED'),
      isCampaignFailed: currentStatus === 'FAILED',
      failureMET: failInfo.failureMET,
      failureReason: failInfo.failureReason,
      currentStageConfig: CAMPAIGN_STAGE_CONFIGS[currentStageId],
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    };
  }

  /**
   * Subscription listener for UI reactivity.
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Suppress listener error
      }
    }
  }
}
