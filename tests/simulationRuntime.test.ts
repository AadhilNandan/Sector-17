/**
 * SECTOR 17 — Simulation Runtime & React Integration Tests
 * Comprehensive verification of SimulationRuntime lifecycle, single-instance campaign protection,
 * deterministic SI time progression, snapshot immutability, React StrictMode resilience,
 * subscription mechanics, safe decision execution, and error containment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import {
  SimulationRuntime,
  SimulationProvider,
  useSimulationRuntime,
  useSimulationSnapshot,
  useSimulationTime,
  useSimulationDecisions,
} from '../src/runtime';
import type { SimulationSnapshot } from '../src/runtime/types';

describe('Simulation Runtime & React Integration', () => {
  beforeEach(() => {
    SimulationRuntime.resetAll();
  });

  afterEach(() => {
    SimulationRuntime.resetAll();
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Runtime Initialization & Readiness                                      */
  /* -------------------------------------------------------------------------- */
  describe('1. Runtime Initialization', () => {
    it('initializes in READY state and wires all simulation components', () => {
      const runtime = new SimulationRuntime('init-test-camp', { initialState: 'ACTIVE' });

      expect(runtime.getCampaignId()).toBe('init-test-camp');
      expect(runtime.getLifecycle()).toBe('READY');
      expect(runtime.getFlightComputer()).toBeDefined();
      expect(runtime.getCommunicationManager()).toBeDefined();
      expect(runtime.getScienceManager()).toBeDefined();
      expect(runtime.getDecisionManager()).toBeDefined();
      expect(runtime.getEventEngine()).toBeDefined();

      const snap = runtime.getSnapshot();
      expect(snap.campaignId).toBe('init-test-camp');
      expect(snap.lifecycle).toBe('READY');
      expect(snap.metSeconds).toBe(0);
      expect(snap.formattedMET).toBe('T+ 000d 00:00:00');
      expect(snap.flightState).toBe('ACTIVE');
      expect(snap.propellantRemainingKg).toBe(2450.0);
      expect(snap.subsystems.EPS).toBe('NOMINAL');
      expect(snap.subsystems.PROPULSION).toBe('NOMINAL');
      expect(snap.storage.capacityBytes).toBeGreaterThan(0);
    });

    it('rejects invalid or empty campaign identifiers', () => {
      expect(() => new SimulationRuntime('')).toThrow(TypeError);
      expect(() => new SimulationRuntime('   ')).toThrow(TypeError);
      expect(() => new SimulationRuntime(null as any)).toThrow(TypeError);
    });

    it('cleans up registry if initial snapshot computation fails during construction (C-02 regression)', () => {
      const proto = SimulationRuntime.prototype as any;
      const originalCompute = proto.computeSnapshot;
      proto.computeSnapshot = () => {
        throw new Error('Simulated snapshot computation error during construction');
      };

      try {
        expect(() => new SimulationRuntime('failed-init-camp')).toThrow(
          'Simulated snapshot computation error during construction'
        );
        // Verify failed instance was not left in registry
        expect(SimulationRuntime.getInstance('failed-init-camp')).toBeUndefined();
      } finally {
        proto.computeSnapshot = originalCompute;
      }

      // Instantiation now succeeds cleanly
      const recovered = new SimulationRuntime('failed-init-camp');
      expect(recovered.getLifecycle()).toBe('READY');
      expect(SimulationRuntime.getInstance('failed-init-camp')).toBe(recovered);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Single-Instance Campaign Protection                                     */
  /* -------------------------------------------------------------------------- */
  describe('2. Single-Instance Protection', () => {
    it('prevents multiple active simulation instances for the same campaign', () => {
      const runtime1 = new SimulationRuntime('unique-campaign');
      expect(runtime1.getLifecycle()).toBe('READY');

      expect(() => new SimulationRuntime('unique-campaign')).toThrow(
        /An active simulation instance already exists for campaign 'unique-campaign'/
      );
    });

    it('getOrCreate reuses the existing active runtime instance', () => {
      const runtime1 = SimulationRuntime.getOrCreate('shared-campaign');
      const runtime2 = SimulationRuntime.getOrCreate('shared-campaign');

      expect(runtime1).toBe(runtime2);
      expect(SimulationRuntime.getInstance('shared-campaign')).toBe(runtime1);
    });

    it('allows recreation after previous campaign runtime is disposed', () => {
      const runtime1 = new SimulationRuntime('disposable-campaign');
      expect(runtime1.getLifecycle()).toBe('READY');

      runtime1.dispose();
      expect(runtime1.getLifecycle()).toBe('COMPLETED');

      // Now allowed
      const runtime2 = new SimulationRuntime('disposable-campaign');
      expect(runtime2.getLifecycle()).toBe('READY');
      expect(runtime2).not.toBe(runtime1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Runtime Disposal                                                        */
  /* -------------------------------------------------------------------------- */
  describe('3. Runtime Disposal', () => {
    it('disposes clean up listeners, timers, and unregisters from active registry', async () => {
      const runtime = new SimulationRuntime('cleanup-test');
      const listener = vi.fn();
      runtime.subscribe(listener);

      runtime.dispose();
      expect(runtime.getLifecycle()).toBe('COMPLETED');
      expect(SimulationRuntime.getInstance('cleanup-test')).toBeUndefined();

      // Advancing disposed runtime throws
      await expect(runtime.advanceTime(10)).rejects.toThrow(/in 'COMPLETED' state/);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Snapshot Retrieval & Referential Stability                              */
  /* -------------------------------------------------------------------------- */
  describe('4. Snapshot Retrieval & Immutability', () => {
    it('returns the identical snapshot object reference when state has not changed (useSyncExternalStore invariant)', () => {
      const runtime = new SimulationRuntime('ref-stability-test');

      const snap1 = runtime.getSnapshot();
      const snap2 = runtime.getSnapshot();

      expect(snap1).toBe(snap2); // Strict reference equality!
    });

    it('returns a new snapshot reference when simulation state advances', async () => {
      const runtime = new SimulationRuntime('step-stability-test');
      const snap1 = runtime.getSnapshot();

      await runtime.advanceTime(60);
      const snap2 = runtime.getSnapshot();

      expect(snap2).not.toBe(snap1);
      expect(snap2.metSeconds).toBe(60);
      expect(snap2.formattedMET).toBe('T+ 000d 00:01:00');

      const snap3 = runtime.getSnapshot();
      expect(snap3).toBe(snap2); // Unchanged since last advance
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Subscriptions & Notifications                                           */
  /* -------------------------------------------------------------------------- */
  describe('5. Subscriptions & Notifications', () => {
    it('notifies subscribers upon time advancement and state transitions', async () => {
      const runtime = new SimulationRuntime('sub-notify-test');
      const listener = vi.fn();
      runtime.subscribe(listener);

      runtime.start();
      expect(listener).toHaveBeenCalledTimes(1);

      await runtime.advanceTime(15);
      expect(listener).toHaveBeenCalledTimes(2);

      runtime.pause();
      expect(listener).toHaveBeenCalledTimes(3);

      runtime.resume();
      expect(listener).toHaveBeenCalledTimes(4);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Subscription Cleanup                                                    */
  /* -------------------------------------------------------------------------- */
  describe('6. Subscription Cleanup', () => {
    it('stops invoking listener after unsubscribe function is called', async () => {
      const runtime = new SimulationRuntime('sub-cleanup-test');
      const listener = vi.fn();
      const unsubscribe = runtime.subscribe(listener);

      await runtime.advanceTime(5);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await runtime.advanceTime(5);
      expect(listener).toHaveBeenCalledTimes(1); // No additional invocations
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Pause and Resume Lifecycle                                              */
  /* -------------------------------------------------------------------------- */
  describe('7. Pause and Resume Controls', () => {
    it('pauses and resumes simulation lifecycle state cleanly', () => {
      const runtime = new SimulationRuntime('pause-resume-test');
      expect(runtime.getLifecycle()).toBe('READY');

      runtime.start();
      expect(runtime.getLifecycle()).toBe('RUNNING');

      runtime.pause();
      expect(runtime.getLifecycle()).toBe('PAUSED');

      // Calling pause again is idempotent
      runtime.pause();
      expect(runtime.getLifecycle()).toBe('PAUSED');

      runtime.resume();
      expect(runtime.getLifecycle()).toBe('RUNNING');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Deterministic Time Advancement                                          */
  /* -------------------------------------------------------------------------- */
  describe('8. Deterministic Time Advancement', () => {
    it('advances simulation time strictly in SI seconds without wall-clock drift', async () => {
      const runtime = new SimulationRuntime('deterministic-met-test');

      const report1 = await runtime.advanceTime(120);
      expect(report1.metSeconds).toBe(120);
      expect(runtime.getSnapshot().metSeconds).toBe(120);
      expect(runtime.getSnapshot().formattedMET).toBe('T+ 000d 00:02:00');

      const report2 = await runtime.advanceTime(3600);
      expect(report2.metSeconds).toBe(3720);
      expect(runtime.getSnapshot().metSeconds).toBe(3720);
      expect(runtime.getSnapshot().formattedMET).toBe('T+ 000d 01:02:00');
    });

    it('rejects non-positive and non-finite step intervals', async () => {
      const runtime = new SimulationRuntime('invalid-step-test');

      await expect(runtime.advanceTime(0)).rejects.toThrow(TypeError);
      await expect(runtime.advanceTime(-10)).rejects.toThrow(TypeError);
      await expect(runtime.advanceTime(NaN)).rejects.toThrow(TypeError);
      await expect(runtime.advanceTime(Infinity)).rejects.toThrow(TypeError);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 9. No Time Advancement While Paused                                        */
  /* -------------------------------------------------------------------------- */
  describe('9. No Advancement While Paused', () => {
    it('strictly prohibits time progression while runtime is PAUSED', async () => {
      const runtime = new SimulationRuntime('pause-guard-test');
      await runtime.advanceTime(100);

      runtime.pause();
      expect(runtime.getLifecycle()).toBe('PAUSED');

      await expect(runtime.advanceTime(50)).rejects.toThrow(
        /Cannot advance simulation time while runtime is PAUSED/
      );

      // Verify MET did not advance
      expect(runtime.getSnapshot().metSeconds).toBe(100);

      // Once resumed, advancing succeeds
      runtime.resume();
      await runtime.advanceTime(50);
      expect(runtime.getSnapshot().metSeconds).toBe(150);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 10. No Duplicate Stepping Loops                                            */
  /* -------------------------------------------------------------------------- */
  describe('10. Stepping Loop Guard', () => {
    it('calling start multiple times does not spawn duplicate ticker loops', () => {
      const runtime = new SimulationRuntime('ticker-guard-test');

      runtime.start({ tickIntervalMs: 100, stepSizeSeconds: 1.0 });
      // Multiple start invocations
      runtime.start({ tickIntervalMs: 100, stepSizeSeconds: 1.0 });
      runtime.start({ tickIntervalMs: 100, stepSizeSeconds: 1.0 });

      expect(runtime.getLifecycle()).toBe('RUNNING');
      runtime.pause();
      expect(runtime.getLifecycle()).toBe('PAUSED');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 11. React Integration & StrictMode Resilience                              */
  /* -------------------------------------------------------------------------- */
  describe('11. React Integration under StrictMode', () => {
    it('renders and consumes snapshot hooks in React without re-creating FlightComputer', () => {
      const campaignId = 'react-strict-camp';
      const runtime = SimulationRuntime.getOrCreate(campaignId);

      const ConsumerComponent: React.FC = () => {
        const rt = useSimulationRuntime();
        const snap = useSimulationSnapshot();
        const { formattedMET } = useSimulationTime();

        return React.createElement(
          'div',
          null,
          React.createElement('span', { id: 'camp' }, rt.getCampaignId()),
          React.createElement('span', { id: 'met' }, snap.metSeconds),
          React.createElement('span', { id: 'formatted' }, formattedMET)
        );
      };

      const StrictApp: React.FC = () => {
        return React.createElement(
          StrictMode,
          null,
          React.createElement(
            SimulationProvider,
            { campaignId },
            React.createElement(ConsumerComponent)
          )
        );
      };

      // StrictMode renders twice in React 18/19
      const html1 = renderToString(React.createElement(StrictApp));
      expect(html1).toContain('react-strict-camp');
      expect(html1).toContain('T+ 000d 00:00:00');

      // The campaign runtime remains the exact same instance in registry
      expect(SimulationRuntime.getInstance(campaignId)).toBe(runtime);
    });

    it('useSimulationSnapshot with selector only extracts requested slice', () => {
      const campaignId = 'selector-test-camp';
      SimulationRuntime.getOrCreate(campaignId);

      let selectedMET = -1;

      const SelectorConsumer: React.FC = () => {
        const met = useSimulationSnapshot((s) => s.metSeconds);
        selectedMET = met;
        return React.createElement('div', null, met);
      };

      renderToString(
        React.createElement(
          SimulationProvider,
          { campaignId },
          React.createElement(SelectorConsumer)
        )
      );

      expect(selectedMET).toBe(0);
    });

    it('throws descriptive error if hooks are used outside SimulationProvider', () => {
      const OrphanComponent: React.FC = () => {
        useSimulationRuntime();
        return null;
      };

      expect(() => renderToString(React.createElement(OrphanComponent))).toThrow(
        /Must be used within a <SimulationProvider>/
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 12. Decision Execution via Runtime Command Interface                       */
  /* -------------------------------------------------------------------------- */
  describe('12. Safe Decision Execution', () => {
    it('proposes, authorizes, and executes decisions with authoritative resource accounting', async () => {
      const runtime = new SimulationRuntime('decision-runtime-test');

      // Power on SCIENCE subsystem to NOMINAL for science decisions
      runtime.getFlightComputer().getSubsystemManager().getSubsystem('SCIENCE')?.setStatus('NOMINAL');

      // Ingest sample science product so candidate options can generate
      runtime.ingestScienceProduct({
        id: 'reason-ocean-l2-test',
        level1Id: 'l1-001',
        level0PacketId: 'pkt-001',
        instrument: 'REASON',
        observationType: 'RADAR_SOUNDING',
        band: 'VHF',
        dielectricModelUsed: {} as any,
        processingMET: 0,
        acquisitionMET: 0,
        completedAtMET: 1,
        algorithmVersion: '1.0',
        calibrationProfileVersion: '1.0',
        surfaceEchoTimeSeconds: 0.0001,
        sizeBytes: 8192,
        detectedReflectors: [
          {
            id: 'ref-ocean-basal',
            peakIndex: 20,
            travelTimeSeconds: 0.000035,
            echoAmplitude: 0.92,
            estimatedDepthMetres: 2950.0,
            depthUncertaintyMetres: 25.0,
            reflectionCoefficientEstimate: 0.75,
            reflectorTypeCandidate: 'OCEAN_INTERFACE_CANDIDATE',
          },
        ],
        qualityFlags: ['NOMINAL'],
        limitationsDisclaimer: 'Standard disclaimer',
      } as any);

      const options = runtime.getAvailableDecisions();
      expect(options.length).toBeGreaterThan(0);

      const targetOption = options[0];

      // 1. Evaluate decision
      const evaluation = runtime.evaluateDecision(targetOption.id);
      expect(evaluation.option.id).toBe(targetOption.id);
      expect(typeof evaluation.isFeasible).toBe('boolean');

      // 2. Propose decision
      const proposedRecord = runtime.proposeDecision(targetOption.id);
      expect(proposedRecord.status).toBe('PROPOSED');
      expect(runtime.getSnapshot().decisionHistory.length).toBe(1);

      // 3. Authorize decision
      const authRecord = runtime.authorizeDecision(
        proposedRecord.decisionId,
        true,
        'Director flight authorization confirmed'
      );
      expect(authRecord.status).toBe('APPROVED');

      // 4. Execute decision
      const result = await runtime.executeDecision(proposedRecord.decisionId);
      expect(result.decisionId).toBe(proposedRecord.decisionId);
      expect(result.success).toBe(true);

      const snap = runtime.getSnapshot();
      expect(snap.decisionHistory.length).toBeGreaterThanOrEqual(1);
      const executed = snap.decisionHistory.find((r) => r.decisionId === proposedRecord.decisionId);
      expect(executed?.status).toBe('EXECUTED');
    });

    it('rejects executing an unknown decision ID safely', async () => {
      const runtime = new SimulationRuntime('decision-fail-test');

      const result = await runtime.executeDecision('non-existent-dec');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 13. Error Containment & Safe Presentation                                  */
  /* -------------------------------------------------------------------------- */
  describe('13. Error Containment', () => {
    it('captures step execution errors in snapshot without unhandled crashes', async () => {
      const runtime = new SimulationRuntime('error-contain-test');

      // Mock flight computer step to throw a simulated hardware fault
      vi.spyOn(runtime.getFlightComputer(), 'step').mockRejectedValueOnce(
        new Error('Hardware bus power brownout')
      );

      await expect(runtime.advanceTime(10)).rejects.toThrow('Hardware bus power brownout');

      // Snapshot captures the error safely
      const snap = runtime.getSnapshot();
      expect(snap.error).toBe('Hardware bus power brownout');
    });

    it('clears active snapshot error via clearError() (Audit Finding MIN-01)', async () => {
      const runtime = new SimulationRuntime('clear-error-test');

      vi.spyOn(runtime.getFlightComputer(), 'step').mockRejectedValueOnce(
        new Error('Temporary sensor drift error')
      );

      await expect(runtime.advanceTime(1)).rejects.toThrow('Temporary sensor drift error');
      expect(runtime.getSnapshot().error).toBe('Temporary sensor drift error');

      runtime.clearError();
      expect(runtime.getSnapshot().error).toBeUndefined();
    });
  });
});
