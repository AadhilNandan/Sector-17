import { describe, it, expect } from 'vitest';
import { EventScheduler, compareEvents, deepCloneAndFreeze } from '../src/simulation/operations/eventScheduler';
import type { MissionEvent } from '../src/simulation/types';

describe('Event Scheduler Engine', () => {
  describe('Single and Multiple Event Scheduling', () => {
    it('schedules a single event and assigns default priority and status', () => {
      const scheduler = new EventScheduler();
      const event = scheduler.schedule({
        id: 'evt-tcm-1',
        type: 'COURSE_CORRECTION',
        scheduledTimeSeconds: 3600,
        payload: { deltaV: 15.2 },
      });

      expect(event.id).toBe('evt-tcm-1');
      expect(event.type).toBe('COURSE_CORRECTION');
      expect(event.scheduledTimeSeconds).toBe(3600);
      expect(event.status).toBe('PENDING');
      expect(event.priority).toBe(100);
      expect(event.sequenceNumber).toBe(1);
      expect(scheduler.getPendingCount()).toBe(1);
    });

    it('retrieves an event by ID', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({
        id: 'evt-scan',
        type: 'SCIENCE_SCAN',
        scheduledTimeSeconds: 5000,
      });

      const retrieved = scheduler.getEvent('evt-scan');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('evt-scan');
      expect(scheduler.getEvent('non-existent')).toBeUndefined();
    });

    it('returns empty array when scheduler is empty', () => {
      const scheduler = new EventScheduler();
      expect(scheduler.getAllEvents()).toEqual([]);
      expect(scheduler.getPendingEvents()).toEqual([]);
      expect(scheduler.extractDueEvents(1000)).toEqual([]);
      expect(scheduler.getPendingCount()).toBe(0);
    });
  });

  describe('Chronological and Deterministic Ordering', () => {
    it('orders events chronologically by scheduled simulation time', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({ id: 'late', type: 'EVENT', scheduledTimeSeconds: 10000 });
      scheduler.schedule({ id: 'early', type: 'EVENT', scheduledTimeSeconds: 1000 });
      scheduler.schedule({ id: 'mid', type: 'EVENT', scheduledTimeSeconds: 5000 });

      const sorted = scheduler.getPendingEvents();
      expect(sorted[0].id).toBe('early');
      expect(sorted[1].id).toBe('mid');
      expect(sorted[2].id).toBe('late');
    });

    it('orders events with identical timestamps deterministically by priority', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({
        id: 'low-prio',
        type: 'LOG',
        scheduledTimeSeconds: 2000,
        priority: 50,
      });
      scheduler.schedule({
        id: 'high-prio',
        type: 'CRITICAL_BURN',
        scheduledTimeSeconds: 2000,
        priority: 200,
      });
      scheduler.schedule({
        id: 'med-prio',
        type: 'TELEMETRY',
        scheduledTimeSeconds: 2000,
        priority: 100,
      });

      const due = scheduler.extractDueEvents(2000);
      expect(due[0].id).toBe('high-prio');
      expect(due[1].id).toBe('med-prio');
      expect(due[2].id).toBe('low-prio');
    });

    it('breaks ties deterministically using FIFO sequence number when timestamp and priority are equal', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({ id: 'first', type: 'A', scheduledTimeSeconds: 3000, priority: 100 });
      scheduler.schedule({ id: 'second', type: 'B', scheduledTimeSeconds: 3000, priority: 100 });
      scheduler.schedule({ id: 'third', type: 'C', scheduledTimeSeconds: 3000, priority: 100 });

      const due = scheduler.extractDueEvents(3000);
      expect(due[0].id).toBe('first');
      expect(due[1].id).toBe('second');
      expect(due[2].id).toBe('third');
    });

    it('unit tests compareEvents helper directly', () => {
      const e1: MissionEvent = {
        id: 'a',
        type: 'X',
        scheduledTimeSeconds: 100,
        priority: 100,
        sequenceNumber: 1,
        status: 'PENDING',
        payload: null,
        createdAtSeconds: 0,
      };
      const e2: MissionEvent = {
        ...e1,
        id: 'b',
        scheduledTimeSeconds: 200,
      };
      expect(compareEvents(e1, e2)).toBeLessThan(0);
      expect(compareEvents(e2, e1)).toBeGreaterThan(0);
    });
  });

  describe('Event Cancellation & Due Event Extraction', () => {
    it('cancels pending events successfully', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({ id: 'evt-1', type: 'TEST', scheduledTimeSeconds: 1000 });
      scheduler.schedule({ id: 'evt-2', type: 'TEST', scheduledTimeSeconds: 2000 });

      expect(scheduler.cancel('evt-1')).toBe(true);
      expect(scheduler.getEvent('evt-1')?.status).toBe('CANCELLED');
      expect(scheduler.getPendingCount()).toBe(1);

      // Cancelling an already cancelled or non-existent event returns false
      expect(scheduler.cancel('evt-1')).toBe(false);
      expect(scheduler.cancel('unknown-id')).toBe(false);
    });

    it('extracts only events due on or before target time and excludes cancelled events from execution', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({ id: 'due-1', type: 'A', scheduledTimeSeconds: 500 });
      scheduler.schedule({ id: 'due-2', type: 'B', scheduledTimeSeconds: 1000 });
      scheduler.schedule({ id: 'due-cancelled', type: 'C', scheduledTimeSeconds: 800 });
      scheduler.schedule({ id: 'future', type: 'D', scheduledTimeSeconds: 2000 });

      scheduler.cancel('due-cancelled');

      const due = scheduler.extractDueEvents(1000);
      const dueIds = due.map((e) => e.id);

      expect(dueIds).toContain('due-1');
      expect(dueIds).toContain('due-2');
      expect(dueIds).not.toContain('due-cancelled'); // Cancelled event excluded from due pending list
      expect(dueIds).not.toContain('future');
    });

    it('clears all events and resets sequence counter', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({ id: 'e1', type: 'A', scheduledTimeSeconds: 100 });
      scheduler.clear();
      expect(scheduler.getAllEvents()).toHaveLength(0);
      expect(scheduler.getPendingCount()).toBe(0);
    });
  });

  describe('Error Handling and Input Validation', () => {
    it('rejects duplicate event IDs with an explicit error', () => {
      const scheduler = new EventScheduler();
      scheduler.schedule({ id: 'burn-1', type: 'PROPULSION', scheduledTimeSeconds: 1000 });

      expect(() =>
        scheduler.schedule({ id: 'burn-1', type: 'PROPULSION', scheduledTimeSeconds: 2000 })
      ).toThrow(/Duplicate event ID/);
    });

    it('rejects past-time scheduling relative to current MET', () => {
      const scheduler = new EventScheduler();
      // Current MET is 5,000 s
      expect(() =>
        scheduler.schedule({ id: 'past-event', type: 'TEST', scheduledTimeSeconds: 4000 }, 5000)
      ).toThrow(RangeError);
    });

    it('rejects invalid event parameters', () => {
      const scheduler = new EventScheduler();

      // Empty ID
      expect(() =>
        scheduler.schedule({ id: '', type: 'A', scheduledTimeSeconds: 100 })
      ).toThrow(TypeError);

      // Empty Type
      expect(() =>
        scheduler.schedule({ id: '1', type: '', scheduledTimeSeconds: 100 })
      ).toThrow(TypeError);

      // Non-finite scheduled time
      expect(() =>
        scheduler.schedule({ id: '1', type: 'A', scheduledTimeSeconds: NaN })
      ).toThrow(TypeError);

      expect(() =>
        scheduler.schedule({ id: '1', type: 'A', scheduledTimeSeconds: Infinity })
      ).toThrow(TypeError);

      // Non-finite current MET
      expect(() =>
        scheduler.schedule({ id: '1', type: 'A', scheduledTimeSeconds: 100 }, NaN)
      ).toThrow(TypeError);
    });
  });

  describe('Deep Payload Immutability & Type Protection', () => {
    it('deeply freezes nested objects and arrays within payload', () => {
      const scheduler = new EventScheduler();
      const rawPayload = {
        subsystem: 'telemetry',
        nested: {
          sensor: 'temp-1',
          limits: [100, 200, 300],
          config: { active: true },
        },
      };

      const event = scheduler.schedule({
        id: 'evt-freeze',
        type: 'TELEMETRY',
        scheduledTimeSeconds: 100,
        payload: rawPayload,
      });

      // Modifying outer payload throws in strict mode
      expect(() => {
        (event.payload as Record<string, unknown>).subsystem = 'corrupted';
      }).toThrow();

      // Modifying nested object throws
      expect(() => {
        (event.payload as any).nested.sensor = 'corrupted';
      }).toThrow();

      // Modifying nested array throws
      expect(() => {
        (event.payload as any).nested.limits.push(999);
      }).toThrow();

      // Modifying deeply nested object throws
      expect(() => {
        (event.payload as any).nested.config.active = false;
      }).toThrow();

      // Original caller object remains unfrozen and mutable
      rawPayload.nested.sensor = 'unaffected-original';
      expect(rawPayload.nested.sensor).toBe('unaffected-original');
      expect((event.payload as any).nested.sensor).toBe('temp-1');
    });

    it('rejects functions in event payloads', () => {
      const scheduler = new EventScheduler();
      expect(() =>
        scheduler.schedule({
          id: 'evt-fn',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: { action: () => 'execute' },
        })
      ).toThrow(TypeError);

      expect(() =>
        scheduler.schedule({
          id: 'evt-fn-root',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: () => {},
        })
      ).toThrow(TypeError);
    });

    it('rejects symbols in event payloads', () => {
      const scheduler = new EventScheduler();
      expect(() =>
        scheduler.schedule({
          id: 'evt-sym',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: { id: Symbol('test') },
        })
      ).toThrow(TypeError);
    });

    it('rejects non-plain object instances in event payloads', () => {
      const scheduler = new EventScheduler();

      // Date instance
      expect(() =>
        scheduler.schedule({
          id: 'evt-date',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: { timestamp: new Date() },
        })
      ).toThrow(/Non-plain object instance/);

      // Map instance
      expect(() =>
        scheduler.schedule({
          id: 'evt-map',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: { map: new Map() },
        })
      ).toThrow(/Non-plain object instance/);

      // Custom class instance
      class SpacecraftCommand {
        code = 42;
      }
      expect(() =>
        scheduler.schedule({
          id: 'evt-class',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: new SpacecraftCommand(),
        })
      ).toThrow(/Non-plain object instance/);
    });

    it('detects and rejects circular references in event payloads', () => {
      const scheduler = new EventScheduler();
      const circularObj: any = { name: 'circular-root' };
      circularObj.self = circularObj;

      expect(() =>
        scheduler.schedule({
          id: 'evt-circ',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: circularObj,
        })
      ).toThrow(/Circular reference detected/);

      // Deep circular reference
      const objA: any = { prop: 'a' };
      const objB: any = { parent: objA };
      objA.child = objB;

      expect(() =>
        scheduler.schedule({
          id: 'evt-deep-circ',
          type: 'TEST',
          scheduledTimeSeconds: 100,
          payload: objA,
        })
      ).toThrow(/Circular reference detected/);
    });

    it('unit tests deepCloneAndFreeze helper on primitive values', () => {
      expect(deepCloneAndFreeze(42)).toBe(42);
      expect(deepCloneAndFreeze('sector-17')).toBe('sector-17');
      expect(deepCloneAndFreeze(true)).toBe(true);
      expect(deepCloneAndFreeze(null)).toBe(null);
      expect(deepCloneAndFreeze(undefined)).toBe(undefined);
      expect(deepCloneAndFreeze(100n)).toBe(100n);
    });
  });

  describe('Safe Event Pruning (Memory Management)', () => {
    it('prunes executed, cancelled, and failed events while strictly preserving pending events', () => {
      const scheduler = new EventScheduler();

      // Schedule several events
      const e1 = scheduler.schedule({ id: 'evt-exec', type: 'TEST', scheduledTimeSeconds: 100 });
      const e2 = scheduler.schedule({ id: 'evt-cancel', type: 'TEST', scheduledTimeSeconds: 200 });
      const e3 = scheduler.schedule({ id: 'evt-pending-old', type: 'TEST', scheduledTimeSeconds: 50 });
      const e4 = scheduler.schedule({ id: 'evt-pending-future', type: 'TEST', scheduledTimeSeconds: 500 });

      // Mark e1 as EXECUTED, e2 as CANCELLED
      e1.status = 'EXECUTED';
      scheduler.cancel(e2.id);

      expect(scheduler.getPendingCount()).toBe(2);
      expect(scheduler.getAllEvents()).toHaveLength(4);

      // Prune all non-pending events
      const pruned = scheduler.pruneEvents();
      expect(pruned).toBe(2); // e1 and e2 pruned
      expect(scheduler.getAllEvents()).toHaveLength(2);

      // STRICT INVARIANT CHECK: Both pending events must remain intact
      expect(scheduler.getEvent('evt-pending-old')).toBeDefined();
      expect(scheduler.getEvent('evt-pending-old')?.status).toBe('PENDING');
      expect(scheduler.getEvent('evt-pending-future')).toBeDefined();
      expect(scheduler.getEvent('evt-pending-future')?.status).toBe('PENDING');
      expect(scheduler.getPendingCount()).toBe(2);
    });

    it('respects olderThanMETSeconds filter during pruning', () => {
      const scheduler = new EventScheduler();

      const e1 = scheduler.schedule({ id: 'e1', type: 'TEST', scheduledTimeSeconds: 100 });
      const e2 = scheduler.schedule({ id: 'e2', type: 'TEST', scheduledTimeSeconds: 500 });
      e1.status = 'EXECUTED';
      e2.status = 'EXECUTED';

      // Prune only events scheduled at or before 200 s
      const pruned = scheduler.pruneEvents({ olderThanMETSeconds: 200 });
      expect(pruned).toBe(1);
      expect(scheduler.getEvent('e1')).toBeUndefined();
      expect(scheduler.getEvent('e2')).toBeDefined();
      expect(scheduler.getEvent('e2')?.status).toBe('EXECUTED');
    });

    it('honors removeExecuted and removeCancelled option flags', () => {
      const scheduler = new EventScheduler();

      const e1 = scheduler.schedule({ id: 'e1', type: 'TEST', scheduledTimeSeconds: 100 });
      const e2 = scheduler.schedule({ id: 'e2', type: 'TEST', scheduledTimeSeconds: 100 });
      e1.status = 'EXECUTED';
      scheduler.cancel(e2.id);

      // Only prune cancelled events, preserve executed
      const pruned = scheduler.pruneEvents({ removeExecuted: false, removeCancelled: true });
      expect(pruned).toBe(1);
      expect(scheduler.getEvent('e1')).toBeDefined();
      expect(scheduler.getEvent('e2')).toBeUndefined();
    });
  });
});
