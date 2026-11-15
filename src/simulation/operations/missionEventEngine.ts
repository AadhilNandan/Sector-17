/**
 * SECTOR 17 — Mission Event Engine
 * Coordinates simulation time advancement with deterministic event dispatch,
 * execution recording, error containment, and duplicate execution guards.
 *
 * Designed to be extensible for future space mission phases:
 * - Comm window openings/closings
 * - Trajectory correction maneuvers
 * - Propulsion orbital insertion burns
 * - Power / thermal anomalies
 * - Scientific scans and surface rover milestones
 */

import { TimeController } from './timeController';
import { EventScheduler } from './eventScheduler';
import { DEFAULT_MAX_EVENTS_PER_STEP } from '../constants';
import type {
  MissionEvent,
  EventScheduleInput,
  EventExecutionResult,
  MissionEventHandler,
  MissionExecutionContext,
  TimeStepExecutionReport,
  PruneHistoryOptions,
  PruneHistoryResult,
} from '../types';

export interface AdvanceAndProcessOptions {
  /** If true, advances time and executes due events even if simulation is paused */
  forceWhilePaused?: boolean;
}

/**
 * Deterministic Mission Operations Event Engine
 */
export class MissionEventEngine {
  private timeController: TimeController;
  private scheduler: EventScheduler;
  private handlers: Map<string, MissionEventHandler> = new Map();
  private executionHistory: EventExecutionResult[] = [];
  private isAdvancing: boolean = false;
  private maxEventsPerStep: number = DEFAULT_MAX_EVENTS_PER_STEP;

  constructor(epochTimestampSeconds?: number, startRunning: boolean = true) {
    this.timeController = new TimeController(epochTimestampSeconds, startRunning);
    this.scheduler = new EventScheduler();
  }

  // Time & Clock Delegation
  public getTimeController(): TimeController {
    return this.timeController;
  }

  public getScheduler(): EventScheduler {
    return this.scheduler;
  }

  public getMETSeconds(): number {
    return this.timeController.getMETSeconds();
  }

  public getFormattedMET(): string {
    return this.timeController.getFormattedMET();
  }

  public isPaused(): boolean {
    return this.timeController.isPaused();
  }

  public isRunning(): boolean {
    return this.timeController.isRunning();
  }

  public pause(): void {
    this.timeController.pause();
  }

  public resume(): void {
    this.timeController.resume();
  }

  public reset(): void {
    this.isAdvancing = false;
    this.timeController.reset();
    this.scheduler.clear();
    this.executionHistory = [];
  }

  /**
   * Immediately dispatches, executes and records an event at current simulation MET.
   */
  public emitImmediateEvent<T = unknown, R = unknown>(input: EventScheduleInput<T>): EventExecutionResult<T, R> {
    const scheduled = this.scheduler.schedule(input, input.scheduledTimeSeconds);
    const context: MissionExecutionContext = {
      metSeconds: scheduled.scheduledTimeSeconds,
      currentTimestampSeconds: this.timeController.getClockState().currentTimestampSeconds,
      stepCount: this.timeController.getClockState().stepCount,
    };

    const handler = this.handlers.get(scheduled.type) as MissionEventHandler<T, R> | undefined;
    let handlerResult: R | void = undefined;
    if (handler) {
      try {
        handlerResult = handler(scheduled, context);
      } catch (err) {
        scheduled.status = 'FAILED';
        const failureResult: EventExecutionResult<T, R> = {
          eventId: scheduled.id,
          eventType: scheduled.type,
          scheduledTimeSeconds: scheduled.scheduledTimeSeconds,
          executedAtSeconds: scheduled.scheduledTimeSeconds,
          status: 'FAILED',
          success: false,
          payload: scheduled.payload as T,
          error: err instanceof Error ? err.message : String(err),
        };
        this.executionHistory.push(failureResult as EventExecutionResult);
        return failureResult;
      }
    }

    scheduled.status = 'EXECUTED';
    const successResult: EventExecutionResult<T, R> = {
      eventId: scheduled.id,
      eventType: scheduled.type,
      scheduledTimeSeconds: scheduled.scheduledTimeSeconds,
      executedAtSeconds: scheduled.scheduledTimeSeconds,
      status: 'EXECUTED',
      success: true,
      payload: scheduled.payload as T,
      result: handlerResult as R,
    };
    this.executionHistory.push(successResult as EventExecutionResult);
    return successResult;
  }

  /**
   * Returns whether time advancement is currently active (re-entrancy lock engaged).
   */
  public isAdvanceLocked(): boolean {
    return this.isAdvancing;
  }

  /**
   * Gets the maximum number of events processed within a single simulation step.
   */
  public getMaxEventsPerStep(): number {
    return this.maxEventsPerStep;
  }

  /**
   * Sets the maximum number of events processed within a single simulation step.
   *
   * @param limit Positive integer
   */
  public setMaxEventsPerStep(limit: number): void {
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit)) {
      throw new TypeError(
        `MissionEventEngine.setMaxEventsPerStep: Limit must be a positive integer. Received: ${limit}`
      );
    }
    this.maxEventsPerStep = limit;
  }

  // Handler Registration
  /**
   * Registers a callback handler for a specific event type.
   *
   * @param eventType Event type string identifier
   * @param handler MissionEventHandler callback
   */
  public registerHandler<T = unknown, R = unknown>(
    eventType: string,
    handler: MissionEventHandler<T, R>
  ): void {
    if (!eventType || typeof eventType !== 'string' || eventType.trim().length === 0) {
      throw new TypeError('MissionEventEngine.registerHandler: Event type must be a non-empty string.');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('MissionEventEngine.registerHandler: Handler must be a function.');
    }
    this.handlers.set(eventType.trim(), handler as MissionEventHandler);
  }

  /**
   * Unregisters a handler for a specific event type.
   */
  public unregisterHandler(eventType: string): boolean {
    return this.handlers.delete(eventType.trim());
  }

  /**
   * Schedules a new mission event.
   */
  public scheduleEvent<T = unknown>(input: EventScheduleInput<T>): MissionEvent<T> {
    return this.scheduler.schedule(input, this.getMETSeconds());
  }

  /**
   * Cancels a pending mission event.
   */
  public cancelEvent(eventId: string): boolean {
    return this.scheduler.cancel(eventId);
  }

  /**
   * Returns the complete execution history log.
   */
  public getExecutionHistory(): ReadonlyArray<EventExecutionResult> {
    return [...this.executionHistory];
  }

  public restoreExecutionHistory(history: readonly EventExecutionResult[]): void {
    this.executionHistory = history.map((r) => ({ ...r }));
  }

  /**
   * Safely prunes execution history records and delegates event pruning to the scheduler.
   *
   * @param options PruneHistoryOptions
   * @returns PruneHistoryResult detailing counts of pruned records and events
   */
  public pruneHistory(options: PruneHistoryOptions = {}): PruneHistoryResult {
    const { olderThanMETSeconds, pruneExecutionHistory = true } = options;

    let prunedExecutionReports = 0;
    if (pruneExecutionHistory) {
      const initialCount = this.executionHistory.length;
      this.executionHistory = this.executionHistory.filter((record) => {
        if (olderThanMETSeconds !== undefined) {
          return record.executedAtSeconds > olderThanMETSeconds;
        }
        return false;
      });
      prunedExecutionReports = initialCount - this.executionHistory.length;
    }

    const prunedSchedulerEvents = this.scheduler.pruneEvents(options);

    return {
      prunedSchedulerEvents,
      prunedExecutionReports,
    };
  }

  /**
   * Advances simulation time by durationSeconds and executes all events due during the interval.
   *
   * Execution Flow:
   * 1. Re-entrancy Guard: Throws error if called while an existing advancement step is active.
   * 2. Checks pause state. If paused and forceWhilePaused is false, returns early without advancing.
   * 3. Sets re-entrancy lock (isAdvancing = true) released in a strict finally block.
   * 4. Advances simulation clock to target MET.
   * 5. In a loop up to maxEventsPerStep:
   *    - Extracts due pending events (scheduledTime <= currentTime).
   *    - Dispatches to registered handlers inside error containment boundary.
   *    - Newly scheduled events at the current simulation timestamp are picked up in subsequent iterations.
   * 6. If maxEventsPerStep limit is reached, halts processing for the step and preserves remaining events as PENDING.
   * 7. Returns a comprehensive TimeStepExecutionReport.
   *
   * @param durationSeconds Seconds to advance
   * @param options AdvanceAndProcessOptions
   * @returns TimeStepExecutionReport
   */
  public advanceAndProcess(
    durationSeconds: number,
    options: AdvanceAndProcessOptions = {}
  ): TimeStepExecutionReport {
    if (this.isAdvancing) {
      throw new Error(
        'MissionEventEngine: Re-entrant time advancement call detected. advanceAndProcess cannot be invoked recursively from within an event handler.'
      );
    }

    const previousTimeSeconds = this.getMETSeconds();

    // Check pause condition
    if (this.isPaused() && !options.forceWhilePaused) {
      return {
        previousTimeSeconds,
        currentTimeSeconds: previousTimeSeconds,
        timeAdvancedSeconds: 0,
        eventsProcessedCount: 0,
        executedEvents: [],
        failedEvents: [],
        skippedEvents: [],
        isPaused: true,
        stepLimitReached: false,
      };
    }

    this.isAdvancing = true;

    try {
      const timeStep = this.timeController.advance(durationSeconds, options);
      const currentTimeSeconds = timeStep.currentMETSeconds;

      const executedEvents: EventExecutionResult[] = [];
      const failedEvents: EventExecutionResult[] = [];
      const skippedEvents: EventExecutionResult[] = [];
      let totalProcessedCount = 0;
      let stepLimitReached = false;

      while (totalProcessedCount < this.maxEventsPerStep) {
        const dueEvents = this.scheduler.extractDueEvents(currentTimeSeconds);
        if (dueEvents.length === 0) {
          break;
        }

        let processedInPass = 0;

        for (const event of dueEvents) {
          if (totalProcessedCount >= this.maxEventsPerStep) {
            stepLimitReached = true;
            break;
          }

          // Guard: Cancelled events must not execute
          if (event.status === 'CANCELLED') {
            const skippedResult: EventExecutionResult = {
              eventId: event.id,
              eventType: event.type,
              scheduledTimeSeconds: event.scheduledTimeSeconds,
              executedAtSeconds: currentTimeSeconds,
              status: 'SKIPPED',
              success: false,
              payload: event.payload,
              error: 'Event was cancelled prior to execution.',
            };
            skippedEvents.push(skippedResult);
            this.executionHistory.push(skippedResult);
            continue;
          }

          // Guard: Prevent duplicate execution
          if (event.status === 'EXECUTED') {
            continue;
          }

          const context: MissionExecutionContext = {
            metSeconds: currentTimeSeconds,
            currentTimestampSeconds: this.timeController.getClockState().currentTimestampSeconds,
            stepCount: this.timeController.getClockState().stepCount,
          };

          const handler = this.handlers.get(event.type);

          try {
            let handlerResult: unknown = undefined;
            if (handler) {
              handlerResult = handler(event, context);
            }

            event.status = 'EXECUTED';
            const successResult: EventExecutionResult = {
              eventId: event.id,
              eventType: event.type,
              scheduledTimeSeconds: event.scheduledTimeSeconds,
              executedAtSeconds: currentTimeSeconds,
              status: 'EXECUTED',
              success: true,
              payload: event.payload,
              result: handlerResult,
            };
            executedEvents.push(successResult);
            this.executionHistory.push(successResult);
          } catch (err) {
            // Error containment: One failing handler must never corrupt the scheduler
            event.status = 'FAILED';
            const failureResult: EventExecutionResult = {
              eventId: event.id,
              eventType: event.type,
              scheduledTimeSeconds: event.scheduledTimeSeconds,
              executedAtSeconds: currentTimeSeconds,
              status: 'FAILED',
              success: false,
              payload: event.payload,
              error: err instanceof Error ? err.message : String(err),
            };
            failedEvents.push(failureResult);
            this.executionHistory.push(failureResult);
          }

          totalProcessedCount++;
          processedInPass++;
        }

        if (stepLimitReached || processedInPass === 0) {
          break;
        }
      }

      // Check if there are still pending due events remaining after loop
      if (totalProcessedCount >= this.maxEventsPerStep) {
        const remainingDue = this.scheduler.extractDueEvents(currentTimeSeconds);
        if (remainingDue.length > 0) {
          stepLimitReached = true;
        }
      }

      return {
        previousTimeSeconds,
        currentTimeSeconds,
        timeAdvancedSeconds: timeStep.advancedSeconds,
        eventsProcessedCount: executedEvents.length + failedEvents.length,
        executedEvents,
        failedEvents,
        skippedEvents,
        isPaused: this.isPaused(),
        stepLimitReached,
      };
    } finally {
      this.isAdvancing = false;
    }
  }

  public advanceMinutes(minutes: number, options: AdvanceAndProcessOptions = {}): TimeStepExecutionReport {
    return this.advanceAndProcess(minutes * 60, options);
  }

  public advanceHours(hours: number, options: AdvanceAndProcessOptions = {}): TimeStepExecutionReport {
    return this.advanceAndProcess(hours * 3600, options);
  }

  public advanceDays(days: number, options: AdvanceAndProcessOptions = {}): TimeStepExecutionReport {
    return this.advanceAndProcess(days * 86400, options);
  }
}
