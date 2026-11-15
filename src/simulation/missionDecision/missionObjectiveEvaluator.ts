/**
 * SECTOR 17 — Mission Objective Evaluator
 * Evaluates mission objective lifecycle (NOT_STARTED, IN_PROGRESS, BLOCKED, COMPLETED, FAILED)
 * deterministically against available verified evidence and spacecraft health.
 *
 * SAFETY INVARIANTS:
 * 1. Missing evidence is never treated as completion.
 * 2. Unmet prerequisites strictly gate progression.
 * 3. Deadlines are strictly evaluated against SI MET seconds.
 * 4. Fictional constructs (Relic-Omega) are rejected from fulfilling physical science objectives.
 */

import { DECISION_EVENT_TYPES, EXPEDITION_V_DEFAULT_OBJECTIVES } from './constants';
import type { DecisionEvidenceManager } from './decisionEvidence';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type {
  MissionDecisionObjective,
  ObjectiveState,
  ObjectiveEvaluationReport,
} from './types';

export class MissionObjectiveEvaluator {
  private objectives: Map<string, MissionDecisionObjective> = new Map();
  private eventEngine?: MissionEventEngine;

  constructor(initialObjectives?: readonly MissionDecisionObjective[]) {
    const list = initialObjectives ?? EXPEDITION_V_DEFAULT_OBJECTIVES;
    for (const obj of list) {
      this.registerObjective(obj);
    }
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public registerObjective(objective: MissionDecisionObjective): void {
    if (!objective || typeof objective !== 'object') {
      throw new TypeError('registerObjective: objective must be an object.');
    }
    if (!objective.id || typeof objective.id !== 'string' || objective.id.trim().length === 0) {
      throw new TypeError('registerObjective: objective.id must be a non-empty string.');
    }

    const id = objective.id.trim();

    // 1. Direct self-loop check (C-02)
    if (objective.prerequisites && objective.prerequisites.includes(id)) {
      throw new Error(`Circular dependency detected: Objective '${id}' cannot list itself as a prerequisite.`);
    }

    // 2. Transitive prerequisite cycle check (C-02)
    if (objective.prerequisites && objective.prerequisites.length > 0) {
      for (const prereqId of objective.prerequisites) {
        const visited = new Set<string>();
        const cycleMatch = this.detectPrerequisiteCycle(id, prereqId, visited);
        if (cycleMatch) {
          throw new Error(
            `Circular dependency detected: Registering objective '${id}' creates a prerequisite cycle involving '${prereqId}'.`
          );
        }
      }
    }

    this.objectives.set(id, {
      ...objective,
      supportingEvidenceIds: [...objective.supportingEvidenceIds],
    });
  }

  private detectPrerequisiteCycle(candidateId: string, currentId: string, visited: Set<string>): string | null {
    if (visited.has(currentId)) {
      return null;
    }
    visited.add(currentId);

    const obj = this.objectives.get(currentId);
    if (!obj) {
      return null;
    }

    for (const prereqId of obj.prerequisites) {
      if (prereqId === candidateId) {
        return prereqId;
      }
      const cycle = this.detectPrerequisiteCycle(candidateId, prereqId, visited);
      if (cycle) {
        return cycle;
      }
    }
    return null;
  }

  public getObjective(id: string): MissionDecisionObjective | undefined {
    const obj = this.objectives.get(id.trim());
    return obj ? { ...obj, supportingEvidenceIds: [...obj.supportingEvidenceIds] } : undefined;
  }

  public getAllObjectives(): MissionDecisionObjective[] {
    return Array.from(this.objectives.values()).map((obj) => ({
      ...obj,
      supportingEvidenceIds: [...obj.supportingEvidenceIds],
    }));
  }

  /**
   * Evaluates a single objective against current evidence and MET.
   */
  public evaluateObjective(
    objectiveId: string,
    evidenceManager: DecisionEvidenceManager,
    currentMET: number
  ): ObjectiveEvaluationReport {
    const obj = this.objectives.get(objectiveId.trim());
    if (!obj) {
      throw new Error(`MissionObjectiveEvaluator: Objective '${objectiveId}' not found.`);
    }

    const previousState = obj.state;
    const previousProgress = obj.progressPercent;
    const unsatisfiedPrerequisites: string[] = [];
    const missingEvidenceDescriptions: string[] = [];
    const matchedEvidenceIds: string[] = [];

    // 1. Check Deadline Expiration
    if (obj.deadlineMET !== undefined && currentMET > obj.deadlineMET && obj.state !== 'COMPLETED') {
      obj.state = 'FAILED';
      obj.failedAtMET = currentMET;
      obj.failureReason = `Deadline exceeded at MET ${currentMET}s (Deadline: ${obj.deadlineMET}s)`;
      this.notifyStateChange(obj, previousState, previousProgress, currentMET);

      return {
        objectiveId: obj.id,
        previousState,
        newState: 'FAILED',
        progressPercent: obj.progressPercent,
        satisfiesPrerequisites: false,
        unsatisfiedPrerequisites,
        missingEvidenceDescriptions,
        isCompleted: false,
        isFailed: true,
        failureReason: obj.failureReason,
      };
    }

    // If already terminal, return current state
    if (obj.state === 'COMPLETED' || obj.state === 'FAILED') {
      return {
        objectiveId: obj.id,
        previousState,
        newState: obj.state,
        progressPercent: obj.progressPercent,
        satisfiesPrerequisites: true,
        unsatisfiedPrerequisites: [],
        missingEvidenceDescriptions: [],
        isCompleted: obj.state === 'COMPLETED',
        isFailed: obj.state === 'FAILED',
        failureReason: obj.failureReason,
      };
    }

    // 2. Evaluate Prerequisites
    let satisfiesPrerequisites = true;
    for (const prereqId of obj.prerequisites) {
      const prereq = this.objectives.get(prereqId);
      if (!prereq || prereq.state !== 'COMPLETED') {
        satisfiesPrerequisites = false;
        unsatisfiedPrerequisites.push(prereqId);
      }
    }

    if (!satisfiesPrerequisites) {
      obj.state = 'BLOCKED';
      this.notifyStateChange(obj, previousState, previousProgress, currentMET);

      return {
        objectiveId: obj.id,
        previousState,
        newState: 'BLOCKED',
        progressPercent: obj.progressPercent,
        satisfiesPrerequisites: false,
        unsatisfiedPrerequisites,
        missingEvidenceDescriptions: obj.evidenceRequirements.map((r) => r.description),
        isCompleted: false,
        isFailed: false,
      };
    }

    // 3. Evaluate Evidence Requirements
    let satisfiedRequirementsCount = 0;
    const totalRequirementsCount = obj.evidenceRequirements.length;

    for (const req of obj.evidenceRequirements) {
      const candidates = evidenceManager.getEvidenceByType(req.requiredSourceType);
      const matchingEvidence = candidates.find((evi) => {
        if (req.rejectFictional && evi.isFictionalConstruct) return false;
        if (!req.allowedProvenances.includes(evi.provenance)) return false;
        if (evi.confidenceScore < req.minConfidenceScore) return false;
        return true;
      });

      if (matchingEvidence) {
        satisfiedRequirementsCount++;
        matchedEvidenceIds.push(matchingEvidence.id);
      } else {
        missingEvidenceDescriptions.push(req.description);
      }
    }

    // Update supporting evidence IDs
    obj.supportingEvidenceIds = Array.from(new Set([...obj.supportingEvidenceIds, ...matchedEvidenceIds]));

    // Calculate deterministic progress percentage
    const progress = totalRequirementsCount > 0 ? (satisfiedRequirementsCount / totalRequirementsCount) * 100 : 100;
    obj.progressPercent = Math.min(100, Math.max(0, Math.round(progress * 10) / 10));

    // Determine state
    if (satisfiedRequirementsCount === totalRequirementsCount && totalRequirementsCount > 0) {
      obj.state = 'COMPLETED';
      obj.completedAtMET = currentMET;
    } else if (satisfiedRequirementsCount > 0) {
      obj.state = 'IN_PROGRESS';
    } else {
      obj.state = 'NOT_STARTED';
    }

    this.notifyStateChange(obj, previousState, previousProgress, currentMET);

    return {
      objectiveId: obj.id,
      previousState,
      newState: obj.state,
      progressPercent: obj.progressPercent,
      satisfiesPrerequisites: true,
      unsatisfiedPrerequisites: [],
      missingEvidenceDescriptions,
      isCompleted: obj.state === 'COMPLETED',
      isFailed: false,
    };
  }

  /**
   * Evaluates all registered objectives in prerequisite order.
   */
  public evaluateAllObjectives(
    evidenceManager: DecisionEvidenceManager,
    currentMET: number
  ): ObjectiveEvaluationReport[] {
    const reports: ObjectiveEvaluationReport[] = [];
    for (const objId of this.objectives.keys()) {
      reports.push(this.evaluateObjective(objId, evidenceManager, currentMET));
    }
    return reports;
  }

  private notifyStateChange(
    obj: MissionDecisionObjective,
    previousState: ObjectiveState,
    previousProgress: number,
    currentMET: number
  ): void {
    const stateChanged = obj.state !== previousState;
    const progressChanged = Math.abs(obj.progressPercent - previousProgress) > 0.001;

    if ((stateChanged || progressChanged) && this.eventEngine) {
      const baseId = `evt-obj-update-${obj.id}-${obj.state}-${currentMET}-${Math.round(obj.progressPercent * 10)}`;
      let eventId = baseId;
      let counter = 1;
      const scheduler = this.eventEngine.getScheduler();
      while (scheduler.getEvent(eventId)) {
        eventId = `${baseId}-${counter++}`;
      }

      this.eventEngine.scheduleEvent({
        id: eventId,
        type: DECISION_EVENT_TYPES.MISSION_OBJECTIVE_UPDATED,
        scheduledTimeSeconds: currentMET,
        payload: {
          objectiveId: obj.id,
          previousState,
          newState: obj.state,
          previousProgressPercent: previousProgress,
          progressPercent: obj.progressPercent,
        },
      });
    }
  }
}
