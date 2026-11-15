import { describe, it, expect } from 'vitest';
import {
  MissionClock,
  createInitialMissionClockState,
  advanceClockState,
  pauseClockState,
  resumeClockState,
  resetClockState,
  validateTimeIncrement,
  metToComponents,
  formatMET,
  daysToSeconds,
  hoursToSeconds,
  minutesToSeconds,
} from '../src/simulation/operations/missionClock';

describe('Mission Clock Engine', () => {
  describe('Time Unit Conversions & Validation', () => {
    it('converts days, hours, and minutes to SI seconds accurately', () => {
      expect(daysToSeconds(1)).toBe(86400);
      expect(daysToSeconds(42)).toBe(3628800);
      expect(hoursToSeconds(1)).toBe(3600);
      expect(hoursToSeconds(12)).toBe(43200);
      expect(minutesToSeconds(1)).toBe(60);
      expect(minutesToSeconds(30)).toBe(1800);
    });

    it('rejects negative or non-finite time increments', () => {
      expect(() => validateTimeIncrement(-1)).toThrow(RangeError);
      expect(() => validateTimeIncrement(-0.0001)).toThrow(RangeError);
      expect(() => validateTimeIncrement(NaN)).toThrow(TypeError);
      expect(() => validateTimeIncrement(Infinity)).toThrow(TypeError);
      expect(() => validateTimeIncrement(-Infinity)).toThrow(TypeError);
    });

    it('decomposes MET seconds into days, hours, minutes, and seconds', () => {
      // 42 days, 12 hours, 30 minutes, 15.5 seconds
      // 42 * 86400 = 3628800
      // 12 * 3600  = 43200
      // 30 * 60    = 1800
      // 15.5
      // Total: 3673815.5 s
      const components = metToComponents(3673815.5);
      expect(components.days).toBe(42);
      expect(components.hours).toBe(12);
      expect(components.minutes).toBe(30);
      expect(components.seconds).toBe(15.5);
    });

    it('formats MET in standard aerospace format (T+ DDDd HH:MM:SS)', () => {
      expect(formatMET(0)).toBe('T+ 000d 00:00:00');
      expect(formatMET(3600)).toBe('T+ 000d 01:00:00');
      expect(formatMET(86400)).toBe('T+ 001d 00:00:00');
      expect(formatMET(3673815)).toBe('T+ 042d 12:30:15');
    });

    it('rejects negative or non-finite MET in component converter', () => {
      expect(() => metToComponents(-100)).toThrow(RangeError);
      expect(() => metToComponents(NaN)).toThrow(RangeError);
    });
  });

  describe('Pure State Transitions', () => {
    it('creates initial clock state with specified epoch', () => {
      const state = createInitialMissionClockState(1000, false);
      expect(state.metSeconds).toBe(0);
      expect(state.epochTimestampSeconds).toBe(1000);
      expect(state.currentTimestampSeconds).toBe(1000);
      expect(state.isRunning).toBe(false);
      expect(state.stepCount).toBe(0);
    });

    it('does not advance time when paused unless forced', () => {
      const state = createInitialMissionClockState(0, false);
      const advanced = advanceClockState(state, 3600);
      expect(advanced.metSeconds).toBe(0);
      expect(advanced.stepCount).toBe(0);

      const forced = advanceClockState(state, 3600, true);
      expect(forced.metSeconds).toBe(3600);
      expect(forced.currentTimestampSeconds).toBe(3600);
      expect(forced.stepCount).toBe(1);
    });

    it('advances time when running and increments step count', () => {
      const state = createInitialMissionClockState(0, true);
      const step1 = advanceClockState(state, 100);
      expect(step1.metSeconds).toBe(100);
      expect(step1.stepCount).toBe(1);

      const step2 = advanceClockState(step1, 200);
      expect(step2.metSeconds).toBe(300);
      expect(step2.stepCount).toBe(2);
    });

    it('handles pause, resume, and reset transitions', () => {
      let state = createInitialMissionClockState(500, true);
      state = advanceClockState(state, 1000);
      expect(state.metSeconds).toBe(1000);

      state = pauseClockState(state);
      expect(state.isRunning).toBe(false);

      state = resumeClockState(state);
      expect(state.isRunning).toBe(true);

      state = resetClockState(state);
      expect(state.metSeconds).toBe(0);
      expect(state.currentTimestampSeconds).toBe(500);
      expect(state.stepCount).toBe(0);
      expect(state.isRunning).toBe(false);
    });
  });

  describe('MissionClock Stateful Class', () => {
    it('initializes to paused state by default and resumes upon command', () => {
      const clock = new MissionClock(0, false);
      expect(clock.isPaused()).toBe(true);
      expect(clock.isRunning()).toBe(false);
      expect(clock.getMETSeconds()).toBe(0);

      clock.resume();
      expect(clock.isPaused()).toBe(false);
      expect(clock.isRunning()).toBe(true);
    });

    it('advances by hours and days accurately', () => {
      const clock = new MissionClock(0, true);

      // Advance 12 hours (43,200 s)
      const advancedSec = clock.advanceByHours(12);
      expect(advancedSec).toBe(43200);
      expect(clock.getMETSeconds()).toBe(43200);
      expect(clock.getFormattedMET()).toBe('T+ 000d 12:00:00');

      // Advance 1 day (86,400 s)
      clock.advanceByDays(1);
      expect(clock.getMETSeconds()).toBe(43200 + 86400); // 129,600 s (1.5 days)
      expect(clock.getFormattedMET()).toBe('T+ 001d 12:00:00');
    });

    it('handles large time advancements without floating-point degradation', () => {
      const clock = new MissionClock(0, true);

      // Advance 1000 days (86,400,000 s)
      clock.advanceByDays(1000);
      expect(clock.getMETSeconds()).toBe(86400000);
      expect(clock.getFormattedMET()).toBe('T+ 1000d 00:00:00');
    });

    it('prevents advancement when paused unless forceAdvance is specified', () => {
      const clock = new MissionClock(0, false); // Paused

      const adv = clock.advance(500);
      expect(adv).toBe(0);
      expect(clock.getMETSeconds()).toBe(0);

      const forcedAdv = clock.advance(500, true);
      expect(forcedAdv).toBe(500);
      expect(clock.getMETSeconds()).toBe(500);
    });

    it('resets to 0 MET and paused state', () => {
      const clock = new MissionClock(1000, true);
      clock.advance(5000);
      expect(clock.getMETSeconds()).toBe(5000);

      clock.reset();
      expect(clock.getMETSeconds()).toBe(0);
      expect(clock.getCurrentTimestampSeconds()).toBe(1000);
      expect(clock.isPaused()).toBe(true);
      expect(clock.getStepCount()).toBe(0);
    });
  });
});
