/**
 * SECTOR 17 — Campaign Event Bridge
 * Wires MissionEventEngine deterministic event dispatch to the CampaignManager.
 * Enforces duplicate event guards, failure containment, and MET synchronization.
 */

import type { MissionEventEngine } from '../simulation/operations/missionEventEngine';
import type { MissionEvent, MissionExecutionContext } from '../simulation/types';
import type { CampaignManager } from './campaignManager';
import type { CampaignStageId } from './campaignTypes';
import { CAMPAIGN_STAGES_SEQUENCE } from './campaignStages';

export const CAMPAIGN_MANAGED_EVENT_TYPES: readonly string[] = [
  'CAMPAIGN_INITIALIZED',
  'EVT_BRIEFING_ACKNOWLEDGED',
  'BRIEFING_ACKNOWLEDGED',
  'MISSION_SELECTED',
  'SPACECRAFT_CONFIGURED',
  'VALIDATION_COMPLETED',
  'READINESS_CERTIFIED',
  'LAUNCH_AUTHORIZED',
  'LAUNCH_INITIATED',
  'LAUNCH_COMPLETE',
  'TRANS_JOVIAN_INJECTION_COMPLETE',
  'CRUISE_PHASE_ENTERED',
  'MIDCOURSE_CORRECTION_COMPLETE',
  'JUPITER_ARRIVAL',
  'JUPITER_ORBIT_INSERTION_COMPLETE',
  'ORBIT_INSERTION_COMPLETE',
  'EUROPA_FLYBY_COMPLETE',
  'RECONNAISSANCE_DATA_ACQUIRED',
  'LANDING_SITE_SELECTED',
  'PARKING_ORBIT_ASSUMPTION_AUTHORIZED',
  'PARKING_ORBIT_BYPASS_AUTHORIZED',
  'LANDER_DEPLOYED',
  'LANDER_DEPLOYMENT_COMPLETE',
  'LANDER_DESCENT_STARTED',
  'LANDER_TOUCHDOWN',
  'LANDER_DESCENT_FAILURE',
  'SURFACE_SAMPLING_COMPLETE',
  'ROVER_DEPLOYMENT_COMPLETE',
  'ROVER_SYSTEMS_INITIALIZED',
  'SURFACE_TRAVERSE_STARTED',
  'SURFACE_TRAVERSE_COMPLETED',
  'SURFACE_TRAVERSE_FAILED',
  'SURFACE_OBSERVATION_ACQUIRED',
  'SURFACE_DATA_TRANSMITTED',
  'SURFACE_OBJECTIVE_COMPLETED',
  'ANOMALY_DETECTED',
  'ANOMALY_INVESTIGATED',
  'DATA_TRANSMISSION_COMPLETE',
  'MISSION_OBJECTIVES_EVALUATED',
  'MISSION_DEBRIEF_ARCHIVED',
  'CAMPAIGN_COMPLETED',
  'MISSION_ABORT',
] as const;

/**
 * Mapping from event type to stage transition target when applicable.
 */
export const EVENT_TO_STAGE_MAP: Partial<Record<string, CampaignStageId>> = {
  EVT_BRIEFING_ACKNOWLEDGED: 'MISSION_SELECTION',
  BRIEFING_ACKNOWLEDGED: 'MISSION_SELECTION',
  MISSION_SELECTED: 'SPACECRAFT_DESIGN',
  SPACECRAFT_CONFIGURED: 'ENGINEERING_VALIDATION',
  VALIDATION_COMPLETED: 'MISSION_READINESS',
  READINESS_CERTIFIED: 'LAUNCH_AUTHORIZATION',
  LAUNCH_AUTHORIZED: 'LAUNCH',
  LAUNCH_COMPLETE: 'INTERPLANETARY_CRUISE',
  TRANS_JOVIAN_INJECTION_COMPLETE: 'INTERPLANETARY_CRUISE',
  JUPITER_ARRIVAL: 'JUPITER_ARRIVAL',
  JUPITER_ORBIT_INSERTION_COMPLETE: 'EUROPA_RECONNAISSANCE',
  ORBIT_INSERTION_COMPLETE: 'EUROPA_RECONNAISSANCE',
  EUROPA_FLYBY_COMPLETE: 'SURFACE_MISSION_PREPARATION',
  LANDER_DEPLOYMENT_COMPLETE: 'LANDER_DEPLOYMENT',
  LANDER_TOUCHDOWN: 'SURFACE_OPERATIONS',
  SURFACE_SAMPLING_COMPLETE: 'ANOMALY_INVESTIGATION',
  ANOMALY_INVESTIGATED: 'FINAL_DATA_TRANSMISSION',
  DATA_TRANSMISSION_COMPLETE: 'MISSION_EVALUATION',
  MISSION_OBJECTIVES_EVALUATED: 'MISSION_DEBRIEF',
  MISSION_DEBRIEF_ARCHIVED: 'CAMPAIGN_COMPLETED',
};

export class CampaignEventBridge {
  private eventEngine?: MissionEventEngine;
  private campaignManager: CampaignManager;
  private processedEventIds: Set<string> = new Set();
  private processedEventTypes: Set<string> = new Set();
  private registeredHandlers: Map<string, (event: MissionEvent, ctx: MissionExecutionContext) => void> = new Map();

  constructor(
    campaignManager: CampaignManager,
    initialProcessedEventIds: string[] = [],
    initialProcessedEventTypes: string[] = []
  ) {
    this.campaignManager = campaignManager;
    this.processedEventIds = new Set(initialProcessedEventIds);
    this.processedEventTypes = new Set(initialProcessedEventTypes);
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.detachEventEngine();
    this.eventEngine = engine;

    for (const eventType of CAMPAIGN_MANAGED_EVENT_TYPES) {
      const handler = (event: MissionEvent, ctx: MissionExecutionContext) => {
        this.processEvent(event, ctx.metSeconds);
      };
      this.registeredHandlers.set(eventType, handler);
      try {
        engine.registerHandler(eventType, handler);
      } catch {
        // Handler may already be registered or engine in strict test mode
      }
    }
  }

  public detachEventEngine(): void {
    if (this.eventEngine) {
      for (const [eventType] of this.registeredHandlers) {
        try {
          this.eventEngine.unregisterHandler(eventType);
        } catch {
          // Ignore unregister errors during teardown
        }
      }
    }
    this.registeredHandlers.clear();
    this.eventEngine = undefined;
  }

  /**
   * Deterministically processes a mission event with duplicate guards and failure containment.
   */
  public processEvent(
    event: MissionEvent,
    currentMET: number
  ): { processed: boolean; duplicate: boolean; advancedStage?: CampaignStageId; failureReason?: string } {
    if (!event || !event.id) {
      return { processed: false, duplicate: false };
    }

    // 1. Duplicate Guard: Events executed once must never trigger duplicate state mutations
    if (this.processedEventIds.has(event.id)) {
      return { processed: false, duplicate: true };
    }

    this.processedEventIds.add(event.id);
    if (event.type) {
      this.processedEventTypes.add(event.type);
    }

    // 2. Failure Event Containment
    if (
      event.type === 'MISSION_ABORT' ||
      event.type === 'LANDER_DESCENT_FAILURE' ||
      (event.payload && (event.payload as any).failure === true)
    ) {
      const reason =
        (event.payload as any)?.reason ??
        (event.type === 'LANDER_DESCENT_FAILURE' ? 'Lander terminal descent loss' : 'Mission execution abort');
      this.campaignManager.failCampaign(reason, currentMET);
      return { processed: true, duplicate: false, failureReason: reason };
    }

    // 3. Stage Progression Handling
    const targetStage = EVENT_TO_STAGE_MAP[event.type];
    let advancedStage: CampaignStageId | undefined;

    if (targetStage) {
      const currentStage = this.campaignManager.getCurrentStageId();
      const currentIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStage);
      const targetIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(targetStage);
      if (currentStage !== targetStage && targetIdx > currentIdx) {
        const canProgress = this.campaignManager.canProgressTo(targetStage);
        if (canProgress.canProgress) {
          const result = this.campaignManager.advanceToStage(targetStage, {
            note: `Auto-advanced by event '${event.id}' (${event.type}) at MET ${currentMET}s.`,
          });
          if (result.success) {
            advancedStage = targetStage;
          }
        }
      }
    }

    // Also trigger general requirement check on campaign manager
    this.campaignManager.evaluateCurrentStage(currentMET);

    return {
      processed: true,
      duplicate: false,
      advancedStage,
    };
  }

  public getProcessedEventIds(): ReadonlySet<string> {
    return this.processedEventIds;
  }

  public getProcessedEventTypes(): ReadonlySet<string> {
    return this.processedEventTypes;
  }

  public hasProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  public hasProcessedType(eventType: string): boolean {
    return this.processedEventTypes.has(eventType);
  }

  public restoreProcessedEventIds(ids: string[]): void {
    this.processedEventIds = new Set(ids);
  }

  public restore(ids: string[], types?: string[]): void {
    this.processedEventIds = new Set(ids);
    this.processedEventTypes = new Set(types ?? []);
  }
}
