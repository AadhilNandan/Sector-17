import { describe, it, expect } from 'vitest';
import { FlightComputer } from '../src/simulation/flightSoftware/flightComputer';
import { CommunicationManager } from '../src/simulation/communications/communicationManager';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { FSW_EVENT_TYPES } from '../src/simulation/flightSoftware/constants';
import { COMM_EVENT_TYPES, EARTH_ROTATION_RATE_RAD_PER_SEC } from '../src/simulation/communications/constants';
import { ASTRONOMICAL_UNIT_METRES } from '../src/simulation/constants';

describe('Flight Software — Flight Computer Central Avionics Core', () => {
  it('initializes deterministically with clean subsystem and operational baselines', () => {
    const fc = new FlightComputer({
      initialState: 'INITIALIZED',
      initialPosition: {
        latitudeDeg: 0.0,
        longitudeDeg: -115.0,
        distanceMetres: ASTRONOMICAL_UNIT_METRES,
        frame: 'ECEF',
      },
    });

    expect(fc.getCurrentMETSeconds()).toBe(0);
    expect(fc.getExecutionController().getState()).toBe('INITIALIZED');
    expect(fc.getSubsystemManager().getAllSubsystems()).toHaveLength(8);
    expect(fc.getFaultManager().getActiveFaults()).toHaveLength(0);

    const pos = fc.getResolvedECEFPosition();
    expect(pos.subSpacecraftLatitudeDeg).toBe(0.0);
    expect(pos.subSpacecraftLongitudeDeg).toBe(-115.0);
  });

  it('autonomously enters SAFE_MODE and isolates subsystems when a critical fault is raised', async () => {
    const fc = new FlightComputer({ initialState: 'INITIALIZED' });
    fc.transitionState('STANDBY', 'Pre-launch sequence nominal');
    fc.transitionState('ACTIVE', 'Translunar / interplanetary injection complete');

    expect(fc.getExecutionController().isOperational()).toBe(true);

    const prop = fc.getSubsystemManager().getSubsystem('PROPULSION') as any;
    expect(prop.areValvesIsolated()).toBe(false);

    // Raise critical main engine chamber overpressure fault
    fc.getFaultManager().raiseFault({
      id: 'fault-eng-01',
      code: 'PROP_CHAMBER_OVERPRESSURE',
      subsystemType: 'PROPULSION',
      severity: 'CRITICAL',
      description: 'Chamber pressure exceeded burst disc design threshold',
      detectedAtMETSeconds: 120,
    });

    // Autonomous safety response:
    // 1. Spacecraft transitions to SAFE_MODE
    expect(fc.getExecutionController().isInSafeMode()).toBe(true);
    expect(fc.getExecutionController().getState()).toBe('SAFE_MODE');

    // 2. Propulsion valves isolated & all subsystems placed in fail-safe state
    expect(prop.areValvesIsolated()).toBe(true);
    expect(fc.getSubsystemManager().getSubsystem('TCS')?.getStatus()).toBe('SAFE');
    expect(fc.getSubsystemManager().getSubsystem('COMMUNICATIONS')?.getStatus()).toBe('SAFE');

    // Recovery is blocked while critical fault remains active
    expect(() => {
      fc.transitionState('RECOVERY', 'Attempting recovery');
      fc.transitionState('ACTIVE', 'Resuming nominal');
    }).toThrow(/Cannot transition from RECOVERY to ACTIVE while recovery criteria/);

    // Resolve the fault
    fc.getFaultManager().resolveFault('fault-eng-01', 200, 'Pressure relieved through bypass manifold');

    // Recovery now succeeds
    fc.transitionState('ACTIVE', 'All clear; returning to active science cruise');
    expect(fc.getExecutionController().getState()).toBe('ACTIVE');
    expect(fc.getExecutionController().isOperational()).toBe(true);
  });

  it('integrates deterministic time steps, command execution, and communications', async () => {
    const engine = new MissionEventEngine(0, true);
    const commManager = new CommunicationManager({
      autoExecuteCommands: false, // Let FlightComputer handle command execution
    });

    const fc = new FlightComputer({
      initialState: 'INITIALIZED',
      initialPosition: {
        latitudeDeg: 35.4, // Near Goldstone
        longitudeDeg: -116.9,
        distanceMetres: 1e9, // ~3.33 s OWLT
        frame: 'ECEF',
      },
    });

    fc.attachEventEngine(engine);
    fc.attachCommunicationManager(commManager);

    fc.transitionState('STANDBY', 'Standby');
    fc.transitionState('ACTIVE', 'Active');

    // Register a flight computer command handler
    let maneuverExecuted = false;
    fc.getCommandExecutor().registerHandler('EXECUTE_TRAJECTORY_TRIM', (payload: any) => {
      maneuverExecuted = true;
      return { deltaVApplied: payload.deltaV };
    });

    // Uplink command from Earth at t = 0
    const cmd = commManager.getCommandQueue().enqueueCommand({
      id: 'cmd-trim-1',
      type: 'EXECUTE_TRAJECTORY_TRIM',
      payload: { deltaV: 1.5 },
      priority: 200,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      uplinkDataRateBps: 1000,
      distanceMetres: 1e9,
    });

    const arrivalMET = cmd.arrivalMETSeconds; // ~3.84 s
    expect(arrivalMET).toBeGreaterThan(0);

    // Step 1: Advance by 1s (before arrival) -> command is in transit
    const report1 = await fc.step(1);
    expect(report1.metSeconds).toBe(1);
    expect(report1.commandsProcessed).toBe(0);
    expect(maneuverExecuted).toBe(false);

    // Step 2: Advance past arrival MET (e.g. 10s) -> command executes and emits ACK telemetry!
    const report2 = await fc.step(9); // MET = 10s
    expect(report2.metSeconds).toBe(10);
    expect(report2.commandsProcessed).toBe(1);
    expect(report2.commandsSucceeded).toBe(1);
    expect(maneuverExecuted).toBe(true);

    // Verify ACK packet exists in telemetry queue
    const telemetryQueue = commManager.getTelemetryQueue();
    const ackPacket = telemetryQueue.getAllPackets().find((p) => p.id.startsWith('ack-cmd-trim-1'));
    expect(ackPacket).toBeDefined();
    expect((ackPacket?.payload as any).success).toBe(true);
    expect((ackPacket?.payload as any).result.deltaVApplied).toBe(1.5);
  });

  it('rotates ECI coordinates over time during step advancement', async () => {
    const fc = new FlightComputer({
      initialState: 'ACTIVE',
      initialPosition: {
        latitudeDeg: 0.0,
        longitudeDeg: 0.0, // Celestial longitude 0°
        distanceMetres: 1e9,
        frame: 'ECI',
      },
    });

    const rep0 = await fc.step(0);
    expect(rep0.resolvedECEFPosition.subSpacecraftLongitudeDeg).toBeCloseTo(0.0, 3);

    // Advance one quarter sidereal day -> Earth rotates exactly 90° eastward -> sub-spacecraft point moves 90° westward (-90°)
    const quarterSiderealDay = (Math.PI / 2) / EARTH_ROTATION_RATE_RAD_PER_SEC; // ~21541.02 s
    const repQuarter = await fc.step(quarterSiderealDay);
    expect(repQuarter.resolvedECEFPosition.subSpacecraftLongitudeDeg).toBeCloseTo(-90.0, 2);
  });

  it('contains command handler exceptions without crashing flight computer execution', async () => {
    const commManager = new CommunicationManager({ autoExecuteCommands: false });
    const fc = new FlightComputer({ initialState: 'ACTIVE' });
    fc.attachCommunicationManager(commManager);

    // Register a faulty command handler that throws an error
    fc.getCommandExecutor().registerHandler('FAILING_COMMAND', () => {
      throw new Error('Hardware actuator sensor jammed');
    });

    // Enqueue command with immediate arrival
    const cmd = commManager.getCommandQueue().enqueueCommand({
      id: 'cmd-fail-1',
      type: 'FAILING_COMMAND',
      payload: {},
      priority: 100,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      uplinkDataRateBps: 10_000,
      distanceMetres: 1000,
    });

    // Step past arrival
    const rep = await fc.step(cmd.arrivalMETSeconds + 1);

    expect(rep.commandsProcessed).toBe(1);
    expect(rep.commandsSucceeded).toBe(0);
    expect(rep.commandsFailed).toBe(1);

    // Command marked FAILED
    expect(commManager.getCommandQueue().getCommand('cmd-fail-1')?.status).toBe('FAILED');

    // Negative acknowledgement telemetry packet generated
    const ackPkt = commManager
      .getTelemetryQueue()
      .getAllPackets()
      .find((p) => p.id.startsWith('ack-cmd-fail-1'));
    expect(ackPkt).toBeDefined();
    expect((ackPkt?.payload as any).success).toBe(false);
    expect((ackPkt?.payload as any).errorMessage).toContain('Hardware actuator sensor jammed');
  });

  it('verifies that command acknowledgement telemetry propagates to Earth across RF link with OWLT delay', async () => {
    const commManager = new CommunicationManager({ autoExecuteCommands: false });
    const fc = new FlightComputer({
      initialState: 'ACTIVE',
      initialPosition: {
        latitudeDeg: 35.4, // Over Goldstone
        longitudeDeg: -116.9,
        distanceMetres: 3e8, // ~1 light second (300,000 km)
        frame: 'ECEF',
      },
    });
    fc.attachCommunicationManager(commManager);

    fc.getCommandExecutor().registerHandler('PING', () => 'pong');

    // Uplink command
    const cmd = commManager.getCommandQueue().enqueueCommand({
      id: 'cmd-ping-propagation',
      type: 'PING',
      payload: {},
      priority: 250,
      sizeBytes: 64,
      scheduledTxTimeMET: 0,
      uplinkDataRateBps: 10_000,
      distanceMetres: 3e8, // OWLT = 1.00069 s
    });

    // Step 1: Advance to arrival and execution -> Command executes and ACK is enqueued
    await fc.step(cmd.arrivalMETSeconds + 0.1);
    const telemetryQueue = commManager.getTelemetryQueue();
    const ackPacket = telemetryQueue.getAllPackets().find((p) => p.id.startsWith('ack-cmd-ping-propagation'));
    expect(ackPacket).toBeDefined();

    // Step 2: Advance by 1 second during active Goldstone window -> Telemetry begins downlink transmission
    await fc.step(1.0);
    const updatedAck = telemetryQueue.getPacket(ackPacket!.id);
    expect(updatedAck?.status).toBe('IN_TRANSIT');
    expect(updatedAck?.earthReceiptTimeMET).toBeDefined();
    // Earth receipt timestamp includes OWLT delay
    expect(updatedAck!.earthReceiptTimeMET!).toBeGreaterThan(fc.getCurrentMETSeconds());

    // Step 3: Advance past Earth receipt timestamp -> Packet arrives and is acknowledged by ground station
    const deltaToEarthReceipt = updatedAck!.earthReceiptTimeMET! - fc.getCurrentMETSeconds() + 1.0;
    await fc.step(deltaToEarthReceipt);

    const receivedOnEarth = telemetryQueue.getPacket(ackPacket!.id);
    expect(receivedOnEarth?.status).toBe('ACKNOWLEDGED');
    expect(fc.getCurrentMETSeconds()).toBeGreaterThanOrEqual(receivedOnEarth!.earthReceiptTimeMET!);
  });

  it('handles prelaunch critical faults cleanly via PRELAUNCH_HOLD and blocks premature launch', async () => {
    const fc = new FlightComputer({ initialState: 'INITIALIZED' });

    // In INITIALIZED state: raise prelaunch critical battery charger fault
    fc.getFaultManager().raiseFault({
      id: 'prelaunch-pwr-crit',
      code: 'EPS_GROUND_POWER_SURGE',
      subsystemType: 'EPS',
      severity: 'CRITICAL',
      description: 'Ground umbilical power surge detected on bus A',
      detectedAtMETSeconds: 5,
    });

    // Automatically transitions to PRELAUNCH_HOLD (NOT SAFE_MODE)
    expect(fc.getExecutionController().getState()).toBe('PRELAUNCH_HOLD');
    expect(fc.getExecutionController().isPrelaunchHold()).toBe(true);

    // Subsystems configured into safe state
    expect(fc.getSubsystemManager().getSubsystem('EPS')?.getStatus()).toBe('SAFE');
    expect(fc.getSubsystemManager().getSubsystem('PROPULSION')?.getStatus()).toBe('SAFE');

    // Launch directly to ACTIVE is strictly barred from PRELAUNCH_HOLD
    expect(() => {
      fc.transitionState('ACTIVE', 'Attempting illegal launch from hold');
    }).toThrow(/Illegal state transition/);

    // Transition back to STANDBY is barred while critical fault remains active
    expect(() => {
      fc.transitionState('STANDBY', 'Attempting countdown resume with fault active');
    }).toThrow(/Cannot transition from PRELAUNCH_HOLD to STANDBY while prelaunch critical faults remain active/);

    // Direct recovery of subsystems is barred while critical fault remains active
    expect(fc.getSubsystemManager().recoverAll(10)).toBe(false);

    // Resolve prelaunch fault
    fc.getFaultManager().resolveFault('prelaunch-pwr-crit', 15, 'Ground bus regulator swapped and verified');

    // Now recovery back to STANDBY succeeds
    fc.transitionState('STANDBY', 'Fault resolved; prelaunch hold released');
    expect(fc.getExecutionController().getState()).toBe('STANDBY');

    // Subsystems can now be restored
    expect(fc.getSubsystemManager().recoverAll(16)).toBe(true);
    expect(fc.getSubsystemManager().getSubsystem('EPS')?.getStatus()).toBe('NOMINAL');

    // From STANDBY, mission can transition to ACTIVE (launch!)
    fc.transitionState('ACTIVE', 'Launch vehicle liftoff and separation confirmed');
    expect(fc.getExecutionController().getState()).toBe('ACTIVE');
    expect(fc.getExecutionController().isOperational()).toBe(true);
  });

  it('completes end-to-end telemetry downlink, Earth receipt, return ACK propagation, and storage retention purge', async () => {
    const commManager = new CommunicationManager({ autoExecuteCommands: false });
    const fc = new FlightComputer({
      initialState: 'ACTIVE',
      initialPosition: {
        latitudeDeg: 35.4, // Over Goldstone
        longitudeDeg: -116.9,
        distanceMetres: 3e8, // ~1 light second (OWLT ~1.00069s)
        frame: 'ECEF',
      },
      retentionPolicy: {
        requireAethonAckToPurge: true, // Requires ground ACK return to AETHON
        retentionGracePeriodSeconds: 0,
        protectCriticalData: false,
      },
    });
    fc.attachCommunicationManager(commManager);

    const storage = commManager.getStorage();
    const telemetryQueue = commManager.getTelemetryQueue();
    const retentionManager = fc.getRetentionManager();

    // 1. Store science observation in onboard storage and queue for downlink
    storage.storeData({
      id: 'science-scan-europa',
      category: 'science',
      sizeBytes: 10_000,
      priority: 150,
      createdAtMETSeconds: 10,
    });
    retentionManager.trackPacket('science-scan-europa', 'science', 10_000, 10);

    telemetryQueue.enqueue({
      id: 'science-scan-europa',
      category: 'science',
      payload: { surfaceRegion: 'Conamara' },
      sizeBytes: 10_000,
      priority: 150,
    });

    expect(storage.getUsedStorageBytes()).toBe(10_000);
    expect(retentionManager.getRecord('science-scan-europa')?.state).toBe('STORED');

    // 2. Step 1: Downlink begins over Goldstone pass (10,000 bytes @ 100kbps takes 0.8s)
    await fc.step(2.0); // downlink completes on spacecraft, final bit travels to Earth
    const pkt = telemetryQueue.getPacket('science-scan-europa');
    expect(pkt?.status).toBe('IN_TRANSIT');
    expect(pkt?.earthReceiptTimeMET).toBeDefined();

    // 3. Step 2: Advance to Earth receipt timestamp
    const deltaToEarth = pkt!.earthReceiptTimeMET! - fc.getCurrentMETSeconds() + 0.1;
    await fc.step(deltaToEarth);

    // Earth received packet and generated return ground ACK frame
    const receivedPkt = telemetryQueue.getPacket('science-scan-europa');
    expect(receivedPkt?.status).toBe('ACKNOWLEDGED');
    const returnAckFrame = commManager.getGroundAckFrame('gack-science-scan-europa');
    expect(returnAckFrame).toBeDefined();
    expect(returnAckFrame?.arrivalMETSeconds).toBeGreaterThan(fc.getCurrentMETSeconds());

    // CRITICAL INVARIANT: Earth received it, BUT AETHON has NOT received return ACK yet!
    expect(retentionManager.getRecord('science-scan-europa')?.state).not.toBe('ACK_RECEIVED_AETHON');
    expect(retentionManager.getRecord('science-scan-europa')?.state).not.toBe('ELIGIBLE_FOR_PURGE');
    // Storage memory must NOT be freed yet
    expect(storage.getUsedStorageBytes()).toBe(10_000);

    // Attempting purge before return ACK arrives frees ZERO bytes
    const prematurePurge = retentionManager.purgeEligiblePackets(storage, fc.getCurrentMETSeconds());
    expect(prematurePurge.purgedCount).toBe(0);
    expect(storage.getUsedStorageBytes()).toBe(10_000);

    // 4. Step 3: Advance past return ACK arrival MET at AETHON (RTLT + uplink duration)
    const deltaToAethonArrival = returnAckFrame!.arrivalMETSeconds - fc.getCurrentMETSeconds() + 0.5;
    await fc.step(deltaToAethonArrival);

    // Now AETHON confirmed return ACK from Earth!
    expect(retentionManager.getRecord('science-scan-europa')?.state).toBe('ELIGIBLE_FOR_PURGE');

    // 5. Step 4: Explicit purge now deletes packet from OnboardStorage and frees memory
    const purgeReport = retentionManager.purgeEligiblePackets(storage, fc.getCurrentMETSeconds());
    expect(purgeReport.purgedCount).toBe(1);
    expect(purgeReport.freedBytes).toBe(10_000);
    expect(purgeReport.purgedPacketIds).toContain('science-scan-europa');

    // OnboardStorage memory freed
    expect(storage.getUsedStorageBytes()).toBe(0);
    expect(storage.getPacket('science-scan-europa')).toBeUndefined();
    expect(retentionManager.getRecord('science-scan-europa')?.state).toBe('DELETED');
  });
});
