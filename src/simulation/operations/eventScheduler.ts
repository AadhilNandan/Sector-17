/**
 * SECTOR 17 — Mission Event Scheduler
 * Manages deterministic chronological scheduling, priority ordering, cancellation,
 * and retrieval of mission operational events.
 */

import { DEFAULT_EVENT_PRIORITY } from '../constants';
import type { MissionEvent, EventScheduleInput, PruneEventsOptions } from '../types';

/**
 * Deterministic comparison function for sorting mission events:
 * 1. Scheduled Time (ascending: earlier events execute first)
 * 2. Priority (descending: higher priority number executes first at identical timestamp)
 * 3. Sequence Number (ascending: FIFO insertion order for identical priority)
 * 4. Event ID (alphabetical ascending: deterministic tie-breaker)
 */
export function compareEvents(a: MissionEvent, b: MissionEvent): number {
  if (a.scheduledTimeSeconds !== b.scheduledTimeSeconds) {
    return a.scheduledTimeSeconds - b.scheduledTimeSeconds;
  }
  if (a.priority !== b.priority) {
    return b.priority - a.priority; // higher priority first
  }
  if (a.sequenceNumber !== b.sequenceNumber) {
    return a.sequenceNumber - b.sequenceNumber;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Recursively clones and deeply freezes plain objects and arrays to ensure total payload immutability.
 * Rejects functions, symbols, non-plain object instances, and circular references with TypeError.
 *
 * @param payload The raw payload data provided by the caller
 * @param seen WeakSet tracking visited objects to detect and prevent circular references
 * @returns Deeply cloned and deeply frozen payload
 * @throws TypeError on unsupported types (functions, symbols, non-plain objects) or circular references
 */
export function deepCloneAndFreeze<T>(payload: T, seen: WeakSet<object> = new WeakSet()): T {
  if (payload === null || payload === undefined) {
    return payload;
  }

  const type = typeof payload;

  if (type === 'number' || type === 'string' || type === 'boolean' || type === 'bigint') {
    return payload;
  }

  if (type === 'symbol') {
    throw new TypeError('EventScheduler: Symbol types are not supported in event payloads.');
  }

  if (type === 'function') {
    throw new TypeError('EventScheduler: Functions are not supported in event payloads.');
  }

  if (type === 'object') {
    const obj = payload as unknown as object;

    if (seen.has(obj)) {
      throw new TypeError('EventScheduler: Circular reference detected in event payload.');
    }
    seen.add(obj);

    if (Array.isArray(payload)) {
      const clonedArray = payload.map((item) => deepCloneAndFreeze(item, seen));
      return Object.freeze(clonedArray) as unknown as T;
    }

    const proto = Object.getPrototypeOf(payload);
    if (proto !== Object.prototype && proto !== null) {
      const constructorName = (payload as object).constructor?.name || 'Unknown';
      throw new TypeError(
        `EventScheduler: Non-plain object instance '${constructorName}' is not supported in event payloads.`
      );
    }

    const clonedObj: Record<string, unknown> = {};
    for (const key of Object.keys(payload)) {
      clonedObj[key] = deepCloneAndFreeze((payload as Record<string, unknown>)[key], seen);
    }

    return Object.freeze(clonedObj) as unknown as T;
  }

  throw new TypeError(`EventScheduler: Unsupported payload type '${type}'.`);
}

/**
 * Deterministic Event Scheduler
 */
export class EventScheduler {
  private events: Map<string, MissionEvent> = new Map();
  private sequenceCounter: number = 0;

  /**
   * Schedules a new event for a future or current simulation time.
   *
   * @param input EventScheduleInput
   * @param currentMETSeconds Current mission elapsed time in seconds
   * @returns Newly scheduled MissionEvent
   *
   * @throws TypeError if parameters are non-finite or invalid
   * @throws RangeError if scheduledTimeSeconds is strictly in the past relative to currentMETSeconds
   * @throws Error if an event with the same ID is already scheduled
   */
  public schedule<T = unknown>(input: EventScheduleInput<T>, currentMETSeconds: number = 0): MissionEvent<T> {
    if (!input || typeof input !== 'object') {
      throw new TypeError('EventScheduler.schedule: Input must be an object.');
    }
    if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
      throw new TypeError('EventScheduler.schedule: Event ID must be a non-empty string.');
    }
    if (!input.type || typeof input.type !== 'string' || input.type.trim().length === 0) {
      throw new TypeError('EventScheduler.schedule: Event type must be a non-empty string.');
    }
    if (typeof input.scheduledTimeSeconds !== 'number' || !Number.isFinite(input.scheduledTimeSeconds)) {
      throw new TypeError(
        `EventScheduler.schedule: Scheduled time must be a finite number. Received: ${input.scheduledTimeSeconds}`
      );
    }
    if (typeof currentMETSeconds !== 'number' || !Number.isFinite(currentMETSeconds)) {
      throw new TypeError(
        `EventScheduler.schedule: Current MET must be a finite number. Received: ${currentMETSeconds}`
      );
    }
    if (input.scheduledTimeSeconds < currentMETSeconds) {
      throw new RangeError(
        `EventScheduler.schedule: Cannot schedule event '${input.id}' in the past. Scheduled time: ${input.scheduledTimeSeconds} s, Current MET: ${currentMETSeconds} s.`
      );
    }
    if (this.events.has(input.id)) {
      throw new Error(
        `EventScheduler.schedule: Duplicate event ID '${input.id}'. An event with this ID is already registered in the scheduler.`
      );
    }

    const priority = input.priority !== undefined ? input.priority : DEFAULT_EVENT_PRIORITY;
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      throw new TypeError(
        `EventScheduler.schedule: Event priority must be a finite number. Received: ${priority}`
      );
    }

    this.sequenceCounter += 1;

    const event: MissionEvent<T> = {
      id: input.id.trim(),
      type: input.type.trim(),
      scheduledTimeSeconds: input.scheduledTimeSeconds,
      payload: deepCloneAndFreeze(input.payload as T),
      priority,
      sequenceNumber: this.sequenceCounter,
      status: 'PENDING',
      createdAtSeconds: currentMETSeconds,
    };

    this.events.set(event.id, event as MissionEvent);
    return event;
  }

  /**
   * Cancels a pending event.
   *
   * @param eventId Unique ID of the event to cancel
   * @returns true if event was found and cancelled, false if not found or already executed/cancelled
   */
  public cancel(eventId: string): boolean {
    const event = this.events.get(eventId);
    if (!event) {
      return false;
    }
    if (event.status !== 'PENDING') {
      return false;
    }
    event.status = 'CANCELLED';
    return true;
  }

  /**
   * Retrieves an event by its ID.
   */
  public getEvent(eventId: string): MissionEvent | undefined {
    const event = this.events.get(eventId);
    return event ? { ...event } : undefined;
  }

  /**
   * Returns all scheduled events (pending, executed, cancelled, failed).
   */
  public getAllEvents(): MissionEvent[] {
    return Array.from(this.events.values())
      .map((e) => ({ ...e }))
      .sort(compareEvents);
  }

  /**
   * Returns all events that are currently pending.
   */
  public getPendingEvents(): MissionEvent[] {
    return Array.from(this.events.values())
      .filter((e) => e.status === 'PENDING')
      .map((e) => ({ ...e }))
      .sort(compareEvents);
  }

  /**
   * Retrieves and removes all pending events that are due on or before targetMETSeconds,
   * sorted deterministically.
   *
   * @param targetMETSeconds Upper time bound in MET seconds
   * @returns Array of due events in deterministic execution order
   */
  public extractDueEvents(targetMETSeconds: number): MissionEvent[] {
    if (typeof targetMETSeconds !== 'number' || !Number.isFinite(targetMETSeconds)) {
      throw new TypeError(
        `EventScheduler.extractDueEvents: Target MET must be a finite number. Received: ${targetMETSeconds}`
      );
    }

    const dueEvents: MissionEvent[] = [];
    for (const event of this.events.values()) {
      if (event.status === 'PENDING' && event.scheduledTimeSeconds <= targetMETSeconds) {
        dueEvents.push(event);
      }
    }

    return dueEvents.sort(compareEvents);
  }

  /**
   * Returns the count of pending events.
   */
  public getPendingCount(): number {
    let count = 0;
    for (const event of this.events.values()) {
      if (event.status === 'PENDING') {
        count++;
      }
    }
    return count;
  }

  /**
   * Safely prunes executed, cancelled, or failed events from scheduler storage.
   * INVARIANT: Events with status 'PENDING' are NEVER pruned.
   *
   * @param options PruneEventsOptions
   * @returns Number of events successfully pruned
   */
  public pruneEvents(options: PruneEventsOptions = {}): number {
    const {
      olderThanMETSeconds,
      removeExecuted = true,
      removeCancelled = true,
      removeFailed = true,
    } = options;

    let prunedCount = 0;

    for (const [id, event] of this.events.entries()) {
      // Strict invariant: Pending events must never be deleted
      if (event.status === 'PENDING') {
        continue;
      }

      if (event.status === 'EXECUTED' && !removeExecuted) {
        continue;
      }
      if (event.status === 'CANCELLED' && !removeCancelled) {
        continue;
      }
      if (event.status === 'FAILED' && !removeFailed) {
        continue;
      }

      if (olderThanMETSeconds !== undefined && event.scheduledTimeSeconds > olderThanMETSeconds) {
        continue;
      }

      this.events.delete(id);
      prunedCount++;
    }

    return prunedCount;
  }

  /**
   * Resets the scheduler, removing all events and resetting sequence numbers.
   */
  public clear(): void {
    this.events.clear();
    this.sequenceCounter = 0;
  }

  public getSequenceCounter(): number {
    return this.sequenceCounter;
  }

  public restoreEvents(events: readonly MissionEvent[], sequenceCounter?: number): void {
    this.clear();
    for (const e of events) {
      this.events.set(e.id, { ...e });
    }
    this.sequenceCounter = sequenceCounter ?? events.length;
  }
}
