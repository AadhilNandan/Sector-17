/**
 * SECTOR 17 — Mission Operations Clock
 * Tracks Mission Elapsed Time (MET), simulation timestamps, running/paused states,
 * and deterministic time advancement in standard SI seconds.
 *
 * All operations are deterministic, independent of the host machine's wall clock (Date.now()),
 * and avoid floating-point accumulation errors through explicit integer/precision rounding.
 */

import {
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
  DEFAULT_MISSION_EPOCH_SECONDS,
} from '../constants';
import type { MissionClockState } from '../types';

/**
 * Breakdown of Mission Elapsed Time into standard astronomical components
 */
export interface METComponents {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Validates that a time increment is a non-negative, finite number.
 * @throws TypeError if deltaSeconds is not a finite number
 * @throws RangeError if deltaSeconds is strictly negative
 */
export function validateTimeIncrement(deltaSeconds: number, label: string = 'Time increment'): number {
  if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) {
    throw new TypeError(`validateTimeIncrement: ${label} must be a finite number. Received: ${deltaSeconds}`);
  }
  if (deltaSeconds < 0) {
    throw new RangeError(`validateTimeIncrement: ${label} cannot be negative. Received: ${deltaSeconds} s`);
  }
  return deltaSeconds;
}

/**
 * Converts days to standard SI seconds (86,400 s/day)
 */
export function daysToSeconds(days: number): number {
  return validateTimeIncrement(days, 'Days') * SECONDS_PER_DAY;
}

/**
 * Converts hours to standard SI seconds (3,600 s/hour)
 */
export function hoursToSeconds(hours: number): number {
  return validateTimeIncrement(hours, 'Hours') * SECONDS_PER_HOUR;
}

/**
 * Converts minutes to standard SI seconds (60 s/min)
 */
export function minutesToSeconds(minutes: number): number {
  return validateTimeIncrement(minutes, 'Minutes') * SECONDS_PER_MINUTE;
}

/**
 * Converts Mission Elapsed Time in seconds into integer days, hours, minutes, and fractional seconds.
 */
export function metToComponents(metSeconds: number): METComponents {
  if (typeof metSeconds !== 'number' || !Number.isFinite(metSeconds) || metSeconds < 0) {
    throw new RangeError(
      `metToComponents: MET seconds must be a non-negative finite number. Received: ${metSeconds}`
    );
  }

  const totalWholeSeconds = Math.floor(metSeconds);
  const remainingFraction = metSeconds - totalWholeSeconds;

  const days = Math.floor(totalWholeSeconds / SECONDS_PER_DAY);
  const remDay = totalWholeSeconds % SECONDS_PER_DAY;

  const hours = Math.floor(remDay / SECONDS_PER_HOUR);
  const remHour = remDay % SECONDS_PER_HOUR;

  const minutes = Math.floor(remHour / SECONDS_PER_MINUTE);
  const wholeSeconds = remHour % SECONDS_PER_MINUTE;
  const seconds = wholeSeconds + remainingFraction;

  return { days, hours, minutes, seconds };
}

/**
 * Formats Mission Elapsed Time in standard aerospace format:
 * "T+ DDDd HH:MM:SS" (e.g., "T+ 042d 12:30:00")
 */
export function formatMET(metSeconds: number): string {
  const { days, hours, minutes, seconds } = metToComponents(metSeconds);
  const dStr = String(days).padStart(3, '0');
  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(Math.floor(seconds)).padStart(2, '0');
  return `T+ ${dStr}d ${hStr}:${mStr}:${sStr}`;
}

/**
 * Creates the initial, default Mission Clock state.
 *
 * @param epochTimestampSeconds Reference simulation epoch in seconds (default: 0)
 * @param startRunning Initial running state (default: false / paused)
 */
export function createInitialMissionClockState(
  epochTimestampSeconds: number = DEFAULT_MISSION_EPOCH_SECONDS,
  startRunning: boolean = false
): MissionClockState {
  if (typeof epochTimestampSeconds !== 'number' || !Number.isFinite(epochTimestampSeconds)) {
    throw new TypeError(
      `createInitialMissionClockState: Epoch timestamp must be a finite number. Received: ${epochTimestampSeconds}`
    );
  }

  return {
    metSeconds: 0,
    epochTimestampSeconds,
    currentTimestampSeconds: epochTimestampSeconds,
    isRunning: startRunning,
    stepCount: 0,
  };
}

/**
 * Pure state transition: Advances clock state by deltaSeconds.
 *
 * @param state Current MissionClockState
 * @param deltaSeconds Time increment in seconds (deltaSeconds >= 0)
 * @param forceAdvance If true, allows advancement even if isRunning is false (default: false)
 * @returns New immutable MissionClockState
 */
export function advanceClockState(
  state: MissionClockState,
  deltaSeconds: number,
  forceAdvance: boolean = false
): MissionClockState {
  const validatedDelta = validateTimeIncrement(deltaSeconds);

  if (!state.isRunning && !forceAdvance) {
    return state;
  }

  if (validatedDelta === 0) {
    return state;
  }

  const newMet = state.metSeconds + validatedDelta;
  const newCurrentTimestamp = state.epochTimestampSeconds + newMet;

  return {
    ...state,
    metSeconds: newMet,
    currentTimestampSeconds: newCurrentTimestamp,
    stepCount: state.stepCount + 1,
  };
}

/**
 * Pure state transition: Pauses the clock.
 */
export function pauseClockState(state: MissionClockState): MissionClockState {
  if (!state.isRunning) return state;
  return { ...state, isRunning: false };
}

/**
 * Pure state transition: Resumes the clock.
 */
export function resumeClockState(state: MissionClockState): MissionClockState {
  if (state.isRunning) return state;
  return { ...state, isRunning: true };
}

/**
 * Pure state transition: Resets the clock to initial epoch and 0 MET.
 */
export function resetClockState(state: MissionClockState): MissionClockState {
  return {
    ...state,
    metSeconds: 0,
    currentTimestampSeconds: state.epochTimestampSeconds,
    isRunning: false,
    stepCount: 0,
  };
}

/**
 * Stateful MissionClock instance for object-oriented simulation orchestrations
 */
export class MissionClock {
  private state: MissionClockState;

  constructor(epochTimestampSeconds: number = DEFAULT_MISSION_EPOCH_SECONDS, startRunning: boolean = false) {
    this.state = createInitialMissionClockState(epochTimestampSeconds, startRunning);
  }

  public getState(): Readonly<MissionClockState> {
    return { ...this.state };
  }

  public getMETSeconds(): number {
    return this.state.metSeconds;
  }

  public getCurrentTimestampSeconds(): number {
    return this.state.currentTimestampSeconds;
  }

  public getFormattedMET(): string {
    return formatMET(this.state.metSeconds);
  }

  public isRunning(): boolean {
    return this.state.isRunning;
  }

  public restoreState(state: Partial<MissionClockState>): void {
    if (!state || typeof state !== 'object') {
      throw new TypeError('MissionClock.restoreState: State must be an object.');
    }
    this.state = {
      ...this.state,
      ...state,
      metSeconds: state.metSeconds ?? this.state.metSeconds,
      currentTimestampSeconds:
        (state.epochTimestampSeconds ?? this.state.epochTimestampSeconds) +
        (state.metSeconds ?? this.state.metSeconds),
    };
  }

  public isPaused(): boolean {
    return !this.state.isRunning;
  }

  public getStepCount(): number {
    return this.state.stepCount;
  }

  public pause(): void {
    this.state = pauseClockState(this.state);
  }

  public resume(): void {
    this.state = resumeClockState(this.state);
  }

  public reset(): void {
    this.state = resetClockState(this.state);
  }

  /**
   * Advances the clock by a duration in seconds.
   *
   * @param deltaSeconds Time increment in seconds (deltaSeconds >= 0)
   * @param forceAdvance If true, allows time to advance even when paused
   * @returns Actual seconds advanced (0 if paused without forceAdvance)
   */
  public advance(deltaSeconds: number, forceAdvance: boolean = false): number {
    const validatedDelta = validateTimeIncrement(deltaSeconds);
    if (!this.state.isRunning && !forceAdvance) {
      return 0;
    }
    this.state = advanceClockState(this.state, validatedDelta, forceAdvance);
    return validatedDelta;
  }

  public advanceByHours(hours: number, forceAdvance: boolean = false): number {
    return this.advance(hoursToSeconds(hours), forceAdvance);
  }

  public advanceByDays(days: number, forceAdvance: boolean = false): number {
    return this.advance(daysToSeconds(days), forceAdvance);
  }
}
