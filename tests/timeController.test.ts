import { describe, it, expect } from 'vitest';
import { TimeController } from '../src/simulation/operations/timeController';

describe('Time Controller', () => {
  describe('Initial State & Clock State Inspection', () => {
    it('initializes with default epoch and running state', () => {
      const controller = new TimeController(0, true);
      expect(controller.getMETSeconds()).toBe(0);
      expect(controller.isRunning()).toBe(true);
      expect(controller.isPaused()).toBe(false);
      expect(controller.getFormattedMET()).toBe('T+ 000d 00:00:00');

      const state = controller.getClockState();
      expect(state.metSeconds).toBe(0);
      expect(state.epochTimestampSeconds).toBe(0);
      expect(state.currentTimestampSeconds).toBe(0);
      expect(state.isRunning).toBe(true);
      expect(state.stepCount).toBe(0);
    });

    it('initializes paused when startRunning is false', () => {
      const controller = new TimeController(1700000000, false);
      expect(controller.getMETSeconds()).toBe(0);
      expect(controller.isRunning()).toBe(false);
      expect(controller.isPaused()).toBe(true);

      const state = controller.getClockState();
      expect(state.epochTimestampSeconds).toBe(1700000000);
      expect(state.currentTimestampSeconds).toBe(1700000000);
    });
  });

  describe('Time Advancement & Unit Conversions', () => {
    it('advances simulation time by seconds and tracks step count', () => {
      const controller = new TimeController(0, true);
      const res1 = controller.advance(150);

      expect(res1.advanced).toBe(true);
      expect(res1.previousMETSeconds).toBe(0);
      expect(res1.currentMETSeconds).toBe(150);
      expect(res1.advancedSeconds).toBe(150);
      expect(res1.stepCount).toBe(1);
      expect(controller.getMETSeconds()).toBe(150);

      const res2 = controller.advance(250);
      expect(res2.previousMETSeconds).toBe(150);
      expect(res2.currentMETSeconds).toBe(400);
      expect(res2.stepCount).toBe(2);
      expect(controller.getMETSeconds()).toBe(400);
    });

    it('advances by minutes, hours, and days correctly', () => {
      const controller = new TimeController(0, true);

      // Advance 10 minutes = 600 s
      const mRes = controller.advanceMinutes(10);
      expect(mRes.advancedSeconds).toBe(600);
      expect(controller.getMETSeconds()).toBe(600);

      // Advance 2 hours = 7,200 s -> total 7,800 s
      const hRes = controller.advanceHours(2);
      expect(hRes.advancedSeconds).toBe(7200);
      expect(controller.getMETSeconds()).toBe(7800);

      // Advance 1 day = 86,400 s -> total 94,200 s
      const dRes = controller.advanceDays(1);
      expect(dRes.advancedSeconds).toBe(86400);
      expect(controller.getMETSeconds()).toBe(94200);
      expect(controller.getFormattedMET()).toBe('T+ 001d 02:10:00');
    });

    it('advancing by zero seconds is a valid no-op', () => {
      const controller = new TimeController(0, true);
      controller.advance(100);

      const res = controller.advance(0);
      expect(res.advanced).toBe(false);
      expect(res.advancedSeconds).toBe(0);
      expect(res.previousMETSeconds).toBe(100);
      expect(res.currentMETSeconds).toBe(100);
      expect(controller.getMETSeconds()).toBe(100);
    });

    it('produces identical MET whether advanced in discrete small steps or one large step', () => {
      const c1 = new TimeController(0, true);
      const c2 = new TimeController(0, true);

      // 60 increments of 1 second
      for (let i = 0; i < 60; i++) {
        c1.advance(1);
      }

      // 1 single increment of 60 seconds
      c2.advance(60);

      expect(c1.getMETSeconds()).toBe(60);
      expect(c2.getMETSeconds()).toBe(60);
      expect(c1.getMETSeconds()).toBe(c2.getMETSeconds());
      expect(c1.getFormattedMET()).toBe(c2.getFormattedMET());
    });
  });

  describe('Pause, Resume & Force Advancement', () => {
    it('does not advance time when paused unless forceWhilePaused is set', () => {
      const controller = new TimeController(0, true);
      controller.advance(500);

      controller.pause();
      expect(controller.isPaused()).toBe(true);
      expect(controller.isRunning()).toBe(false);

      // Normal advance while paused
      const pausedRes = controller.advance(300);
      expect(pausedRes.advanced).toBe(false);
      expect(pausedRes.advancedSeconds).toBe(0);
      expect(pausedRes.currentMETSeconds).toBe(500);
      expect(controller.getMETSeconds()).toBe(500);

      // Force advance while paused
      const forcedRes = controller.advance(300, { forceWhilePaused: true });
      expect(forcedRes.advanced).toBe(true);
      expect(forcedRes.advancedSeconds).toBe(300);
      expect(forcedRes.currentMETSeconds).toBe(800);
      expect(controller.getMETSeconds()).toBe(800);
      expect(controller.isPaused()).toBe(true); // Still paused
    });

    it('resumes clock advancement after pause', () => {
      const controller = new TimeController(0, false); // starts paused
      expect(controller.isPaused()).toBe(true);

      controller.resume();
      expect(controller.isRunning()).toBe(true);

      const res = controller.advance(200);
      expect(res.advanced).toBe(true);
      expect(res.currentMETSeconds).toBe(200);
    });

    it('resets clock back to epoch and resets step count', () => {
      const controller = new TimeController(1000, true);
      controller.advance(5000);
      expect(controller.getMETSeconds()).toBe(5000);
      expect(controller.getClockState().stepCount).toBe(1);

      controller.reset();
      expect(controller.getMETSeconds()).toBe(0);
      expect(controller.getClockState().currentTimestampSeconds).toBe(1000);
      expect(controller.getClockState().stepCount).toBe(0);
      expect(controller.isPaused()).toBe(true);
    });
  });

  describe('Validation & Error Boundaries', () => {
    it('rejects negative time increments with RangeError', () => {
      const controller = new TimeController(0, true);

      expect(() => controller.advance(-1)).toThrow(RangeError);
      expect(() => controller.advanceMinutes(-5)).toThrow(RangeError);
      expect(() => controller.advanceHours(-0.5)).toThrow(RangeError);
      expect(() => controller.advanceDays(-2)).toThrow(RangeError);
    });

    it('rejects non-finite time increments with TypeError', () => {
      const controller = new TimeController(0, true);

      expect(() => controller.advance(NaN)).toThrow(TypeError);
      expect(() => controller.advance(Infinity)).toThrow(TypeError);
      expect(() => controller.advance(-Infinity)).toThrow(TypeError);
      expect(() => controller.advanceMinutes(NaN)).toThrow(TypeError);
      expect(() => controller.advanceHours(Infinity)).toThrow(TypeError);
      expect(() => controller.advanceDays(NaN)).toThrow(TypeError);
    });
  });
});
