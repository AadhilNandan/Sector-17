/**
 * SECTOR 17 — Decision Authorization Engine
 * Enforces strict decision state machine lifecycles:
 * PROPOSED → APPROVED / REJECTED → EXECUTING → EXECUTED / FAILED (or EXPIRED)
 *
 * SAFETY INVARIANTS:
 * 1. Only explicitly APPROVED decisions may enter EXECUTING.
 * 2. REJECTED, EXPIRED, or already EXECUTED/FAILED decisions cannot execute.
 * 3. Duplicate execution transitions are strictly blocked.
 * 4. Deterministic timestamping and reason tracking in Mission Elapsed Time (MET).
 */

import { DECISION_EVENT_TYPES } from './constants';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type {
  DecisionOption,
  DecisionRecord,
  DecisionExecutionResult,
} from './types';

export class DecisionAuthorizationEngine {
  private records: Map<string, DecisionRecord> = new Map();
  private eventEngine?: MissionEventEngine;

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  /**
   * Registers a newly generated decision option as PROPOSED.
   */
  public propose(option: DecisionOption, currentMET: number): DecisionRecord {
    if (!option || typeof option !== 'object') {
      throw new TypeError('propose: option must be an object.');
    }
    if (!option.id || typeof option.id !== 'string') {
      throw new TypeError('propose: option.id must be a non-empty string.');
    }
    if (this.records.has(option.id)) {
      throw new Error(`DecisionAuthorizationEngine.propose: Duplicate decision ID '${option.id}'.`);
    }

    const record: DecisionRecord = {
      decisionId: option.id,
      option: { ...option },
      status: 'PROPOSED',
      proposedAtMET: currentMET,
      consequences: [],
    };

    this.records.set(option.id, record);

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-dec-prop-${option.id}-${currentMET}`,
        type: DECISION_EVENT_TYPES.DECISION_PROPOSED,
        scheduledTimeSeconds: currentMET,
        payload: {
          decisionId: option.id,
          category: option.category,
          title: option.title,
        },
      });
    }

    return record;
  }

  /**
   * Authorizes (APPROVE or REJECT) a proposed decision.
   */
  public authorize(
    decisionId: string,
    approved: boolean,
    reason: string,
    currentMET: number,
    options?: { bypassFeasibilityCheck?: boolean }
  ): DecisionRecord {
    const record = this.records.get(decisionId.trim());
    if (!record) {
      throw new Error(`DecisionAuthorizationEngine.authorize: Decision '${decisionId}' not found.`);
    }

    if (record.status !== 'PROPOSED') {
      throw new Error(
        `DecisionAuthorizationEngine.authorize: Cannot authorize decision '${decisionId}' in status '${record.status}'. Expected 'PROPOSED'.`
      );
    }

    // C-04: Authorization Expiration Enforcement
    // Authorization at expiration MET is permitted (currentMET <= expirationMET);
    // authorization strictly after expiration (currentMET > expirationMET) is rejected.
    if (record.option.expirationMET !== undefined && currentMET > record.option.expirationMET) {
      record.status = 'EXPIRED';
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-dec-exp-${decisionId}-${currentMET}`,
          type: DECISION_EVENT_TYPES.DECISION_EXPIRED,
          scheduledTimeSeconds: currentMET,
          payload: { decisionId, reason: 'Expired prior to authorization' },
        });
      }
      throw new Error(
        `DecisionAuthorizationEngine.authorize: Cannot authorize expired decision '${decisionId}'. Expired at MET ${record.option.expirationMET} s (Current MET: ${currentMET} s).`
      );
    }

    record.authorizedAtMET = currentMET;
    record.authorizationReason = reason.trim();

    if (approved) {
      if (
        !options?.bypassFeasibilityCheck &&
        record.option.validationResult &&
        (record.option.validationResult.status === 'INFEASIBLE' ||
          record.option.validationResult.status === 'INCOMPLETE')
      ) {
        throw new Error(
          `DecisionAuthorizationEngine.authorize: Cannot approve decision '${decisionId}' with validation status '${record.option.validationResult.status}'.`
        );
      }
      record.status = 'APPROVED';
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-dec-appr-${decisionId}-${currentMET}`,
          type: DECISION_EVENT_TYPES.DECISION_APPROVED,
          scheduledTimeSeconds: currentMET,
          payload: { decisionId, reason },
        });
      }
    } else {
      record.status = 'REJECTED';
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-dec-rej-${decisionId}-${currentMET}`,
          type: DECISION_EVENT_TYPES.DECISION_REJECTED,
          scheduledTimeSeconds: currentMET,
          payload: { decisionId, reason },
        });
      }
    }

    return record;
  }

  /**
   * Transitions an APPROVED decision into EXECUTING state.
   */
  public markExecuting(decisionId: string, currentMET: number): DecisionRecord {
    const record = this.records.get(decisionId.trim());
    if (!record) {
      throw new Error(`DecisionAuthorizationEngine.markExecuting: Decision '${decisionId}' not found.`);
    }

    if (record.status !== 'APPROVED') {
      throw new Error(
        `DecisionAuthorizationEngine.markExecuting: Cannot execute decision '${decisionId}' in status '${record.status}'. Only 'APPROVED' decisions may execute.`
      );
    }

    record.status = 'EXECUTING';

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-dec-exec-start-${decisionId}-${currentMET}`,
        type: DECISION_EVENT_TYPES.DECISION_EXECUTION_STARTED,
        scheduledTimeSeconds: currentMET,
        payload: { decisionId },
      });
    }

    return record;
  }

  /**
   * Completes decision execution, recording outcome as EXECUTED or FAILED.
   */
  public markCompleted(
    decisionId: string,
    result: DecisionExecutionResult,
    currentMET: number
  ): DecisionRecord {
    const record = this.records.get(decisionId.trim());
    if (!record) {
      throw new Error(`DecisionAuthorizationEngine.markCompleted: Decision '${decisionId}' not found.`);
    }

    if (record.status !== 'EXECUTING') {
      throw new Error(
        `DecisionAuthorizationEngine.markCompleted: Cannot mark decision '${decisionId}' completed from status '${record.status}'. Expected 'EXECUTING'.`
      );
    }

    record.executedAtMET = currentMET;
    record.executionResult = result;
    record.consequences = [...result.consequences];

    if (result.success) {
      record.status = 'EXECUTED';
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-dec-exec-comp-${decisionId}-${currentMET}`,
          type: DECISION_EVENT_TYPES.DECISION_EXECUTION_COMPLETED,
          scheduledTimeSeconds: currentMET,
          payload: { decisionId, consequencesCount: result.consequences.length },
        });
      }
    } else {
      record.status = 'FAILED';
      record.failureReason = result.errorMessage ?? 'Execution failed.';
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-dec-exec-fail-${decisionId}-${currentMET}`,
          type: DECISION_EVENT_TYPES.DECISION_EXECUTION_FAILED,
          scheduledTimeSeconds: currentMET,
          payload: { decisionId, error: record.failureReason },
        });
      }
    }

    return record;
  }

  /**
   * Marks an un-executed decision as EXPIRED.
   */
  public markExpired(decisionId: string, currentMET: number): DecisionRecord {
    const record = this.records.get(decisionId.trim());
    if (!record) {
      throw new Error(`DecisionAuthorizationEngine.markExpired: Decision '${decisionId}' not found.`);
    }

    if (record.status !== 'PROPOSED') {
      throw new Error(
        `DecisionAuthorizationEngine.markExpired: Cannot expire decision '${decisionId}' in status '${record.status}'.`
      );
    }

    record.status = 'EXPIRED';

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-dec-exp-${decisionId}-${currentMET}`,
        type: DECISION_EVENT_TYPES.DECISION_EXPIRED,
        scheduledTimeSeconds: currentMET,
        payload: { decisionId },
      });
    }

    return record;
  }

  public getRecord(decisionId: string): DecisionRecord | undefined {
    return this.records.get(decisionId.trim());
  }

  public getAllRecords(): DecisionRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
  }

  public restoreRecords(records: readonly DecisionRecord[]): void {
    this.records.clear();
    for (const r of records) {
      this.records.set(r.decisionId, { ...r });
    }
  }
}
