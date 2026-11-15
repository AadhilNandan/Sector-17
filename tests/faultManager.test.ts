import { describe, it, expect, vi } from 'vitest';
import { FaultManager } from '../src/simulation/flightSoftware/faultManager';
import { SubsystemManager } from '../src/simulation/flightSoftware/subsystemManager';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { FSW_EVENT_TYPES } from '../src/simulation/flightSoftware/constants';

describe('Flight Software — Fault Manager & Autonomous Safety', () => {
  it('registers and categorizes faults by severity', () => {
    const subsystemManager = new SubsystemManager(true);
    const faultManager = new FaultManager(subsystemManager);

    const f1 = faultManager.raiseFault({
      id: 'fault-pwr-01',
      code: 'PWR_SHUNT_OVERCURRENT',
      subsystemType: 'EPS',
      severity: 'WARNING',
      description: 'Transient shunt regulator overcurrent pulse',
      detectedAtMETSeconds: 100,
    });

    expect(f1.id).toBe('fault-pwr-01');
    expect(faultManager.getActiveFaults()).toHaveLength(1);
    expect(faultManager.getFaultsBySeverity('WARNING')).toHaveLength(1);
    expect(faultManager.hasActiveCriticalFaults()).toBe(false);
    expect(faultManager.canRecover()).toBe(true);
  });

  it('updates subsystem status and triggers safe mode callback on CRITICAL fault', () => {
    const subsystemManager = new SubsystemManager(true);
    const faultManager = new FaultManager(subsystemManager);

    const safeModeTriggered = vi.fn();
    faultManager.onSafeModeTrigger(safeModeTriggered);

    // Initial status is NOMINAL
    expect(subsystemManager.getSubsystem('TCS')?.getStatus()).toBe('NOMINAL');

    // Raise critical thermal runaway fault
    faultManager.raiseFault({
      id: 'fault-therm-crit',
      code: 'TCS_LOOP_PRESSURE_LOSS',
      subsystemType: 'TCS',
      severity: 'CRITICAL',
      description: 'Rapid depressurization in primary cooling loop',
      detectedAtMETSeconds: 250,
    });

    // Subsystem status updated to FAULT
    expect(subsystemManager.getSubsystem('TCS')?.getStatus()).toBe('FAULT');
    expect(faultManager.hasActiveCriticalFaults()).toBe(true);
    expect(faultManager.canRecover()).toBe(false);

    // Safe mode callback invoked
    expect(safeModeTriggered).toHaveBeenCalledTimes(1);
    expect(safeModeTriggered).toHaveBeenCalledWith(
      expect.stringContaining('Critical fault TCS_LOOP_PRESSURE_LOSS'),
      250
    );
  });

  it('resolves active faults and permits recovery when all critical faults are cleared', () => {
    const faultManager = new FaultManager();

    faultManager.raiseFault({
      id: 'crit-1',
      code: 'PROP_VALVE_LEAK',
      subsystemType: 'PROPULSION',
      severity: 'CRITICAL',
      description: 'Bipropellant oxidizer valve micro-leak detected',
      detectedAtMETSeconds: 300,
    });

    faultManager.raiseFault({
      id: 'warn-1',
      code: 'COMM_SNR_DROP',
      subsystemType: 'COMMUNICATIONS',
      severity: 'WARNING',
      description: 'Atmospheric attenuation at Canberra',
      detectedAtMETSeconds: 310,
    });

    expect(faultManager.hasActiveCriticalFaults()).toBe(true);
    expect(faultManager.canRecover()).toBe(false);

    // Resolve non-critical fault: recovery still blocked by critical fault
    faultManager.resolveFault('warn-1', 350, 'Station elevation improved');
    expect(faultManager.hasActiveCriticalFaults()).toBe(true);
    expect(faultManager.canRecover()).toBe(false);

    // Resolve critical fault: recovery is now permitted
    faultManager.resolveFault('crit-1', 400, 'Secondary isolation latch valve sealed');
    expect(faultManager.hasActiveCriticalFaults()).toBe(false);
    expect(faultManager.canRecover()).toBe(true);

    const history = faultManager.getFaultHistory();
    expect(history).toHaveLength(2);
    expect(history.find((f) => f.id === 'crit-1')?.resolvedAtMETSeconds).toBe(400);
  });

  it('schedules FAULT_DETECTED and FAULT_RESOLVED events via MissionEventEngine', () => {
    const engine = new MissionEventEngine(0, true);
    const faultManager = new FaultManager();
    faultManager.attachEventEngine(engine);

    const eventLog: string[] = [];
    engine.registerHandler(FSW_EVENT_TYPES.FAULT_DETECTED, (evt) => {
      const p = evt.payload as any;
      eventLog.push(`DETECTED:${p.code}:${p.severity}`);
    });

    engine.registerHandler(FSW_EVENT_TYPES.FAULT_RESOLVED, (evt) => {
      const p = evt.payload as any;
      eventLog.push(`RESOLVED:${p.code}`);
    });

    faultManager.raiseFault({
      id: 'f-gnc',
      code: 'STAR_TRACKER_BLINDED',
      subsystemType: 'GNC',
      severity: 'DEGRADED',
      description: 'Jupiter limb glint in optical sensor',
      detectedAtMETSeconds: 100,
    });

    faultManager.resolveFault('f-gnc', 150, 'Spacecraft slew completed; star lock regained');

    engine.advanceAndProcess(200);

    expect(eventLog).toContain('DETECTED:STAR_TRACKER_BLINDED:DEGRADED');
    expect(eventLog).toContain('RESOLVED:STAR_TRACKER_BLINDED');
  });
});

