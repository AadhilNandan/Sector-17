/**
 * SECTOR 17 — Simulation Time Controller
 * Manages deterministic simulation time stepping, pause/resume transitions,
 * and duration advances without depending on real-time browser timers.
 */

import { MissionClock, validateTimeIncrement, hoursToSeconds, daysToSeconds, minutesToSeconds } from './missionClock';
import type { MissionClockState } from '../types';

export interface AdvanceOptions {
  /** If true, advances simulation time even when in the paused state */
  forceWhilePaused?: boolean;
}

export interface TimeStepResult {
  advanced: boolean;
  previousMETSeconds: number;
  currentMETSeconds: number;
  advancedSeconds: number;
  formattedMET: string;
  isPaused: boolean;
  stepCount: number;
}

/**
 * Coordinates simulation time advancement and control states.
 */
export class TimeController {
  private clock: MissionClock;

  constructor(epochTimestampSeconds?: number, startRunning: boolean = false) {
    this.clock = new MissionClock(epochTimestampSeconds, startRunning);
  }

  public getClockState(): Readonly<MissionClockState> {
    return this.clock.getState();
  }

  public getMETSeconds(): number {
    return this.clock.getMETSeconds();
  }

  public getFormattedMET(): string {
    return this.clock.getFormattedMET();
  }

  public isPaused(): boolean {
    return this.clock.isPaused();
  }

  public isRunning(): boolean {
    return this.clock.isRunning();
  }

  public pause(): void {
    this.clock.pause();
  }

  public resume(): void {
    this.clock.resume();
  }

  public reset(): void {
    this.clock.reset();
  }

  public restoreState(state: Parameters<MissionClock['restoreState']>[0]): void {
    this.clock.restoreState(state);
  }

  /**
   * Advances simulation time by requested seconds.
   *
   * @param durationSeconds Number of seconds to advance (durationSeconds >= 0)
   * @param options AdvanceOptions
   * @returns TimeStepResult
   */
  public advance(durationSeconds: number, options: AdvanceOptions = {}): TimeStepResult {
    const validatedDuration = validateTimeIncrement(durationSeconds);
    const previousMET = this.clock.getMETSeconds();

    if (this.clock.isPaused() && !options.forceWhilePaused) {
      return {
        advanced: false,
        previousMETSeconds: previousMET,
        currentMETSeconds: previousMET,
        advancedSeconds: 0,
        formattedMET: this.clock.getFormattedMET(),
        isPaused: true,
        stepCount: this.clock.getStepCount(),
      };
    }

    const actualAdvanced = this.clock.advance(validatedDuration, options.forceWhilePaused);

    return {
      advanced: actualAdvanced > 0,
      previousMETSeconds: previousMET,
      currentMETSeconds: this.clock.getMETSeconds(),
      advancedSeconds: actualAdvanced,
      formattedMET: this.clock.getFormattedMET(),
      isPaused: this.clock.isPaused(),
      stepCount: this.clock.getStepCount(),
    };
  }

  public advanceMinutes(minutes: number, options: AdvanceOptions = {}): TimeStepResult {
    return this.advance(minutesToSeconds(minutes), options);
  }

  public advanceHours(hours: number, options: AdvanceOptions = {}): TimeStepResult {
    return this.advance(hoursToSeconds(hours), options);
  }

  public advanceDays(days: number, options: AdvanceOptions = {}): TimeStepResult {
    return this.advance(daysToSeconds(days), options);
  }

  public getMissionClock(): MissionClock {
    return this.clock;
  }
}
