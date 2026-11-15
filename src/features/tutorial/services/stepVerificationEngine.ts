/**
 * SECTOR 17 — Step Verification Engine
 * Phase 9.1.2 Production Implementation
 *
 * Implements deterministic, read-only evaluation of tutorial step completion conditions
 * against live SimulationSnapshot telemetry, campaign state machine, and interaction signals.
 *
 * CRITICAL RELIABILITY RULE:
 * Never verifies an event-driven step solely on past presence in recentEvents.
 * Enforces baseline timestamps/event counts to prevent stale past events from
 * prematurely verifying new tutorial steps.
 */

import type { VerificationCondition, VerificationContext, VerificationResult } from '../types';
import { CAMPAIGN_STAGES_SEQUENCE } from '../../../campaign/campaignStages';

export class StepVerificationEngine {
  /**
   * Evaluates a step's verification condition against the provided runtime context.
   */
  public evaluate(
    condition: VerificationCondition,
    context: VerificationContext
  ): VerificationResult {
    const { snapshot, currentRoute, stepBaselineMET = 0, stepBaselineEventCount = 0, interactionSignals } = context;

    switch (condition.type) {
      // 1. User Acknowledgement: Always requires explicit user Next / OK signal
      case 'USER_ACKNOWLEDGEMENT': {
        return {
          verified: true,
          autoAdvance: false,
          reason: 'User acknowledged directive.',
        };
      }

      // 2. Route Match: Verifies that the browser is currently at the expected route
      case 'ROUTE_MATCH': {
        const matches = currentRoute === condition.expectedRoute;
        return {
          verified: matches,
          autoAdvance: matches,
          reason: matches
            ? `Navigated to target console: ${condition.expectedRoute}.`
            : `Expected route '${condition.expectedRoute}', but currently on '${currentRoute}'.`,
          recoveryHint: !matches ? `Navigate to ${condition.expectedRoute} to continue.` : undefined,
        };
      }

      // 3. Campaign Stage: Verifies authoritative campaign progression
      case 'CAMPAIGN_STAGE': {
        const currentStageId = snapshot.campaign?.currentStageId;
        if (!currentStageId) {
          return {
            verified: false,
            autoAdvance: false,
            reason: 'Authoritative campaign snapshot unavailable.',
            recoveryHint: 'Wait for campaign initialization.',
          };
        }

        const currentIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStageId);
        const expectedIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(condition.expectedStageId);

        const satisfies = condition.allowLaterStages
          ? currentIdx >= expectedIdx
          : currentStageId === condition.expectedStageId;

        return {
          verified: satisfies,
          autoAdvance: satisfies,
          reason: satisfies
            ? `Campaign reached stage: ${condition.expectedStageId}.`
            : `Current campaign stage is '${currentStageId}'. Required: '${condition.expectedStageId}'.`,
          recoveryHint: !satisfies
            ? `Complete active requirements to advance campaign to ${condition.expectedStageId}.`
            : undefined,
        };
      }

      // 4. Snapshot Boolean: Verifies specific boolean flags
      case 'SNAPSHOT_BOOLEAN': {
        const expected = condition.expectedValue ?? true;
        let actual: boolean = false;

        if (condition.property === 'briefingAcknowledged') {
          actual = Boolean(snapshot.briefingAcknowledged);
        } else if (condition.property === 'isReadinessCertified') {
          actual = Boolean(snapshot.isReadinessCertified);
        } else if (condition.property === 'isLaunchAuthorized') {
          actual = Boolean(snapshot.isLaunchAuthorized);
        }

        const verified = actual === expected;
        return {
          verified,
          autoAdvance: verified,
          reason: verified
            ? `Authoritative flag '${condition.property}' verified as ${String(expected)}.`
            : `Flag '${condition.property}' is ${String(actual)}. Expected: ${String(expected)}.`,
          recoveryHint: !verified
            ? `Perform required action to trigger ${condition.property}.`
            : undefined,
        };
      }

      // 5. Snapshot Value: General property check with optional comparator
      case 'SNAPSHOT_VALUE': {
        const actualValue = (snapshot as unknown as Record<string, unknown>)[condition.property];
        let verified = false;

        const comparator = condition.comparator ?? 'equals';
        if (comparator === 'equals') {
          verified = actualValue === condition.expectedValue;
        } else if (comparator === 'gte') {
          verified = typeof actualValue === 'number' && actualValue >= (condition.expectedValue as number);
        } else if (comparator === 'lte') {
          verified = typeof actualValue === 'number' && actualValue <= (condition.expectedValue as number);
        } else if (comparator === 'includes') {
          verified = Array.isArray(actualValue) && actualValue.includes(condition.expectedValue);
        }

        return {
          verified,
          autoAdvance: verified,
          reason: verified
            ? `Telemetry property '${condition.property}' satisfies condition.`
            : `Telemetry '${condition.property}' does not yet meet target value.`,
          recoveryHint: !verified
            ? `Adjust flight settings until ${condition.property} meets target.`
            : undefined,
        };
      }

      // 6. Event After Baseline: Strictly rejects stale past events
      case 'EVENT_AFTER_BASELINE': {
        const events = snapshot.recentEvents ?? [];
        const runtimeEvents = ((context.runtime as any)?.getEventEngine?.()?.getExecutionHistory?.() ?? []) as readonly any[];
        const combinedEvents = events.length >= runtimeEvents.length ? events : runtimeEvents;

        // Find events of the expected type that executed AFTER step activation
        const newMatchingEvents = combinedEvents.filter((evt, idx) => {
          const type = (evt as any).eventType || (evt as any).type;
          if (type !== condition.eventType) return false;
          if (condition.status && evt.status !== condition.status) return false;

          // Event must either be indexed after the step baseline count OR have executedAt >= baseline MET
          const isAfterCount = idx >= stepBaselineEventCount;
          const executedAt = (evt as any).executedAtSeconds ?? (evt as any).scheduledTimeSeconds ?? 0;
          const isAfterMET = executedAt >= stepBaselineMET;
          return isAfterCount || isAfterMET;
        });

        // Also check if an interactionSignal matching the eventType was dispatched
        const signalMatched = Boolean(
          interactionSignals && (
            interactionSignals[condition.eventType] ||
            interactionSignals[condition.eventType.toLowerCase()]
          )
        );

        const verified = newMatchingEvents.length > 0 || signalMatched;
        return {
          verified,
          autoAdvance: verified,
          reason: verified
            ? `New event '${condition.eventType}' confirmed nominal.`
            : `Awaiting execution of '${condition.eventType}'. Past recorded events disregarded.`,
          recoveryHint: !verified
            ? `Execute the operational command to dispatch ${condition.eventType}.`
            : undefined,
        };
      }

      // 7. Configuration Status: Checks spacecraft engineering validation
      case 'CONFIGURATION_STATUS': {
        const report = snapshot.validationReport;
        const currentStatus = report?.overallStatus;
        const verified = currentStatus !== undefined && condition.allowedStatuses.includes(currentStatus as 'PASS' | 'WARNING');

        const isFail = currentStatus === 'FAIL';
        const failureReason = report?.failures?.[0] ?? 'Configuration constraints violated.';

        return {
          verified,
          autoAdvance: false, // Keep user in control of reviewing configuration
          reason: verified
            ? `Engineering configuration nominal: Status is ${currentStatus}.`
            : `Spacecraft configuration status is ${currentStatus ?? 'UNKNOWN'}. Expected: ${condition.allowedStatuses.join(' or ')}.`,
          recoveryHint: isFail
            ? `Resolve constraint violation: ${failureReason}`
            : undefined,
        };
      }

      // 8. DOM Interaction Signal: Lightweight UI interaction confirmation with authoritative fallback
      case 'DOM_INTERACTION_SIGNAL': {
        const signals = interactionSignals ?? {};
        let verified = Boolean(signals[condition.signalKey]);

        // Authoritative fallback for simulation time stepping
        if (!verified && condition.signalKey === 'time_step_executed') {
          if (typeof snapshot.metSeconds === 'number' && typeof stepBaselineMET === 'number') {
            verified = snapshot.metSeconds > stepBaselineMET;
          }
        }

        return {
          verified,
          autoAdvance: verified,
          reason: verified
            ? `UI interaction signal '${condition.signalKey}' received.`
            : `Awaiting user interaction: ${condition.signalKey}.`,
          recoveryHint: !verified
            ? `Interact with the highlighted element to proceed.`
            : undefined,
        };
      }

      default: {
        return {
          verified: false,
          autoAdvance: false,
          reason: 'Unknown verification condition type.',
        };
      }
    }
  }
}

export const stepVerificationEngine = new StepVerificationEngine();
