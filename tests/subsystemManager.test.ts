import { describe, it, expect } from 'vitest';
import {
  SubsystemManager,
  EpsSubsystem,
  PropulsionSubsystem,
  TcsSubsystem,
  CommunicationsSubsystem,
} from '../src/simulation/flightSoftware/subsystemManager';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { FSW_EVENT_TYPES } from '../src/simulation/flightSoftware/constants';

describe('Flight Software — Subsystem Manager & Lifecycle', () => {
  it('registers all standard subsystems with appropriate implementation status', () => {
    const manager = new SubsystemManager(true);
    const subsystems = manager.getAllSubsystems();

    expect(subsystems).toHaveLength(8);

    const eps = manager.getSubsystem('EPS');
    expect(eps?.implementationStatus).toBe('SIMPLIFIED');
    expect(eps?.getStatus()).toBe('NOMINAL');

    const prop = manager.getSubsystem('PROPULSION');
    expect(prop?.implementationStatus).toBe('SIMPLIFIED');

    const tcs = manager.getSubsystem('TCS');
    expect(tcs?.implementationStatus).toBe('SIMPLIFIED');

    const comms = manager.getSubsystem('COMMUNICATIONS');
    expect(comms?.implementationStatus).toBe('SIMPLIFIED');

    const storage = manager.getSubsystem('STORAGE');
    expect(storage?.implementationStatus).toBe('SIMPLIFIED');

    const gnc = manager.getSubsystem('GNC');
    expect(gnc?.implementationStatus).toBe('NOT_IMPLEMENTED');

    const science = manager.getSubsystem('SCIENCE');
    expect(science?.implementationStatus).toBe('NOT_IMPLEMENTED');
    expect(science?.getStatus()).toBe('OFF');

    const lander = manager.getSubsystem('LANDER_ROVER');
    expect(lander?.implementationStatus).toBe('NOT_IMPLEMENTED');
    expect(lander?.getStatus()).toBe('OFF');
  });

  it('transitions individual subsystem statuses and emits typed events', () => {
    const engine = new MissionEventEngine(0, true);
    const manager = new SubsystemManager(true);
    manager.attachEventEngine(engine);

    const statusChanges: string[] = [];
    engine.registerHandler(FSW_EVENT_TYPES.SUBSYSTEM_STATUS_CHANGED, (evt) => {
      const p = evt.payload as any;
      statusChanges.push(`${p.subsystemType}:${p.oldStatus}->${p.newStatus}`);
    });

    manager.setSubsystemStatus('TCS', 'DEGRADED', 'Heater loop B voltage dip', 150);
    expect(manager.getSubsystem('TCS')?.getStatus()).toBe('DEGRADED');

    manager.setSubsystemStatus('EPS', 'FAULT', 'Solar array deployment stall', 160);
    expect(manager.getSubsystem('EPS')?.getStatus()).toBe('FAULT');

    engine.advanceAndProcess(200);

    expect(statusChanges).toContain('TCS:NOMINAL->DEGRADED');
    expect(statusChanges).toContain('EPS:NOMINAL->FAULT');
  });

  it('commands all subsystems into fail-safe configuration during safe-mode transition', () => {
    const manager = new SubsystemManager(true);

    const prop = manager.getSubsystem('PROPULSION') as PropulsionSubsystem;
    const tcs = manager.getSubsystem('TCS') as TcsSubsystem;
    const comms = manager.getSubsystem('COMMUNICATIONS') as CommunicationsSubsystem;

    expect(prop.areValvesIsolated()).toBe(false);
    expect(tcs.areSurvivalHeatersActive()).toBe(false);
    expect(comms.isHGAActive()).toBe(true);

    // Trigger mass transition to SAFE
    manager.transitionAllToSafe(500);

    const statuses = manager.getStatuses();
    expect(statuses.EPS).toBe('SAFE');
    expect(statuses.PROPULSION).toBe('SAFE');
    expect(statuses.TCS).toBe('SAFE');
    expect(statuses.COMMUNICATIONS).toBe('SAFE');

    // Verify concrete fail-safe actions
    expect(prop.areValvesIsolated()).toBe(true);
    expect(tcs.areSurvivalHeatersActive()).toBe(true);
    expect(comms.isHGAActive()).toBe(false);

    // Propellant consumption is inhibited in safe mode
    expect(() => {
      prop.consumePropellant(10);
    }).toThrow(/Cannot consume propellant while thruster valves are isolated in SAFE mode/);

    // Recover all
    expect(manager.recoverAll(600)).toBe(true);
    expect(prop.areValvesIsolated()).toBe(false);
    expect(prop.getStatus()).toBe('NOMINAL');
    expect(statuses.PROPULSION).toBe('SAFE'); // snapshot remains safe, actual subsystem updated:
    expect(manager.getSubsystem('PROPULSION')?.getStatus()).toBe('NOMINAL');
  });

  it('strictly blocks subsystem recovery when recovery validator rejects restoration', () => {
    const manager = new SubsystemManager(true);
    let activeCriticalFault = true;

    // Attach recovery validator: blocked while activeCriticalFault is true
    manager.setRecoveryValidator(() => !activeCriticalFault);

    manager.transitionAllToSafe(100);
    expect(manager.getSubsystem('PROPULSION')?.getStatus()).toBe('SAFE');
    expect(manager.getSubsystem('EPS')?.getStatus()).toBe('SAFE');

    // Attempt direct recoverAll while critical fault is active: rejected!
    const recovered = manager.recoverAll(200);
    expect(recovered).toBe(false);
    expect(manager.getSubsystem('PROPULSION')?.getStatus()).toBe('SAFE');
    expect(manager.getSubsystem('EPS')?.getStatus()).toBe('SAFE');

    // Attempt direct setSubsystemStatus to NOMINAL while critical fault is active: rejected!
    const setResult = manager.setSubsystemStatus('PROPULSION', 'NOMINAL', 'Manual bypass attempt', 250);
    expect(setResult).toBe(false);
    expect(manager.getSubsystem('PROPULSION')?.getStatus()).toBe('SAFE');

    // Resolve critical fault
    activeCriticalFault = false;

    // Now recovery succeeds
    expect(manager.recoverAll(300)).toBe(true);
    expect(manager.getSubsystem('PROPULSION')?.getStatus()).toBe('NOMINAL');
    expect(manager.getSubsystem('EPS')?.getStatus()).toBe('NOMINAL');
  });
});
