/**
 * SECTOR 17 — Mission Execution Controller
 * Implements the deterministic state machine governing AETHON's operational lifecycle:
 * INITIALIZED -> STANDBY -> ACTIVE -> SAFE_MODE -> RECOVERY -> COMPLETED (or ABORTED)
 *
 * SAFETY INVARIANTS:
 * 1. Strict transition graph validation: invalid transitions throw descriptive errors.
 * 2. SAFE_MODE inhibits nominal science and propulsion maneuvers.
 * 3. Cannot transition to COMPLETED while mandatory mission objectives remain unfulfilled.
 * 4. Recovery to ACTIVE is disallowed while recovery criteria remain unsatisfied.
 * 5. COMPLETED and ABORTED are terminal states; no further transitions are allowed.
 */

import { VALID_MISSION_STATE_TRANSITIONS, FSW_EVENT_TYPES } from './constants';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type {
  MissionExecutionState,
  StateTransitionRecord,
  MissionObjective,
} from './types';

export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateTransitionError';
  }
}

export class IncompleteObjectivesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompleteObjectivesError';
  }
}

export class MissionExecutionController {
  private currentState: MissionExecutionState;
  private transitionHistory: StateTransitionRecord[] = [];
  private objectives: Map<string, MissionObjective> = new Map();
  private eventEngine?: MissionEventEngine;
  private recoveryValidator?: () => boolean;

  constructor(initialState: MissionExecutionState = 'INITIALIZED') {
    this.currentState = initialState;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public setRecoveryValidator(validator: () => boolean): void {
    this.recoveryValidator = validator;
  }

  public getState(): MissionExecutionState {
    return this.currentState;
  }

  public isInSafeMode(): boolean {
    return this.currentState === 'SAFE_MODE';
  }

  public isPrelaunchHold(): boolean {
    return this.currentState === 'PRELAUNCH_HOLD';
  }

  public isPrelaunch(): boolean {
    return (
      this.currentState === 'INITIALIZED' ||
      this.currentState === 'STANDBY' ||
      this.currentState === 'PRELAUNCH_HOLD'
    );
  }

  public isOperational(): boolean {
    return this.currentState === 'ACTIVE';
  }

  public isTerminal(): boolean {
    return this.currentState === 'COMPLETED' || this.currentState === 'ABORTED';
  }

  public getTransitionHistory(): StateTransitionRecord[] {
    return this.transitionHistory.map((t) => ({ ...t }));
  }

  public restoreState(state: MissionExecutionState, history?: StateTransitionRecord[]): void {
    this.currentState = state;
    if (history) {
      this.transitionHistory = history.map((t) => ({ ...t }));
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Mission Objectives Management                                              */
  /* -------------------------------------------------------------------------- */

  public addObjective(objective: MissionObjective): void {
    if (!objective || !objective.id) {
      throw new TypeError('addObjective: Invalid objective specification.');
    }
    this.objectives.set(objective.id, { ...objective });
  }

  public completeObjective(id: string, metSeconds: number): boolean {
    const obj = this.objectives.get(id);
    if (!obj) return false;
    obj.isCompleted = true;
    obj.completedAtMET = metSeconds;
    return true;
  }

  public getObjectives(): MissionObjective[] {
    return Array.from(this.objectives.values()).map((o) => ({ ...o }));
  }

  public areRequiredObjectivesCompleted(): boolean {
    for (const obj of this.objectives.values()) {
      if (obj.isRequired && !obj.isCompleted) {
        return false;
      }
    }
    return true;
  }

  public getIncompleteRequiredObjectives(): MissionObjective[] {
    return Array.from(this.objectives.values()).filter((o) => o.isRequired && !o.isCompleted);
  }

  /* -------------------------------------------------------------------------- */
  /* State Machine Transition Engine                                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Transitions mission to a new execution state.
   *
   * @param nextState Target state
   * @param currentMETSeconds Mission elapsed time
   * @param reason Detailed operational reason for the transition
   */
  public transitionTo(
    nextState: MissionExecutionState,
    currentMETSeconds: number,
    reason: string
  ): void {
    if (typeof currentMETSeconds !== 'number' || !Number.isFinite(currentMETSeconds) || currentMETSeconds < 0) {
      throw new TypeError(`transitionTo: currentMETSeconds must be a non-negative finite number. Received: ${currentMETSeconds}`);
    }
    if (!reason || typeof reason !== 'string') {
      throw new TypeError('transitionTo: A valid reason string must be provided for every state transition.');
    }

    if (this.isTerminal()) {
      throw new InvalidStateTransitionError(
        `transitionTo: Cannot transition from terminal state '${this.currentState}' to '${nextState}'.`
      );
    }

    if (this.currentState === nextState) {
      return; // Already in target state
    }

    const allowable = VALID_MISSION_STATE_TRANSITIONS[this.currentState];
    if (!allowable.includes(nextState)) {
      throw new InvalidStateTransitionError(
        `transitionTo: Illegal state transition from '${this.currentState}' to '${nextState}'. Allowable transitions: [${allowable.join(', ')}].`
      );
    }

    // Guard: COMPLETED requires all mandatory objectives to be satisfied
    if (nextState === 'COMPLETED') {
      const incomplete = this.getIncompleteRequiredObjectives();
      if (incomplete.length > 0) {
        const missing = incomplete.map((o) => `'${o.id}'`).join(', ');
        throw new IncompleteObjectivesError(
          `transitionTo: Cannot complete mission. Mandatory objectives incomplete: ${missing}.`
        );
      }
    }

    // Guard: RECOVERY -> ACTIVE requires recovery validation to pass
    if (this.currentState === 'RECOVERY' && nextState === 'ACTIVE') {
      if (this.recoveryValidator && !this.recoveryValidator()) {
        throw new InvalidStateTransitionError(
          'transitionTo: Cannot transition from RECOVERY to ACTIVE while recovery criteria (e.g. unresolved critical faults) are not met.'
        );
      }
    }

    // Guard: PRELAUNCH_HOLD -> STANDBY requires recovery validation to pass
    if (this.currentState === 'PRELAUNCH_HOLD' && nextState === 'STANDBY') {
      if (this.recoveryValidator && !this.recoveryValidator()) {
        throw new InvalidStateTransitionError(
          'transitionTo: Cannot transition from PRELAUNCH_HOLD to STANDBY while prelaunch critical faults remain active.'
        );
      }
    }

    const prevState = this.currentState;
    this.currentState = nextState;

    const record: StateTransitionRecord = {
      fromState: prevState,
      toState: nextState,
      metSeconds: currentMETSeconds,
      reason,
    };
    this.transitionHistory.push(record);

    // Dispatch typed events
    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-fsw-state-${prevState}-to-${nextState}-${currentMETSeconds}`,
        type: FSW_EVENT_TYPES.MISSION_STATE_CHANGED,
        scheduledTimeSeconds: currentMETSeconds,
        payload: {
          fromState: prevState,
          toState: nextState,
          reason,
        },
      });

      if (nextState === 'SAFE_MODE') {
        this.eventEngine.scheduleEvent({
          id: `evt-fsw-safe-enter-${currentMETSeconds}`,
          type: FSW_EVENT_TYPES.SAFE_MODE_ENTERED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { reason },
        });
      }

      if ((prevState === 'SAFE_MODE' || prevState === 'RECOVERY') && nextState === 'ACTIVE') {
        this.eventEngine.scheduleEvent({
          id: `evt-fsw-safe-exit-${currentMETSeconds}`,
          type: FSW_EVENT_TYPES.SAFE_MODE_EXITED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { reason },
        });
      }

      if (nextState === 'PRELAUNCH_HOLD') {
        this.eventEngine.scheduleEvent({
          id: `evt-fsw-hold-enter-${currentMETSeconds}`,
          type: FSW_EVENT_TYPES.PRELAUNCH_HOLD_ENTERED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { reason },
        });
      }

      if (prevState === 'PRELAUNCH_HOLD' && (nextState === 'STANDBY' || nextState === 'ABORTED')) {
        this.eventEngine.scheduleEvent({
          id: `evt-fsw-hold-exit-${currentMETSeconds}`,
          type: FSW_EVENT_TYPES.PRELAUNCH_HOLD_EXITED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { reason },
        });
      }
    }
  }
}
