import { describe, it, expect, vi } from 'vitest';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';

describe('Mission Event Engine', () => {
  it('initializes in running state and advances time correctly', () => {
    const engine = new MissionEventEngine(0, true);
    expect(engine.isRunning()).toBe(true);
    expect(engine.isPaused()).toBe(false);
    expect(engine.getMETSeconds()).toBe(0);

    const report = engine.advanceAndProcess(3600); // 1 hour
    expect(report.timeAdvancedSeconds).toBe(3600);
    expect(report.currentTimeSeconds).toBe(3600);
    expect(report.previousTimeSeconds).toBe(0);
    expect(engine.getFormattedMET()).toBe('T+ 000d 01:00:00');
  });

  it('prevents time advancement and execution while paused unless forced', () => {
    const engine = new MissionEventEngine(0, false); // Paused
    const handler = vi.fn();
    engine.registerHandler('TEST_EVENT', handler);

    engine.scheduleEvent({
      id: 'e1',
      type: 'TEST_EVENT',
      scheduledTimeSeconds: 100,
    });

    const report = engine.advanceAndProcess(500);
    expect(report.timeAdvancedSeconds).toBe(0);
    expect(report.currentTimeSeconds).toBe(0);
    expect(report.isPaused).toBe(true);
    expect(handler).not.toHaveBeenCalled();

    // Forced advance while paused
    const forcedReport = engine.advanceAndProcess(500, { forceWhilePaused: true });
    expect(forcedReport.timeAdvancedSeconds).toBe(500);
    expect(forcedReport.currentTimeSeconds).toBe(500);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  describe('Event Execution & Dispatching', () => {
    it('executes due events and passes event data and execution context to handlers', () => {
      const engine = new MissionEventEngine(0, true);
      const executionLog: string[] = [];

      engine.registerHandler('COMM_WINDOW', (event, context) => {
        executionLog.push(`Executed ${event.id} at MET ${context.metSeconds} s with rate ${event.payload.rate}`);
        return { ack: true };
      });

      engine.scheduleEvent({
        id: 'comm-1',
        type: 'COMM_WINDOW',
        scheduledTimeSeconds: 1800,
        payload: { rate: '25 Mbps' },
      });

      const report = engine.advanceAndProcess(3600);

      expect(executionLog).toHaveLength(1);
      expect(executionLog[0]).toContain('Executed comm-1 at MET 3600 s with rate 25 Mbps');
      expect(report.eventsProcessedCount).toBe(1);
      expect(report.executedEvents).toHaveLength(1);
      expect(report.executedEvents[0].status).toBe('EXECUTED');
      expect(report.executedEvents[0].success).toBe(true);
      expect(report.executedEvents[0].result).toEqual({ ack: true });
    });

    it('processes multiple due events across progressive time steps without duplicate execution', () => {
      const engine = new MissionEventEngine(0, true);
      const executedIds: string[] = [];

      engine.registerHandler('PROGRESS_EVENT', (event) => {
        executedIds.push(event.id);
      });

      engine.scheduleEvent({ id: 'step-1-event', type: 'PROGRESS_EVENT', scheduledTimeSeconds: 500 });
      engine.scheduleEvent({ id: 'step-2-event', type: 'PROGRESS_EVENT', scheduledTimeSeconds: 1500 });
      engine.scheduleEvent({ id: 'step-3-event', type: 'PROGRESS_EVENT', scheduledTimeSeconds: 3000 });

      // Step 1: Advance to 1000s -> step-1-event executes
      const report1 = engine.advanceAndProcess(1000);
      expect(report1.eventsProcessedCount).toBe(1);
      expect(executedIds).toEqual(['step-1-event']);

      // Step 2: Advance to 2000s -> step-2-event executes, step-1-event does NOT re-execute
      const report2 = engine.advanceAndProcess(1000);
      expect(report2.eventsProcessedCount).toBe(1);
      expect(executedIds).toEqual(['step-1-event', 'step-2-event']);

      // Step 3: Advance to 4000s -> step-3-event executes
      const report3 = engine.advanceAndProcess(2000);
      expect(report3.eventsProcessedCount).toBe(1);
      expect(executedIds).toEqual(['step-1-event', 'step-2-event', 'step-3-event']);

      // Step 4: Advance further -> No new events execute
      const report4 = engine.advanceAndProcess(1000);
      expect(report4.eventsProcessedCount).toBe(0);
      expect(executedIds).toHaveLength(3);
    });

    it('does not execute events scheduled for the future', () => {
      const engine = new MissionEventEngine(0, true);
      const handler = vi.fn();
      engine.registerHandler('FUTURE_EVENT', handler);

      engine.scheduleEvent({
        id: 'future-burn',
        type: 'FUTURE_EVENT',
        scheduledTimeSeconds: 50000,
      });

      const report = engine.advanceAndProcess(1000); // Only advance to 1000s
      expect(report.eventsProcessedCount).toBe(0);
      expect(handler).not.toHaveBeenCalled();
      expect(engine.getScheduler().getPendingCount()).toBe(1);
    });

    it('executes multiple events at the exact same timestamp deterministically by priority and sequence', () => {
      const engine = new MissionEventEngine(0, true);
      const executionOrder: string[] = [];

      const recordOrder = (event: { id: string }) => {
        executionOrder.push(event.id);
      };

      engine.registerHandler('LOG', recordOrder);
      engine.registerHandler('CRITICAL', recordOrder);
      engine.registerHandler('SCIENCE', recordOrder);

      // Scheduled all at t = 2000s with distinct priorities and FIFO order
      engine.scheduleEvent({ id: 'low-log', type: 'LOG', scheduledTimeSeconds: 2000, priority: 50 });
      engine.scheduleEvent({ id: 'critical-burn', type: 'CRITICAL', scheduledTimeSeconds: 2000, priority: 300 });
      engine.scheduleEvent({ id: 'science-scan-1', type: 'SCIENCE', scheduledTimeSeconds: 2000, priority: 150 });
      engine.scheduleEvent({ id: 'science-scan-2', type: 'SCIENCE', scheduledTimeSeconds: 2000, priority: 150 });

      engine.advanceAndProcess(3000);

      // Priority 300 -> Priority 150 (scan 1 FIFO) -> Priority 150 (scan 2 FIFO) -> Priority 50
      expect(executionOrder).toEqual([
        'critical-burn',
        'science-scan-1',
        'science-scan-2',
        'low-log',
      ]);
    });

    it('strictly excludes cancelled events from executing', () => {
      const engine = new MissionEventEngine(0, true);
      const handler = vi.fn();
      engine.registerHandler('EVENT_TYPE', handler);

      engine.scheduleEvent({ id: 'evt-to-cancel', type: 'EVENT_TYPE', scheduledTimeSeconds: 1000 });
      engine.scheduleEvent({ id: 'evt-to-run', type: 'EVENT_TYPE', scheduledTimeSeconds: 1000 });

      // Cancel evt-to-cancel
      expect(engine.cancelEvent('evt-to-cancel')).toBe(true);

      const report = engine.advanceAndProcess(2000);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(report.executedEvents.map((e) => e.eventId)).toEqual(['evt-to-run']);
      expect(report.skippedEvents.map((e) => e.eventId)).not.toContain('evt-to-run');
    });
  });

  describe('Error Containment and Handler Failures', () => {
    it('catches handler exceptions and marks event as FAILED without stopping subsequent events', () => {
      const engine = new MissionEventEngine(0, true);
      const successfulRuns: string[] = [];

      engine.registerHandler('FAILING_TYPE', () => {
        throw new Error('Sensor telemetry hardware bus disconnected!');
      });

      engine.registerHandler('HEALTHY_TYPE', (event) => {
        successfulRuns.push(event.id);
      });

      engine.scheduleEvent({ id: 'good-1', type: 'HEALTHY_TYPE', scheduledTimeSeconds: 1000, priority: 200 });
      engine.scheduleEvent({ id: 'bad-event', type: 'FAILING_TYPE', scheduledTimeSeconds: 1000, priority: 150 });
      engine.scheduleEvent({ id: 'good-2', type: 'HEALTHY_TYPE', scheduledTimeSeconds: 1000, priority: 100 });

      const report = engine.advanceAndProcess(2000);

      // 2 succeeded, 1 failed
      expect(successfulRuns).toEqual(['good-1', 'good-2']);
      expect(report.executedEvents).toHaveLength(2);
      expect(report.failedEvents).toHaveLength(1);

      const failed = report.failedEvents[0];
      expect(failed.eventId).toBe('bad-event');
      expect(failed.status).toBe('FAILED');
      expect(failed.success).toBe(false);
      expect(failed.error).toContain('Sensor telemetry hardware bus disconnected!');

      // Verify execution history captures both successes and failure
      expect(engine.getExecutionHistory()).toHaveLength(3);
    });

    it('gracefully handles events with no registered handler', () => {
      const engine = new MissionEventEngine(0, true);

      engine.scheduleEvent({
        id: 'unhandled-event',
        type: 'CUSTOM_UNKNOWN_TYPE',
        scheduledTimeSeconds: 500,
      });

      const report = engine.advanceAndProcess(1000);
      expect(report.executedEvents).toHaveLength(1);
      expect(report.executedEvents[0].status).toBe('EXECUTED');
      expect(report.executedEvents[0].result).toBeUndefined();
    });

    it('unregisters handlers successfully', () => {
      const engine = new MissionEventEngine(0, true);
      const handler = vi.fn();

      engine.registerHandler('TEMP_EVENT', handler);
      expect(engine.unregisterHandler('TEMP_EVENT')).toBe(true);
      expect(engine.unregisterHandler('NON_EXISTENT')).toBe(false);

      engine.scheduleEvent({ id: 'temp-1', type: 'TEMP_EVENT', scheduledTimeSeconds: 100 });
      engine.advanceAndProcess(200);

      // Since handler was unregistered, it should execute as a no-op handler
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Convenience Time Advancement Helpers', () => {
    it('advances by minutes, hours, and days through convenience methods', () => {
      const engine = new MissionEventEngine(0, true);

      engine.advanceMinutes(10); // 600 s
      expect(engine.getMETSeconds()).toBe(600);

      engine.advanceHours(2); // +7200 s = 7800 s
      expect(engine.getMETSeconds()).toBe(7800);

      engine.advanceDays(1); // +86400 s = 94200 s
      expect(engine.getMETSeconds()).toBe(94200);
      expect(engine.getFormattedMET()).toBe('T+ 001d 02:10:00');
    });

    it('resets time, scheduler, and execution history', () => {
      const engine = new MissionEventEngine(0, true);
      engine.scheduleEvent({ id: 'evt-1', type: 'TEST', scheduledTimeSeconds: 100 });
      engine.advanceAndProcess(200);
      expect(engine.getExecutionHistory()).toHaveLength(1);

      engine.reset();
      expect(engine.getMETSeconds()).toBe(0);
      expect(engine.isPaused()).toBe(true);
      expect(engine.getExecutionHistory()).toHaveLength(0);
      expect(engine.getScheduler().getPendingCount()).toBe(0);
    });
  });

  describe('Re-Entrancy Protection (Phase 3.1)', () => {
    it('throws when advanceAndProcess is called re-entrantly from within an event handler', () => {
      const engine = new MissionEventEngine(0, true);
      let capturedError: Error | null = null;
      let lockStateDuringHandler = false;

      engine.registerHandler('REENTRANT_TRIGGER', () => {
        lockStateDuringHandler = engine.isAdvanceLocked();
        try {
          // Attempting recursive advancement must throw
          engine.advanceAndProcess(100);
        } catch (err) {
          capturedError = err as Error;
          throw err; // Re-throw to be contained by engine boundary
        }
      });

      engine.scheduleEvent({
        id: 'reentrant-evt',
        type: 'REENTRANT_TRIGGER',
        scheduledTimeSeconds: 50,
      });

      const report = engine.advanceAndProcess(100);

      expect(lockStateDuringHandler).toBe(true);
      expect(capturedError).not.toBeNull();
      expect(capturedError?.message).toContain('Re-entrant time advancement call detected');
      expect(report.failedEvents).toHaveLength(1);
      expect(report.failedEvents[0].error).toContain('Re-entrant time advancement call detected');
      // Lock must be released after completion
      expect(engine.isAdvanceLocked()).toBe(false);
    });

    it('releases re-entrancy lock even if an event handler throws an unexpected exception', () => {
      const engine = new MissionEventEngine(0, true);

      engine.registerHandler('CRASH_TRIGGER', () => {
        throw new Error('Hardware failure');
      });

      engine.scheduleEvent({ id: 'crash-evt', type: 'CRASH_TRIGGER', scheduledTimeSeconds: 50 });

      expect(engine.isAdvanceLocked()).toBe(false);
      engine.advanceAndProcess(100);
      expect(engine.isAdvanceLocked()).toBe(false);

      // Subsequent advance calls work cleanly
      const report = engine.advanceAndProcess(100);
      expect(report.timeAdvancedSeconds).toBe(100);
      expect(engine.isAdvanceLocked()).toBe(false);
    });
  });

  describe('Dynamic Event Scheduling & Chained Execution (Phase 3.1)', () => {
    it('allows event handlers to schedule future events without re-entrancy restrictions', () => {
      const engine = new MissionEventEngine(0, true);
      const executionHistory: string[] = [];

      engine.registerHandler('PARENT_EVENT', (_event, context) => {
        executionHistory.push(`PARENT at MET ${context.metSeconds}`);
        // Schedule a child event for the future
        engine.scheduleEvent({
          id: 'child-future',
          type: 'CHILD_EVENT',
          scheduledTimeSeconds: context.metSeconds + 1000,
        });
      });

      engine.registerHandler('CHILD_EVENT', (_event, context) => {
        executionHistory.push(`CHILD at MET ${context.metSeconds}`);
      });

      engine.scheduleEvent({ id: 'parent-1', type: 'PARENT_EVENT', scheduledTimeSeconds: 500 });

      // Step 1: Advance to 500s -> Parent runs and schedules child for 1500s
      engine.advanceAndProcess(500);
      expect(executionHistory).toEqual(['PARENT at MET 500']);
      expect(engine.getScheduler().getPendingCount()).toBe(1);
      expect(engine.getScheduler().getEvent('child-future')?.scheduledTimeSeconds).toBe(1500);

      // Step 2: Advance to 1500s -> Child runs
      engine.advanceAndProcess(1000);
      expect(executionHistory).toEqual(['PARENT at MET 500', 'CHILD at MET 1500']);
      expect(engine.getScheduler().getPendingCount()).toBe(0);
    });

    it('processes same-timestamp child events scheduled dynamically within the current time step', () => {
      const engine = new MissionEventEngine(0, true);
      const executionOrder: string[] = [];

      engine.registerHandler('STEP_CHAIN_A', (_event, context) => {
        executionOrder.push('CHAIN_A');
        // Schedule CHAIN_B at the current timestamp
        engine.scheduleEvent({
          id: 'chain-b',
          type: 'STEP_CHAIN_B',
          scheduledTimeSeconds: context.metSeconds,
          priority: 50,
        });
      });

      engine.registerHandler('STEP_CHAIN_B', (_event, context) => {
        executionOrder.push('CHAIN_B');
        // Schedule CHAIN_C at the current timestamp
        engine.scheduleEvent({
          id: 'chain-c',
          type: 'STEP_CHAIN_C',
          scheduledTimeSeconds: context.metSeconds,
          priority: 10,
        });
      });

      engine.registerHandler('STEP_CHAIN_C', () => {
        executionOrder.push('CHAIN_C');
      });

      engine.scheduleEvent({
        id: 'chain-a',
        type: 'STEP_CHAIN_A',
        scheduledTimeSeconds: 1000,
      });

      // Single step advance to 1000s processes the entire chain
      const report = engine.advanceAndProcess(1000);

      expect(executionOrder).toEqual(['CHAIN_A', 'CHAIN_B', 'CHAIN_C']);
      expect(report.eventsProcessedCount).toBe(3);
      expect(report.stepLimitReached).toBe(false);
      expect(engine.getScheduler().getPendingCount()).toBe(0);
    });

    it('enforces maxEventsPerStep limit to safely prevent infinite loops on runaway chaining', () => {
      const engine = new MissionEventEngine(0, true);
      engine.setMaxEventsPerStep(10); // set small limit for testing

      let counter = 0;
      engine.registerHandler('INFINITE_CHAIN', (_event, context) => {
        counter++;
        engine.scheduleEvent({
          id: `chain-evt-${counter}`,
          type: 'INFINITE_CHAIN',
          scheduledTimeSeconds: context.metSeconds,
        });
      });

      engine.scheduleEvent({
        id: 'chain-evt-0',
        type: 'INFINITE_CHAIN',
        scheduledTimeSeconds: 100,
      });

      const report = engine.advanceAndProcess(100);

      // Must halt exactly at limit
      expect(report.eventsProcessedCount).toBe(10);
      expect(report.stepLimitReached).toBe(true);
      // The 11th scheduled event must remain PENDING in the scheduler
      expect(engine.getScheduler().getPendingCount()).toBe(1);
      const remaining = engine.getScheduler().getPendingEvents()[0];
      expect(remaining.status).toBe('PENDING');
      expect(remaining.id).toBe('chain-evt-10');
    });

    it('validates setMaxEventsPerStep inputs strictly', () => {
      const engine = new MissionEventEngine(0, true);
      expect(engine.getMaxEventsPerStep()).toBe(1000);

      engine.setMaxEventsPerStep(500);
      expect(engine.getMaxEventsPerStep()).toBe(500);

      expect(() => engine.setMaxEventsPerStep(0)).toThrow(TypeError);
      expect(() => engine.setMaxEventsPerStep(-10)).toThrow(TypeError);
      expect(() => engine.setMaxEventsPerStep(12.5)).toThrow(TypeError);
      expect(() => engine.setMaxEventsPerStep(NaN)).toThrow(TypeError);
    });
  });

  describe('History Retention & Pruning (Phase 3.1)', () => {
    it('prunes execution history and delegates event pruning to the scheduler', () => {
      const engine = new MissionEventEngine(0, true);

      engine.scheduleEvent({ id: 'evt-1', type: 'TEST', scheduledTimeSeconds: 100 });
      engine.scheduleEvent({ id: 'evt-2', type: 'TEST', scheduledTimeSeconds: 500 });
      engine.scheduleEvent({ id: 'evt-future', type: 'TEST', scheduledTimeSeconds: 2000 });

      // Advance to 1000s -> evt-1 and evt-2 execute, evt-future remains pending
      engine.advanceAndProcess(1000);
      expect(engine.getExecutionHistory()).toHaveLength(2);
      expect(engine.getScheduler().getPendingCount()).toBe(1);

      // Prune history older than or at 300s (only evt-1 executed at 1000s? Wait, executedAtSeconds is 1000!)
      // Let's prune with no MET filter -> prunes all executed events and execution history
      const result = engine.pruneHistory();
      expect(result.prunedExecutionReports).toBe(2);
      expect(result.prunedSchedulerEvents).toBe(2);
      expect(engine.getExecutionHistory()).toHaveLength(0);

      // STRICT INVARIANT: Pending future event must remain intact
      expect(engine.getScheduler().getPendingCount()).toBe(1);
      expect(engine.getScheduler().getEvent('evt-future')?.status).toBe('PENDING');
    });

    it('prunes execution history filtered by olderThanMETSeconds', () => {
      const engine = new MissionEventEngine(0, true);

      // Advance step 1 at 100s
      engine.scheduleEvent({ id: 'e1', type: 'TEST', scheduledTimeSeconds: 50 });
      engine.advanceAndProcess(100);

      // Advance step 2 at 500s
      engine.scheduleEvent({ id: 'e2', type: 'TEST', scheduledTimeSeconds: 300 });
      engine.advanceAndProcess(400); // MET is now 500s

      expect(engine.getExecutionHistory()).toHaveLength(2);

      // Prune history for records executed at or before 200s (should prune e1, keep e2)
      const res = engine.pruneHistory({ olderThanMETSeconds: 200 });
      expect(res.prunedExecutionReports).toBe(1);
      expect(engine.getExecutionHistory()).toHaveLength(1);
      expect(engine.getExecutionHistory()[0].eventId).toBe('e2');
    });
  });
});
