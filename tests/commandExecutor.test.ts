import { describe, it, expect, vi } from 'vitest';
import { CommandExecutor } from '../src/simulation/flightSoftware/commandExecutor';
import { CommandQueue } from '../src/simulation/communications/commandQueue';
import { TelemetryQueue } from '../src/simulation/communications/telemetryQueue';
import { OnboardStorage } from '../src/simulation/communications/onboardStorage';
import { SubsystemManager } from '../src/simulation/flightSoftware/subsystemManager';
import { MissionExecutionController } from '../src/simulation/flightSoftware/missionExecutionController';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { FSW_EVENT_TYPES } from '../src/simulation/flightSoftware/constants';
import type { CommandPacket } from '../src/simulation/communications/types';

describe('Flight Software — Command Executor & Acknowledgement Telemetry', () => {
  it('strictly prevents command execution prior to physical arrival MET', async () => {
    const executor = new CommandExecutor('ALWAYS');

    const cmd: CommandPacket = {
      id: 'cmd-tcm',
      type: 'TRAJECTORY_MANEUVER',
      payload: { deltaV: 10 },
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 100,
      txDurationSeconds: 1,
      oneWayLightTimeSeconds: 500,
      arrivalMETSeconds: 601, // Arrives at MET 601
      status: 'IN_TRANSIT',
    };

    executor.registerHandler('TRAJECTORY_MANEUVER', () => ({ completed: true }));

    // At MET = 500 s (before arrival), command is rejected
    const resEarly = await executor.executeCommand(cmd, 500);
    expect(resEarly.success).toBe(false);
    expect(resEarly.error).toContain('has not arrived at spacecraft');
  });

  it('prevents duplicate execution of already executed commands', async () => {
    const executor = new CommandExecutor('ALWAYS');
    const cmd: CommandPacket = {
      id: 'cmd-burn-1',
      type: 'FIRE_THRUSTERS',
      payload: {},
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      txDurationSeconds: 0,
      oneWayLightTimeSeconds: 10,
      arrivalMETSeconds: 10,
      status: 'ARRIVED',
    };

    executor.registerHandler('FIRE_THRUSTERS', () => ({ burnSec: 5 }));

    // First execution succeeds
    const res1 = await executor.executeCommand(cmd, 15);
    expect(res1.success).toBe(true);

    // Second execution with EXECUTED status is rejected
    cmd.status = 'EXECUTED';
    const res2 = await executor.executeCommand(cmd, 20);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('cannot be executed; already in terminal status');
  });

  it('rejects commands disallowed in SAFE_MODE when spacecraft is in safe mode', async () => {
    const execController = new MissionExecutionController('INITIALIZED');
    execController.transitionTo('STANDBY', 10, 'Standby');
    execController.transitionTo('ACTIVE', 20, 'Active');
    execController.transitionTo('SAFE_MODE', 30, 'Bus voltage fault');

    const executor = new CommandExecutor('ALWAYS', undefined, execController);

    // Register nominal science command (disallowed in safe mode by default)
    executor.registerHandler('SCIENCE_SPECTROMETER_SCAN', () => ({ scan: 'done' }), {
      allowInSafeMode: false,
    });

    // Register safe-mode emergency diagnostic command
    executor.registerHandler('SAFE_MODE_PING', () => ({ pong: true }), {
      allowInSafeMode: true,
    });

    const sciCmd: CommandPacket = {
      id: 'cmd-sci-1',
      type: 'SCIENCE_SPECTROMETER_SCAN',
      payload: {},
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      txDurationSeconds: 0,
      oneWayLightTimeSeconds: 5,
      arrivalMETSeconds: 5,
      status: 'ARRIVED',
    };

    const resSci = await executor.executeCommand(sciCmd, 50);
    expect(resSci.success).toBe(false);
    expect(resSci.error).toContain('is disallowed while spacecraft is in SAFE_MODE');

    const pingCmd: CommandPacket = {
      id: 'cmd-ping-1',
      type: 'SAFE_MODE_PING',
      payload: {},
      priority: 200,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      txDurationSeconds: 0,
      oneWayLightTimeSeconds: 5,
      arrivalMETSeconds: 5,
      status: 'ARRIVED',
    };

    const resPing = await executor.executeCommand(pingCmd, 50);
    expect(resPing.success).toBe(true);
    expect((resPing.result as any).pong).toBe(true);
  });

  it('rejects commands targeting faulted subsystems', async () => {
    const subManager = new SubsystemManager(true);
    subManager.setSubsystemStatus('PROPULSION', 'FAULT', 'Oxidizer leak', 100);

    const executor = new CommandExecutor('ALWAYS', subManager);

    executor.registerHandler('PROPULSION_PURGE', () => ({ purged: true }), {
      targetSubsystem: 'PROPULSION',
    });

    const cmd: CommandPacket = {
      id: 'cmd-purge',
      type: 'PROPULSION_PURGE',
      payload: {},
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      txDurationSeconds: 0,
      oneWayLightTimeSeconds: 10,
      arrivalMETSeconds: 10,
      status: 'ARRIVED',
    };

    const res = await executor.executeCommand(cmd, 150);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Target subsystem 'PROPULSION' is in 'FAULT' state");
  });

  it('generates unique command acknowledgement telemetry packet and enqueues into downlink queue', async () => {
    const commandQueue = new CommandQueue();
    const telemetryQueue = new TelemetryQueue();
    const storage = new OnboardStorage(1_000_000);
    const executor = new CommandExecutor('ALWAYS');

    executor.attachDependencies({
      commandQueue,
      telemetryQueue,
      storage,
    });

    executor.registerHandler('DIAGNOSTIC_QUERY', () => ({ busVoltage: 32.4 }));

    const cmd = commandQueue.enqueueCommand({
      id: 'cmd-query-01',
      type: 'DIAGNOSTIC_QUERY',
      payload: {},
      priority: 150,
      sizeBytes: 64,
      scheduledTxTimeMET: 100,
      uplinkDataRateBps: 1000,
      distanceMetres: 1e9,
    });

    commandQueue.updateStatus(cmd.arrivalMETSeconds + 5);

    const execRes = await executor.executeCommand(cmd, cmd.arrivalMETSeconds + 5);
    expect(execRes.success).toBe(true);
    expect(execRes.ackPacketId).toBeDefined();

    // Check command marked EXECUTED in queue
    expect(commandQueue.getCommand('cmd-query-01')?.status).toBe('EXECUTED');

    // Check acknowledgement packet in telemetry queue
    const ackPacket = telemetryQueue.getPacket(execRes.ackPacketId!);
    expect(ackPacket).toBeDefined();
    expect(ackPacket?.category).toBe('critical');
    expect(ackPacket?.priority).toBe(250);
    expect((ackPacket?.payload as any).commandId).toBe('cmd-query-01');
    expect((ackPacket?.payload as any).success).toBe(true);

    // Check stored in OnboardStorage
    expect(storage.getPacket(execRes.ackPacketId!)).toBeDefined();
  });

  it('respects configurable acknowledgement policy', async () => {
    const telemetryQueue = new TelemetryQueue();
    const executor = new CommandExecutor('ON_FAILURE');
    executor.attachDependencies({ telemetryQueue });

    executor.registerHandler('SUCCESS_CMD', () => 'ok');
    executor.registerHandler('FAIL_CMD', () => {
      throw new Error('boom');
    });

    const successCmd: CommandPacket = {
      id: 'c-succ',
      type: 'SUCCESS_CMD',
      payload: {},
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      txDurationSeconds: 0,
      oneWayLightTimeSeconds: 1,
      arrivalMETSeconds: 1,
      status: 'ARRIVED',
    };

    const failCmd: CommandPacket = {
      id: 'c-fail',
      type: 'FAIL_CMD',
      payload: {},
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      txDurationSeconds: 0,
      oneWayLightTimeSeconds: 1,
      arrivalMETSeconds: 1,
      status: 'ARRIVED',
    };

    // ON_FAILURE: Success produces no ACK packet
    const res1 = await executor.executeCommand(successCmd, 5);
    expect(res1.success).toBe(true);
    expect(res1.ackPacketId).toBeUndefined();
    expect(telemetryQueue.getAllPackets()).toHaveLength(0);

    // ON_FAILURE: Failure produces an ACK packet
    const res2 = await executor.executeCommand(failCmd, 5);
    expect(res2.success).toBe(false);
    expect(res2.ackPacketId).toBeDefined();
    expect(telemetryQueue.getAllPackets()).toHaveLength(1);
  });
});

