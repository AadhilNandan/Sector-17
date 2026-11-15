/**
 * SECTOR 17 — Decision History Tracker
 * Maintains an auditable, append-only, immutable history of all mission decision proposals,
 * authorization transitions, validation evaluations, execution telemetry, and consequences.
 *
 * SAFETY INVARIANTS:
 * 1. Timestamps are recorded strictly in Mission Elapsed Time (MET) seconds, NEVER Date.now().
 * 2. Immutable history: records are defensively copied and frozen upon archiving to prevent
 *    retroactive tampering or silent alteration.
 */

import type {
  DecisionRecord,
  DecisionAuthorizationStatus,
  DecisionCategory,
} from './types';

export class DecisionHistoryTracker {
  private history: Map<string, Readonly<DecisionRecord>> = new Map();

  /**
   * Archives a decision record into the immutable history log.
   */
  public archiveRecord(record: DecisionRecord): void {
    if (!record || typeof record !== 'object') {
      throw new TypeError('archiveRecord: record must be an object.');
    }
    if (!record.decisionId || typeof record.decisionId !== 'string') {
      throw new TypeError('archiveRecord: record.decisionId must be a non-empty string.');
    }

    // Create defensive frozen snapshot
    const frozenRecord: Readonly<DecisionRecord> = Object.freeze({
      decisionId: record.decisionId,
      option: Object.freeze({
        ...record.option,
        evidenceReferences: Object.freeze([...record.option.evidenceReferences]),
        prerequisites: Object.freeze([...record.option.prerequisites]),
        resourceRequirements: Object.freeze({ ...record.option.resourceRequirements }),
        riskAssessment: Object.freeze({
          ...record.option.riskAssessment,
          risks: Object.freeze([...record.option.riskAssessment.risks]),
        }),
        validationResult: record.option.validationResult
          ? Object.freeze({
              ...record.option.validationResult,
              reasons: Object.freeze([...record.option.validationResult.reasons]),
              missingResourceMetrics: Object.freeze([
                ...record.option.validationResult.missingResourceMetrics,
              ]),
              constraintViolations: Object.freeze([
                ...record.option.validationResult.constraintViolations,
              ]),
            })
          : undefined,
      }),
      status: record.status,
      proposedAtMET: record.proposedAtMET,
      authorizedAtMET: record.authorizedAtMET,
      authorizationReason: record.authorizationReason,
      executedAtMET: record.executedAtMET,
      executionResult: record.executionResult
        ? Object.freeze({
            ...record.executionResult,
            consequences: Object.freeze([...record.executionResult.consequences]),
          })
        : undefined,
      consequences: Object.freeze([...record.consequences]),
      failureReason: record.failureReason,
    });

    this.history.set(record.decisionId.trim(), frozenRecord);
  }

  public getRecord(decisionId: string): Readonly<DecisionRecord> | undefined {
    return this.history.get(decisionId.trim());
  }

  public getAllRecords(): ReadonlyArray<Readonly<DecisionRecord>> {
    return Array.from(this.history.values());
  }

  public getRecordsByStatus(status: DecisionAuthorizationStatus): Readonly<DecisionRecord>[] {
    return Array.from(this.history.values()).filter((r) => r.status === status);
  }

  public getRecordsByCategory(category: DecisionCategory): Readonly<DecisionRecord>[] {
    return Array.from(this.history.values()).filter((r) => r.option.category === category);
  }

  public getRecordsByTimeRange(startMET: number, endMET: number): Readonly<DecisionRecord>[] {
    return Array.from(this.history.values()).filter(
      (r) => r.proposedAtMET >= startMET && r.proposedAtMET <= endMET
    );
  }

  public getRecordCount(): number {
    return this.history.size;
  }

  public clear(): void {
    this.history.clear();
  }

  public restoreHistory(records: readonly DecisionRecord[]): void {
    this.clear();
    for (const r of records) {
      this.archiveRecord(r);
    }
  }
}

