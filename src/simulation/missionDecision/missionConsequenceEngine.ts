/**
 * SECTOR 17 — Mission Consequence Engine
 * Deterministically computes, applies, and logs physical and operational consequences
 * resulting from executed mission decisions.
 *
 * CONSEQUENCE DOMAINS:
 * - OBJECTIVE_PROGRESS: Updates mission objective progression towards completion.
 * - RESOURCE_EXPENDITURE: Accounts for power draw, propellant burns, and storage bytes.
 * - SUBSYSTEM_STATE_CHANGE: Reconfigures instruments or operational modes.
 * - TELEMETRY_QUEUED: Registers data packets for Deep Space Network transmission.
 * - COMMAND_DISPATCHED: Records command generation through flight computer pathways.
 * - RISK_STATE_CHANGE: Re-evaluates post-decision risk profile.
 * - TIMELINE_EVENT_SCHEDULED: Adds follow-on mission milestones to the event engine.
 */

import type { MissionConsequence, ConsequenceType } from './types';
import type { MissionObjectiveEvaluator } from './missionObjectiveEvaluator';
import type { DecisionEvidenceManager } from './decisionEvidence';
import type { MissionEventEngine } from '../operations/missionEventEngine';

export class MissionConsequenceEngine {
  private consequenceLog: MissionConsequence[] = [];
  private eventEngine?: MissionEventEngine;

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public getEventEngine(): MissionEventEngine | undefined {
    return this.eventEngine;
  }

  /**
   * Records a deterministic mission consequence.
   */
  public recordConsequence(
    type: ConsequenceType,
    description: string,
    affectedTarget: string,
    deltaOrValue: string | number | boolean,
    currentMET: number
  ): MissionConsequence {
    const consequence: MissionConsequence = {
      type,
      description,
      affectedTarget,
      deltaOrValue,
      appliedAtMET: currentMET,
    };

    this.consequenceLog.push(consequence);
    return consequence;
  }

  /**
   * Applies decision consequences to mission objectives and evidence.
   */
  public applyObjectiveProgression(
    objectiveId: string,
    evidenceManager: DecisionEvidenceManager,
    objectiveEvaluator: MissionObjectiveEvaluator,
    currentMET: number
  ): MissionConsequence {
    const report = objectiveEvaluator.evaluateObjective(objectiveId, evidenceManager, currentMET);

    return this.recordConsequence(
      'OBJECTIVE_PROGRESS',
      `Objective '${objectiveId}' updated to state '${report.newState}' (${report.progressPercent.toFixed(1)}% complete).`,
      objectiveId,
      report.progressPercent,
      currentMET
    );
  }

  public getConsequences(): ReadonlyArray<MissionConsequence> {
    return [...this.consequenceLog];
  }

  public clear(): void {
    this.consequenceLog = [];
  }
}
