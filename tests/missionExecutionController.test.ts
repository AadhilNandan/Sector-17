import { describe, it, expect } from 'vitest';
import {
  MissionExecutionController,
  InvalidStateTransitionError,
  IncompleteObjectivesError,
} from '../src/simulation/flightSoftware/missionExecutionController';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { FSW_EVENT_TYPES } from '../src/simulation/flightSoftware/constants';

describe('Flight Software — Mission Execution State Machine', () => {
  it('initializes in INITIALIZED state and allows nominal lifecycle transitions', () => {
    const controller = new MissionExecutionController();
    expect(controller.getState()).toBe('INITIALIZED');
    expect(controller.isInSafeMode()).toBe(false);
    expect(controller.isOperational()).toBe(false);

    // INITIALIZED -> STANDBY
    controller.transitionTo('STANDBY', 10, 'Pre-launch ground checks nominal');
    expect(controller.getState()).toBe('STANDBY');

    // STANDBY -> ACTIVE
    controller.transitionTo('ACTIVE', 100, 'Spacecraft separation confirmed; mission active');
    expect(controller.getState()).toBe('ACTIVE');
    expect(controller.isOperational()).toBe(true);

    // ACTIVE -> SAFE_MODE
    controller.transitionTo('SAFE_MODE', 500, 'Thermal anomaly detected on bus');
    expect(controller.getState()).toBe('SAFE_MODE');
    expect(controller.isInSafeMode()).toBe(true);

    // SAFE_MODE -> RECOVERY
    controller.transitionTo('RECOVERY', 600, 'Fault isolated; diagnostic procedures initiating');
    expect(controller.getState()).toBe('RECOVERY');

    // RECOVERY -> ACTIVE
    controller.transitionTo('ACTIVE', 700, 'All systems nominal; resuming operations');
    expect(controller.getState()).toBe('ACTIVE');

    const history = controller.getTransitionHistory();
    expect(history).toHaveLength(5);
    expect(history[0]).toEqual({
      fromState: 'INITIALIZED',
      toState: 'STANDBY',
      metSeconds: 10,
      reason: 'Pre-launch ground checks nominal',
    });
    expect(history[4].toState).toBe('ACTIVE');
  });

  it('rejects invalid state transitions with descriptive InvalidStateTransitionError', () => {
    const controller = new MissionExecutionController();

    // Direct INITIALIZED -> ACTIVE is illegal
    expect(() => {
      controller.transitionTo('ACTIVE', 10, 'Skipping standby');
    }).toThrow(InvalidStateTransitionError);

    // Direct INITIALIZED -> COMPLETED is illegal
    expect(() => {
      controller.transitionTo('COMPLETED', 10, 'Premature completion');
    }).toThrow(InvalidStateTransitionError);

    // Direct INITIALIZED -> SAFE_MODE is illegal (must use PRELAUNCH_HOLD during prelaunch)
    expect(() => {
      controller.transitionTo('SAFE_MODE', 10, 'Illegal safe mode before launch');
    }).toThrow(InvalidStateTransitionError);

    // Move to ACTIVE
    controller.transitionTo('STANDBY', 10, 'Standby');
    controller.transitionTo('ACTIVE', 20, 'Active');

    // Move to SAFE_MODE
    controller.transitionTo('SAFE_MODE', 30, 'Anomaly');

    // Direct SAFE_MODE -> ACTIVE is illegal (must go through RECOVERY)
    expect(() => {
      controller.transitionTo('ACTIVE', 40, 'Direct exit');
    }).toThrow(InvalidStateTransitionError);

    // RECOVERY -> COMPLETED is illegal
    controller.transitionTo('RECOVERY', 50, 'Recovery');
    expect(() => {
      controller.transitionTo('COMPLETED', 60, 'Illegal jump');
    }).toThrow(InvalidStateTransitionError);
  });

  it('strictly forbids transitions out of terminal states (COMPLETED, ABORTED)', () => {
    const controller = new MissionExecutionController();
    controller.transitionTo('STANDBY', 10, 'Standby');
    controller.transitionTo('ACTIVE', 20, 'Active');
    controller.transitionTo('COMPLETED', 1000, 'All Europa science objectives achieved');

    expect(controller.isTerminal()).toBe(true);
    expect(controller.getState()).toBe('COMPLETED');

    expect(() => {
      controller.transitionTo('ACTIVE', 1050, 'Re-opening mission');
    }).toThrow(InvalidStateTransitionError);

    const abortController = new MissionExecutionController();
    abortController.transitionTo('ABORTED', 50, 'Catastrophic launch vehicle failure');
    expect(abortController.isTerminal()).toBe(true);

    expect(() => {
      abortController.transitionTo('STANDBY', 60, 'Re-trying');
    }).toThrow(InvalidStateTransitionError);
  });

  it('enforces mandatory mission objective completion before allowing COMPLETED transition', () => {
    const controller = new MissionExecutionController();
    controller.transitionTo('STANDBY', 10, 'Standby');
    controller.transitionTo('ACTIVE', 20, 'Active');

    controller.addObjective({
      id: 'obj-ice-radar',
      title: 'Ice Penetrating Radar Survey',
      description: 'Profile Europa ice shell thickness',
      isRequired: true,
      isCompleted: false,
    });

    controller.addObjective({
      id: 'obj-optional-magneto',
      title: 'Secondary Magnetometry',
      description: 'Optional plasma wake analysis',
      isRequired: false,
      isCompleted: false,
    });

    expect(controller.areRequiredObjectivesCompleted()).toBe(false);

    // Attempting to complete while required objective is unfinished throws IncompleteObjectivesError
    expect(() => {
      controller.transitionTo('COMPLETED', 5000, 'Done');
    }).toThrow(IncompleteObjectivesError);

    // Complete the required objective
    expect(controller.completeObjective('obj-ice-radar', 4500)).toBe(true);
    expect(controller.areRequiredObjectivesCompleted()).toBe(true);

    // Now transition to COMPLETED succeeds even though optional objective is incomplete
    controller.transitionTo('COMPLETED', 5000, 'Mandatory objectives satisfied');
    expect(controller.getState()).toBe('COMPLETED');
  });

  it('dispatches typed events through MissionEventEngine during state transitions', () => {
    const engine = new MissionEventEngine(0, true);
    const controller = new MissionExecutionController();
    controller.attachEventEngine(engine);

    const events: string[] = [];

    engine.registerHandler(FSW_EVENT_TYPES.MISSION_STATE_CHANGED, (evt) => {
      const p = evt.payload as any;
      events.push(`STATE:${p.fromState}->${p.toState}`);
    });

    engine.registerHandler(FSW_EVENT_TYPES.SAFE_MODE_ENTERED, () => {
      events.push('SAFE_ENTERED');
    });

    engine.registerHandler(FSW_EVENT_TYPES.SAFE_MODE_EXITED, () => {
      events.push('SAFE_EXITED');
    });

    controller.transitionTo('STANDBY', 10, 'Standby');
    controller.transitionTo('ACTIVE', 20, 'Active');
    controller.transitionTo('SAFE_MODE', 30, 'Thermal warning');
    controller.transitionTo('RECOVERY', 40, 'Recovering');
    controller.transitionTo('ACTIVE', 50, 'Safe mode cleared');

    engine.advanceAndProcess(100);

    expect(events).toContain('STATE:INITIALIZED->STANDBY');
    expect(events).toContain('STATE:STANDBY->ACTIVE');
    expect(events).toContain('STATE:ACTIVE->SAFE_MODE');
    expect(events).toContain('SAFE_ENTERED');
    expect(events).toContain('STATE:SAFE_MODE->RECOVERY');
    expect(events).toContain('STATE:RECOVERY->ACTIVE');
    expect(events).toContain('SAFE_EXITED');
  });

  it('manages PRELAUNCH_HOLD lifecycle, prevents premature launch, and enforces recovery gating', () => {
    const controller = new MissionExecutionController();
    let hasCriticalFault = true;
    controller.setRecoveryValidator(() => !hasCriticalFault);

    // INITIALIZED -> PRELAUNCH_HOLD
    controller.transitionTo('PRELAUNCH_HOLD', 5, 'Prelaunch pad power fluctuation');
    expect(controller.getState()).toBe('PRELAUNCH_HOLD');
    expect(controller.isPrelaunchHold()).toBe(true);
    expect(controller.isPrelaunch()).toBe(true);
    expect(controller.isOperational()).toBe(false);

    // Cannot transition directly from PRELAUNCH_HOLD to ACTIVE (launch blocked!)
    expect(() => {
      controller.transitionTo('ACTIVE', 10, 'Attempting launch during hold');
    }).toThrow(InvalidStateTransitionError);

    // Attempting to return to STANDBY while critical fault is active is rejected
    expect(() => {
      controller.transitionTo('STANDBY', 15, 'Attempting to resume countdown with active fault');
    }).toThrow(InvalidStateTransitionError);

    // Resolve fault
    hasCriticalFault = false;

    // Now return to STANDBY succeeds
    controller.transitionTo('STANDBY', 20, 'Power bus stabilized; hold released');
    expect(controller.getState()).toBe('STANDBY');

    // From STANDBY, critical fault can trigger PRELAUNCH_HOLD again
    hasCriticalFault = true;
    controller.transitionTo('PRELAUNCH_HOLD', 25, 'Umbilical connection drop');
    expect(controller.getState()).toBe('PRELAUNCH_HOLD');

    // From PRELAUNCH_HOLD, can abort mission
    controller.transitionTo('ABORTED', 30, 'Launch scrubbed and aborted');
    expect(controller.getState()).toBe('ABORTED');
    expect(controller.isTerminal()).toBe(true);
  });
});
